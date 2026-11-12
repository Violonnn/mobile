import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { sanitizePublicJpeg } from '../supabase/functions/_shared/public-jpeg.ts';

const executeFile = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const cliPath = path.join(projectRoot, 'node_modules/supabase/dist/supabase.js');
const sqlFiles: string[] = [];
const ownerId = randomUUID();
const readerId = randomUUID();
const officerId = randomUUID();
const barangayId = randomUUID();
const reportId = randomUUID();
const mediaId = randomUUID();
const publicationOperationId = randomUUID();
const linkedReportId = randomUUID();
const linkedMediaId = randomUUID();
const linkedOperationId = randomUUID();
const officialReportId = randomUUID();
const officialMediaId = randomUUID();
const officialOperationId = randomUUID();

// This harness creates synthetic users and evidence only in the local stack.
// Run migrations and serve the Edge Functions before starting this check.
await mkdir(path.join(projectRoot, 'tmp'), { recursive: true });

async function executeCli(arguments_: string[]): Promise<string> {
  try {
    const result = await executeFile(process.execPath, [cliPath, ...arguments_], {
      cwd: projectRoot, timeout: 60_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024,
    });
    return result.stdout;
  } catch (error) {
    // CLI status includes temporary local credentials. Never print captured output.
    if (arguments_[0] === 'db' && arguments_[1] === 'query') {
      const failure = error as { stdout?: string; stderr?: string };
      throw new Error(`The synthetic local SQL check failed. ${failure.stderr ?? ''}${failure.stdout ?? ''}`);
    }
    throw new Error('The local Supabase CLI check failed.');
  }
}

function parseCliJson(output: string): Record<string, unknown> {
  return JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1));
}

async function localSql(sql: string): Promise<Record<string, unknown>[]> {
  const sqlPath = path.join(projectRoot, 'tmp', `review-photo-${randomUUID()}.sql`);
  sqlFiles.push(sqlPath);
  await writeFile(sqlPath, sql, 'utf8');
  const output = await executeCli(['db', 'query', '--local', '--file', sqlPath]);
  if (!output.includes('{')) return [];
  return (parseCliJson(output).rows ?? []) as Record<string, unknown>[];
}

const localConfig = parseCliJson(await executeCli(['status', '--output', 'json']));
const apiUrl = String(localConfig.API_URL ?? localConfig.api_url ?? '');
const localAddress = new URL(apiUrl);
assert.ok(['127.0.0.1', 'localhost'].includes(localAddress.hostname), 'This test must remain local');
const serviceKey = String(localConfig.SERVICE_ROLE_KEY ?? localConfig.service_role_key ?? '');
const anonKey = String(localConfig.ANON_KEY ?? localConfig.anon_key ?? '');
assert.ok(serviceKey && anonKey, 'Local credentials must be available in memory');

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(apiUrl, serviceKey, clientOptions);
let officerToken = '';
let readerToken = '';
let officer = createClient(apiUrl, anonKey, clientOptions);
let reader = createClient(apiUrl, anonKey, clientOptions);
let owner = createClient(apiUrl, anonKey, clientOptions);

async function authenticatedFixtureClient(userId: string) {
  const fixturePassword = `${randomUUID()}${randomUUID()}`;
  const created = await admin.auth.admin.createUser({ id: userId, email: `${userId}@example.test`,
    password: fixturePassword, email_confirm: true, user_metadata: { first_name: 'Synthetic', last_name: 'Fixture' } });
  assert.equal(created.error, null, 'Only a synthetic local user receives test credentials');
  const client = createClient(apiUrl, anonKey, clientOptions);
  const signedIn = await client.auth.signInWithPassword({ email: `${userId}@example.test`, password: fixturePassword });
  assert.equal(signedIn.error, null, 'The synthetic local fixture must have a real Auth session');
  assert.ok(signedIn.data.session);
  return { client, token: signedIn.data.session.access_token };
}

