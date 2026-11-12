import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const cliPath = path.join(projectRoot, 'node_modules', 'supabase', 'dist', 'supabase.js');
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'disasterlink-review-'));
const officerId = randomUUID();
const barangayId = randomUUID();
const reportId = randomUUID();
const firstApplication = `flow_first_${reportId}`;
const secondApplication = `flow_second_${reportId}`;
const workerResults: Promise<string>[] = [];

// The installed CLI supplies local database connectivity. No credentials or
// hosted-project connection are used, and SQL arguments never pass through a shell.
async function runLocalSql(sql: string): Promise<string> {
  const sqlPath = path.join(temporaryDirectory, `${randomUUID()}.sql`);
  await writeFile(sqlPath, sql, 'utf8');
  try {
    const result = await executeFile(process.execPath, [cliPath, 'db', 'query', '--local', '--file', sqlPath], {
      cwd: projectRoot,
      timeout: 45_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return result.stdout;
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`);
  }
}

async function readRows(sql: string): Promise<Record<string, unknown>[]> {
  const result = JSON.parse(await runLocalSql(sql)) as { rows: Record<string, unknown>[] };
  return result.rows;
}

async function waitForDatabaseState(application: string, waitEvent: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rows = await readRows(`select exists (select 1 from pg_stat_activity
      where application_name = '${application}' and ${waitEvent}) as waiting;`);
    if (rows[0]?.waiting === true) return;
  }
  throw new Error(`Database session did not reach its expected wait state: ${application}`);
}

try {
  await runLocalSql(`do $setup$ begin
    insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
      values ('${officerId}', 'authenticated', 'authenticated', '${officerId}@example.test',
        '{"provider":"email","providers":["email"]}', '{}');
    insert into public.barangays(id, name) values ('${barangayId}', 'Concurrency ${barangayId}');
    insert into public.app_profiles(id, role, first_name, last_name, barangay_id, status)
      values ('${officerId}', 'officer', 'Concurrency', 'Reviewer', '${barangayId}', 'active');
    insert into public.reports(id, reporter_id, title, description, barangay_id, location, intake_channel)
      values ('${reportId}', '${officerId}', '', 'Concurrent review fixture', '${barangayId}',
        extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography, 'hotline_call');
    perform set_config('request.jwt.claim.sub', '${officerId}', true);
    perform public.claim_report_review('${reportId}');
  end; $setup$;`);

  const firstReview = runLocalSql(`do $first$ begin
    perform set_config('application_name', '${firstApplication}', true);
    perform set_config('request.jwt.claim.sub', '${officerId}', true);
    perform 1 from public.reports where id = '${reportId}' for update;
    perform pg_sleep(15);
    perform public.review_report('${reportId}', 'verify', null, 'Evidence confirms');
  end; $first$;`);
  workerResults.push(firstReview);
  // Attach handlers immediately so an early CLI failure cannot become unhandled.
  const firstOutcome = firstReview.then(() => null, (error: Error) => error);
  await waitForDatabaseState(firstApplication, "wait_event = 'PgSleep'");

  const secondReview = runLocalSql(`do $second$ begin
    perform set_config('application_name', '${secondApplication}', true);
    perform set_config('request.jwt.claim.sub', '${officerId}', true);
    perform public.review_report('${reportId}', 'verify', null, 'Evidence confirms');
  end; $second$;`);
  workerResults.push(secondReview);
  const secondOutcome = secondReview.then(() => null, (error: Error) => error);
  await waitForDatabaseState(secondApplication, "wait_event_type = 'Lock'");
  assert.equal(await firstOutcome, null, 'first concurrent review must succeed');
  const secondError = await secondOutcome;
  assert.ok(secondError, 'second concurrent review must fail after acquiring the lock');
  assert.match(secondError.message, /requires your own review claim/);
  const rows = await readRows(`select count(*)::integer as total from public.incident_cases where source_report_id = '${reportId}';`);
  assert.equal(rows[0]?.total, 1, 'concurrent reviews must create exactly one incident');
  console.log('PASS: second review waits for the row lock, rechecks the outcome, and creates no duplicate incident.');
} finally {
  await Promise.allSettled(workerResults);
  try {
    // Delete only the random fixture identities created by this invocation.
    await runLocalSql(`do $cleanup$ begin
      perform set_config('disasterlink.report_transition', '1', true);
      perform set_config('disasterlink.suppress_flow_notifications', '1', true);
      delete from public.notifications where user_id = '${officerId}' or related_entity_id = '${reportId}';
      delete from public.incident_events where incident_case_id in (select id from public.incident_cases where source_report_id = '${reportId}');
      update public.reports set incident_case_id = null where id = '${reportId}';
      delete from public.incident_cases where source_report_id = '${reportId}';
      delete from public.reports where id = '${reportId}';
      delete from public.app_profiles where id = '${officerId}';
      delete from auth.users where id = '${officerId}';
      delete from public.barangays where id = '${barangayId}';
    end; $cleanup$;`);
  } finally {
    const resolvedDirectory = path.resolve(temporaryDirectory);
    const temporaryRoot = `${path.resolve(tmpdir())}${path.sep}`;
    assert.ok(resolvedDirectory.startsWith(temporaryRoot), 'cleanup must remain inside the temporary directory');
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
