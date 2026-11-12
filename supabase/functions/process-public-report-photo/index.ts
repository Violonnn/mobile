import { createClient } from '@supabase/supabase-js';
import { GENERIC_SERVER_ERROR } from '../_shared/http.ts';
import { rejectExtraKeys, trimText } from '../_shared/validation.ts';
import { processPublicPhotoDerivatives } from '../_shared/public-photo-processing.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('process-public-report-photo: missing Supabase environment variables');
    return response({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return response({ error: 'Sign in to process report photos.' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return response({ error: 'Sign in to process report photos.' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Invalid request body.' }, 400);
  }
  if (!isRecord(body) || rejectExtraKeys(body, ['reportId', 'mediaId'])) {
    return response({ error: 'Invalid request fields.' }, 400);
  }
  const reportId = trimText(body.reportId);
  const mediaId = trimText(body.mediaId);
  if (!validUuid(reportId) || !validUuid(mediaId)) {
    return response({ error: 'Select a valid report photo.' }, 400);
  }

  const { data: allowed, error: permissionError } = await userClient.rpc(
    'can_process_public_report_photo',
    { p_report_id: reportId },
  );
  if (permissionError || allowed !== true) {
    return response({ error: 'Only an authorized report reviewer or incident lead can process this photo.' }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: report, error: reportError }, { data: media, error: mediaError }] = await Promise.all([
    admin.from('reports').select('id,reporter_id').eq('id', reportId).maybeSingle(),
    admin.from('report_media')
      .select('id,report_id,type,storage_path,display_storage_path,thumbnail_storage_path')
      .eq('id', mediaId)
      .eq('report_id', reportId)
      .maybeSingle(),
  ]);
  if (reportError || mediaError) {
    console.error('process-public-report-photo: report/media lookup failed');
    return response({ error: GENERIC_SERVER_ERROR }, 500);
  }
  if (!report || !media || media.type !== 'photo') {
    return response({ error: 'This photo is no longer attached to the selected report.' }, 404);
  }

  const result = await processPublicPhotoDerivatives(admin, {
    reporterId: String(report.reporter_id ?? ''),
    reportId,
    mediaId,
    sourceStoragePath: String(media.storage_path ?? ''),
    displaySourcePath: String(media.display_storage_path ?? ''),
    thumbnailSourcePath: String(media.thumbnail_storage_path ?? ''),
  });
  if (!result.processed) return response({ error: result.error ?? 'Could not process this photo.' }, 400);

  const proof = result.processed;
  const { error: registerError } = await admin.rpc('register_public_report_photo_derivatives', {
    p_report_id: reportId,
    p_media_id: mediaId,
    p_actor_id: userData.user.id,
    p_source_storage_path: proof.sourceStoragePath,
    p_source_object_id: proof.sourceObjectId,
    p_display_source_path: proof.displaySourcePath,
    p_display_source_object_id: proof.displaySourceObjectId,
    p_thumbnail_source_path: proof.thumbnailSourcePath,
    p_thumbnail_source_object_id: proof.thumbnailSourceObjectId,
    p_display_safe_path: proof.displaySafePath,
    p_display_safe_object_id: proof.displaySafeObjectId,
    p_display_sha256: proof.displaySha256,
    p_display_size: proof.displaySize,
    p_display_width: proof.displayWidth,
    p_display_height: proof.displayHeight,
    p_thumbnail_safe_path: proof.thumbnailSafePath,
    p_thumbnail_safe_object_id: proof.thumbnailSafeObjectId,
    p_thumbnail_sha256: proof.thumbnailSha256,
    p_thumbnail_size: proof.thumbnailSize,
    p_thumbnail_width: proof.thumbnailWidth,
    p_thumbnail_height: proof.thumbnailHeight,
    p_processor_version: proof.processorVersion,
  });
  if (registerError) {
    console.error('process-public-report-photo: derivative registration failed');
    return response({ error: 'The photo copies were processed but could not be registered. Try again.' }, 400);
  }

  return response({
    reportId,
    mediaId,
    verified: true,
    displayWidth: proof.displayWidth,
    displayHeight: proof.displayHeight,
    thumbnailWidth: proof.thumbnailWidth,
    thumbnailHeight: proof.thumbnailHeight,
  });
});