const original = new Uint8Array(await readFile(path.join(projectRoot, 'tests/fixtures/public-photo.jpg')));
const metadata = new TextEncoder().encode('Exif\0\0GPSLatitude=10.25 GPSLongitude=123.80');
const metadataSegment = new Uint8Array(metadata.length + 4);
metadataSegment.set([0xff, 0xe1, (metadata.length + 2) >> 8, (metadata.length + 2) & 255]);
metadataSegment.set(metadata, 4);
const tagged = new Uint8Array(original.length + metadataSegment.length);
tagged.set(original.subarray(0, 2));
tagged.set(metadataSegment, 2);
tagged.set(original.subarray(2), metadataSegment.length + 2);
const expectedSafeBytes = sanitizePublicJpeg(tagged, 2 * 1024 * 1024).bytes;
const expectedHash = createHash('sha256').update(expectedSafeBytes).digest('hex');
const mediaFolder = `${ownerId}/${reportId}/${mediaId}`;
const originalPath = `${mediaFolder}/original.jpg`;
const displayPath = `${mediaFolder}/display.jpg`;
const thumbnailPath = `${mediaFolder}/thumbnail.jpg`;
const displaySafePath = `public-safe/${mediaId}/${expectedHash}/display.jpg`;
const thumbnailSafePath = `public-safe/${mediaId}/${expectedHash}/thumbnail.jpg`;
const fixturePaths = [originalPath, displayPath, thumbnailPath, displaySafePath, thumbnailSafePath];
let databaseFixturesCreated = false;

async function processAs(token: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const result = await fetch(`${apiUrl}/functions/v1/process-public-report-photo`, {
    method: 'POST', signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, mediaId }),
  });
  return { status: result.status, body: await result.json() as Record<string, unknown> };
}

try {
  const options = await fetch(`${apiUrl}/functions/v1/process-public-report-photo`, {
    method: 'OPTIONS', signal: AbortSignal.timeout(45_000),
  });
  assert.ok([200, 204].includes(options.status), 'The processor must be served locally');
  assert.equal(options.headers.get('access-control-allow-origin'), '*');

  databaseFixturesCreated = true;
  // Keep creation sequential so cleanup cannot race a still-running Auth write.
  const ownerSession = await authenticatedFixtureClient(ownerId);
  const readerSession = await authenticatedFixtureClient(readerId);
  const officerSession = await authenticatedFixtureClient(officerId);
  owner = ownerSession.client;
  reader = readerSession.client;
  officer = officerSession.client;
  readerToken = readerSession.token;
  officerToken = officerSession.token;

  await localSql(`do $setup$ begin
    insert into public.barangays(id,name) values ('${barangayId}','Local photo review fixture');
    insert into public.app_profiles(id,role,first_name,last_name,barangay_id,status)
    values ('${ownerId}','resident','Synthetic','Owner','${barangayId}','active'),
      ('${readerId}','resident','Synthetic','Reader','${barangayId}','active'),
      ('${officerId}','officer','Synthetic','Reviewer','${barangayId}','active')
      on conflict(id) do update set role=excluded.role, first_name=excluded.first_name,
        last_name=excluded.last_name, barangay_id=excluded.barangay_id, status=excluded.status;
    insert into public.reports(id,reporter_id,title,description,barangay_id,location,incident_type)
    values ('${reportId}','${ownerId}','Synthetic photo test','Local-only controlled media fixture','${barangayId}',
      extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood');
    insert into public.report_media(id,report_id,type,storage_path,display_storage_path,thumbnail_storage_path,position)
    values ('${mediaId}','${reportId}','photo','${originalPath}','${displayPath}','${thumbnailPath}',0);
    end; $setup$;`);

  for (const [storagePath, bytes] of [[originalPath, tagged], [displayPath, tagged], [thumbnailPath, tagged]] as const) {
    const uploaded = await owner.storage.from('report-media').upload(storagePath, bytes, { contentType: 'image/jpeg' });
    assert.equal(uploaded.error, null, 'The fixture owner must be able to upload its private evidence');
  }
  const claim = await officer.rpc('claim_report_review', { p_report_id: reportId });
  assert.equal(claim.error, null, 'The local officer must be able to claim the fixture');
  const denied = await processAs(readerToken);
  assert.equal(denied.status, 403, `Another resident cannot process photos: ${String(denied.body.error ?? denied.body.message ?? '')}`);
  const processed = await processAs(officerToken);
  assert.equal(processed.status, 200, `Processing must succeed: ${String(processed.body.error ?? '')}`);
  assert.equal(processed.body.verified, true);
  const proofRows = await localSql(`select public.is_verified_public_report_photo('${reportId}','${mediaId}') as verified;`);
  assert.equal(proofRows[0]?.verified, true, 'The proof must match real stored objects');

  for (const safePath of [displaySafePath, thumbnailSafePath]) {
    const downloaded = await admin.storage.from('report-media').download(safePath);
    assert.equal(downloaded.error, null);
    assert.ok(downloaded.data);
    assert.deepEqual(new Uint8Array(await downloaded.data.arrayBuffer()), expectedSafeBytes);
    const unapproved = await reader.storage.from('report-media').createSignedUrl(safePath, 60);
    assert.ok(unapproved.error || !unapproved.data?.signedUrl, 'Verified but unapproved copies stay private');
    assert.equal((await officer.storage.from('report-media').createSignedUrl(safePath, 60)).error, null,
      'The scoped reviewer can preview a verified copy before approval');
    assert.equal((await owner.storage.from('report-media').createSignedUrl(safePath, 60)).error, null,
      'The reporter retains access to their verified copy');
    const overwrite = await owner.storage.from('report-media').upload(safePath, original, { contentType: 'image/jpeg', upsert: true });
    assert.ok(overwrite.error, 'A report owner cannot replace a trusted safe copy');
  }
  const privateOriginal = await reader.storage.from('report-media').createSignedUrl(originalPath, 60);
  assert.ok(privateOriginal.error || !privateOriginal.data?.signedUrl, 'Another resident cannot sign originals');
  const originalAgain = await admin.storage.from('report-media').download(originalPath);
  assert.ok(originalAgain.data);
  assert.deepEqual(new Uint8Array(await originalAgain.data.arrayBuffer()), tagged, 'Original evidence bytes and metadata must remain unchanged');
  const repeated = await processAs(officerToken);
  assert.equal(repeated.status, 200, 'Retrying the processor must reuse matching immutable copies');

  const reviewedPublication = {
    p_operation_id: publicationOperationId, p_report_id: reportId, p_decision: 'verify',
    p_note: 'Synthetic local evidence review', p_public_title: null,
    p_public_description: null, p_publish: true,
    p_publication_acknowledged: true,
    p_approve_reporter_name: false, p_approve_reporter_avatar: false, p_approve_exact_location: false,
    p_photo_media_ids: [mediaId],
  };
  const failedPublication = await officer.rpc('review_report_with_publication', {
    ...reviewedPublication, p_photo_media_ids: [randomUUID()],
  });
  assert.ok(failedPublication.error, 'A missing selected photo must fail the whole confirmation');
  const failedRows = await localSql(`select incident_case_id is null as still_private
    from public.reports where id='${reportId}';`);
  assert.equal(failedRows[0]?.still_private, true, 'Publication failure must roll back incident creation');
  // Simultaneous identical attempts must serialize into one committed incident.
  const [confirmed, replayed] = await Promise.all([
    officer.rpc('review_report_with_publication', reviewedPublication),
    officer.rpc('review_report_with_publication', reviewedPublication),
  ]);
  assert.equal(confirmed.error, null, 'The valid screened confirmation must commit');
  assert.equal(confirmed.data?.publicAvailable, true);
  assert.equal(replayed.error, null);
  assert.equal(replayed.data?.incidentCaseId, confirmed.data?.incidentCaseId);
  const caseRows = await localSql(`select count(*)::integer as total
    from public.incident_cases where source_report_id='${reportId}';`);
  assert.equal(caseRows[0]?.total, 1, 'A repeated confirmation must create only one incident');

  const publicPost = await reader.rpc('get_public_report', { p_report_id: reportId });
  assert.equal(publicPost.error, null);
  assert.ok(publicPost.data?.report);
  assert.equal(publicPost.data.report.public_title, 'Synthetic photo test');
  assert.equal(publicPost.data.report.public_description, 'Local-only controlled media fixture');
  assert.equal(publicPost.data.report.reporter_name, null, 'Identity stays hidden while the post appears');
  assert.equal(publicPost.data.report.exact_latitude, null, 'Private exact location is withheld');
  assert.deepEqual(publicPost.data.report.public_photo_display_paths, [displaySafePath]);
  assert.deepEqual(publicPost.data.report.public_photo_thumbnail_paths, [thumbnailSafePath]);
  const sourceRows = await reader.from('reports').select('id').eq('id', reportId);
  assert.deepEqual(sourceRows.data, [], 'Public post visibility must not expose its private source row');
  const publicPhoto = await reader.storage.from('report-media').createSignedUrl(displaySafePath, 60);
  assert.equal(publicPhoto.error, null);
  assert.ok(publicPhoto.data?.signedUrl, 'Another resident must be able to sign an approved safe copy');
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(publicPhoto.data.signedUrl).hostname));
  const servedPhoto = await fetch(publicPhoto.data.signedUrl, { signal: AbortSignal.timeout(15_000) });
  assert.equal(servedPhoto.status, 200);
  assert.deepEqual(new Uint8Array(await servedPhoto.arrayBuffer()), expectedSafeBytes,
    'The actual publicly served bytes must be the verified safe copy');

  const linkedFolder = `${ownerId}/${linkedReportId}/${linkedMediaId}`;
  const linkedOriginalPath = `${linkedFolder}/original.jpg`;
  const linkedDisplayPath = `${linkedFolder}/display.jpg`;
  const linkedThumbnailPath = `${linkedFolder}/thumbnail.jpg`;
  fixturePaths.push(linkedOriginalPath, linkedDisplayPath, linkedThumbnailPath);
  await localSql(`do $linked$ begin
    insert into public.reports(id,reporter_id,title,description,barangay_id,location,incident_type)
    values ('${linkedReportId}','${ownerId}','Private linked report','Synthetic second source','${barangayId}',
      extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood');
    insert into public.report_media(id,report_id,type,storage_path,display_storage_path,thumbnail_storage_path,position)
    values ('${linkedMediaId}','${linkedReportId}','photo','${linkedOriginalPath}','${linkedDisplayPath}','${linkedThumbnailPath}',0);
    end; $linked$;`);
  for (const storagePath of [linkedOriginalPath, linkedDisplayPath, linkedThumbnailPath]) {
    assert.equal((await owner.storage.from('report-media').upload(storagePath, tagged, { contentType: 'image/jpeg' })).error, null);
  }
  assert.equal((await officer.rpc('claim_report_review', { p_report_id: linkedReportId })).error, null);
  const linkedPublication = await officer.rpc('review_report_with_publication', {
    p_operation_id: linkedOperationId, p_report_id: linkedReportId, p_decision: 'link',
    p_link_incident_case_id: confirmed.data?.incidentCaseId,
    p_public_title: null, p_public_description: null,
    p_publish: true, p_publication_acknowledged: true,
  });
  assert.equal(linkedPublication.error, null);
  assert.equal(linkedPublication.data?.publicAvailable, true);
  const linkedPost = await reader.rpc('get_public_report', { p_report_id: linkedReportId });
  assert.equal(linkedPost.error, null);
  assert.deepEqual(linkedPost.data?.report?.public_photo_display_paths, [],
    'A linked report cannot borrow another source report\'s approved evidence');
  const listedPosts = await reader.rpc('list_public_reports', { p_barangay_id: barangayId });
  assert.equal(listedPosts.error, null);
  const listedLinked = (listedPosts.data as { report_id: string; public_photo_display_paths: string[] }[])
    .find((post) => post.report_id === linkedReportId);
  assert.ok(listedLinked);
  assert.deepEqual(listedLinked.public_photo_display_paths, []);
  const sourceAfterPublish = await reader.storage.from('report-media').createSignedUrl(originalPath, 60);
  assert.ok(sourceAfterPublish.error || !sourceAfterPublish.data?.signedUrl);

  // Change one legal quantization coefficient to produce different valid JPEG
  // image bytes without changing the source dimensions or adding metadata.
  const changedDisplay = tagged.slice();
  const quantizationOffset = changedDisplay.findIndex((value, index) => value === 0xff && changedDisplay[index + 1] === 0xdb);
  assert.ok(quantizationOffset > 0);
  const coefficientOffset = quantizationOffset + 5;
  changedDisplay[coefficientOffset] = changedDisplay[coefficientOffset] >= 254 ? 253 : changedDisplay[coefficientOffset] + 1;
  const changedSafe = sanitizePublicJpeg(changedDisplay, 2 * 1024 * 1024).bytes;
  const changedHash = createHash('sha256').update(changedSafe).digest('hex');
  const changedSafePath = `public-safe/${mediaId}/${changedHash}/display.jpg`;
  fixturePaths.push(changedSafePath);
  assert.notEqual(changedHash, expectedHash);
  assert.equal((await owner.storage.from('report-media').upload(displayPath, changedDisplay,
    { contentType: 'image/jpeg', upsert: true })).error, null);
  assert.equal((await processAs(officerToken)).status, 200);
  const changedPost = await reader.rpc('get_public_report', { p_report_id: reportId });
  assert.deepEqual(changedPost.data?.report?.public_photo_display_paths, [],
    'Processing changed photo bytes must clear the old approval');
  assert.equal((await officer.rpc('set_report_media_public', {
    p_media_id: mediaId, p_make_public: true, p_reason: 'Synthetic renewed photo review',
  })).error, null);
  const renewedPost = await reader.rpc('get_public_report', { p_report_id: reportId });
  assert.deepEqual(renewedPost.data?.report?.public_photo_display_paths, [changedSafePath]);

  const revoked = await officer.rpc('set_report_media_public', {
    p_media_id: mediaId, p_make_public: false, p_reason: 'Synthetic local revocation',
  });
  assert.equal(revoked.error, null);
  const afterRevocation = await reader.rpc('get_public_report', { p_report_id: reportId });
  assert.deepEqual(afterRevocation.data?.report?.public_photo_display_paths, []);
  const freshSigning = await reader.storage.from('report-media').createSignedUrl(changedSafePath, 60);
  assert.ok(freshSigning.error || !freshSigning.data?.signedUrl, 'Revoked safe copies cannot receive fresh public tokens');
  const hidden = await officer.rpc('set_report_public_post', {
    p_report_id: reportId, p_public_title: null, p_public_description: null, p_publish: false,
    p_approve_reporter_name: false, p_approve_reporter_avatar: false, p_approve_exact_location: false,
  });
  assert.equal(hidden.error, null);
  const staleReplay = await officer.rpc('review_report_with_publication', reviewedPublication);
  assert.equal(staleReplay.error, null);
  assert.equal(staleReplay.data?.publicAvailable, false, 'An old retry must not claim a revoked post is still available');
  assert.equal((await reader.rpc('get_public_report', { p_report_id: reportId })).data, null);

  // The field-intake path stages safe copies before the source report exists.
  // Exercise the actual Edge Function, not only its service-only database RPC.
  const officialFolder = `${officerId}/${officialReportId}/${officialMediaId}`;
  const officialOriginalPath = `${officialFolder}/original.jpg`;
  const officialDisplayPath = `${officialFolder}/display.jpg`;
  const officialThumbnailPath = `${officialFolder}/thumbnail.jpg`;
  const officialSafeDisplayPath = `public-safe/${officialMediaId}/${expectedHash}/display.jpg`;
  const officialSafeThumbnailPath = `public-safe/${officialMediaId}/${expectedHash}/thumbnail.jpg`;
  fixturePaths.push(officialOriginalPath, officialDisplayPath, officialThumbnailPath,
    officialSafeDisplayPath, officialSafeThumbnailPath);
  for (const storagePath of [officialOriginalPath, officialDisplayPath, officialThumbnailPath]) {
    const uploaded = await officer.storage.from('report-media').upload(storagePath, tagged, { contentType: 'image/jpeg' });
    assert.equal(uploaded.error, null, 'The officer can stage their own private evidence');
  }
  const officialPayload = {
    operationId: officialOperationId, reportId: officialReportId, intakeChannel: 'official_field',
    title: '', description: 'Synthetic private field evidence.',
    incidentType: 'flood', latitude: 10.25, longitude: 123.8, barangayId,
    media: [{ id: officialMediaId, type: 'photo', storagePath: officialOriginalPath,
      displayStoragePath: officialDisplayPath, thumbnailStoragePath: officialThumbnailPath,
      durationSeconds: null, width: 128, height: 128 }],
    publishPublicPost: true, publicationAcknowledged: true, publicPhotoMediaIds: [officialMediaId],
  };
  async function submitFieldObservation(payload: typeof officialPayload) {
    const response = await fetch(`${apiUrl}/functions/v1/create-official-report`, {
      method: 'POST', signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${officerToken}`, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }
  const invalidField = await submitFieldObservation({ ...officialPayload, publicPhotoMediaIds: [randomUUID()] });
  assert.equal(invalidField.status, 400, 'Missing selected evidence rejects field intake before source creation');
  const rejectedClientCall = await officer.functions.invoke('create-official-report', {
    body: { ...officialPayload, publicPhotoMediaIds: [randomUUID()] },
  });
  assert.ok(rejectedClientCall.error);
  assert.equal(rejectedClientCall.response?.status, 400,
    'The mobile SDK must preserve a confirmed rejection status for form recovery');
  const fieldBefore = await localSql(`select count(*)::integer as total from public.reports where id='${officialReportId}';`);
  assert.equal(fieldBefore[0]?.total, 0);
  const fieldResult = await submitFieldObservation(officialPayload);
  assert.equal(fieldResult.status, 200, `Official intake must succeed: ${String(fieldResult.body.error ?? '')}`);
  assert.equal(fieldResult.body.publicAvailable, true);
  // The mobile submit helper reuploads unchanged private files on retry. This
  // must preserve the proof tuple and the operation's request identity.
  for (const storagePath of [officialOriginalPath, officialDisplayPath, officialThumbnailPath]) {
    const uploaded = await officer.storage.from('report-media').upload(storagePath, tagged,
      { contentType: 'image/jpeg', upsert: true });
    assert.equal(uploaded.error, null);
  }
  const fieldReplay = await submitFieldObservation(officialPayload);
  assert.equal(fieldReplay.status, 200, 'Identical field intake retries succeed');
  assert.equal(fieldReplay.body.incidentCaseId, fieldResult.body.incidentCaseId);
  const officialPost = await reader.rpc('get_public_report', { p_report_id: officialReportId });
  assert.equal(officialPost.error, null);
  const officialSource = await localSql(`select title from public.reports where id='${officialReportId}';`);
  assert.equal(officialSource[0]?.title, 'Flood', 'Blank official title uses the existing public category label');
  assert.equal(officialPost.data?.report?.public_title, officialSource[0]?.title,
    'Public post text is derived from the stored official source title');
  assert.equal(officialPost.data?.report?.public_description, 'Synthetic private field evidence.');
  assert.deepEqual(officialPost.data?.report?.public_photo_display_paths, [officialSafeDisplayPath]);
  assert.deepEqual(officialPost.data?.report?.public_photo_thumbnail_paths, [officialSafeThumbnailPath]);
  const officialPrivate = await reader.storage.from('report-media').createSignedUrl(officialOriginalPath, 60);
  assert.ok(officialPrivate.error || !officialPrivate.data?.signedUrl);
  console.log('PASS: real local photo processing, field intake with photos, atomic publication/rollback/replay, private source RLS, public safe signing, and revocation.');
} finally {
  await admin.storage.from('report-media').remove(fixturePaths);
  if (databaseFixturesCreated) {
    await localSql(`do $cleanup$ begin
      perform set_config('disasterlink.report_transition','1',true);
      perform set_config('disasterlink.suppress_flow_notifications','1',true);
      delete from public.notifications where user_id in ('${ownerId}','${readerId}','${officerId}') or related_entity_id in ('${reportId}','${officialReportId}','${linkedReportId}');
      delete from public.report_publication_operations where operation_id in ('${publicationOperationId}','${officialOperationId}','${linkedOperationId}');
      delete from public.incident_events where incident_case_id in (select id from public.incident_cases where source_report_id in ('${reportId}','${officialReportId}'));
      update public.reports set incident_case_id=null where id in ('${reportId}','${officialReportId}','${linkedReportId}');
      delete from public.incident_cases where source_report_id in ('${reportId}','${officialReportId}');
      delete from public.reports where id in ('${reportId}','${officialReportId}','${linkedReportId}');
      delete from public.app_profiles where id in ('${ownerId}','${readerId}','${officerId}');
      delete from auth.users where id in ('${ownerId}','${readerId}','${officerId}');
      delete from public.barangays where id='${barangayId}';
    end; $cleanup$;`);
  }
  for (const sqlPath of sqlFiles) {
    assert.ok(sqlPath.startsWith(path.join(projectRoot, 'tmp') + path.sep));
    await unlink(sqlPath);
  }
}
