// lib/officialReportSubmit.ts
// Client helpers that call create-official-report / update-official-report.
// Media is optional for officials; GPS + description remain required.

import { supabase } from './supabase';
import { getActiveSession } from './auth';
import {
  readEdgeFunctionErrorMessage,
} from './edgeFunctionErrors';
import {
  randomUuid,
  totalVideoSeconds,
  uploadReportMedia,
  type CapturedMedia,
} from './reportMedia';
import type { GpsPosition } from './location';

export type OfficialReportMediaPayload = {
  id: string;
  type: 'photo' | 'video';
  storagePath: string;
  durationSeconds: number | null;
};

export type CreateOfficialReportInput = {
  title?: string;
  description: string;
  position: GpsPosition;
  addressText?: string;
  barangayId?: string | null;
  media?: CapturedMedia[];
};

export type UpdateOfficialReportInput = {
  reportId: string;
  title?: string;
  description: string;
  position: GpsPosition;
  addressText?: string;
  barangayId?: string | null;
};

const MAX_PHOTOS = 3;
const MAX_VIDEO_SECONDS = 30;

/** Soft media validation for optional official attachments. */
export function validateOptionalOfficialMedia(
  media: CapturedMedia[],
): string | null {
  if (media.length === 0) return null;

  const photos = media.filter((item) => item.type === 'photo');
  const videoSeconds = totalVideoSeconds(media);

  if (photos.length > MAX_PHOTOS) {
    return `Official reports allow at most ${MAX_PHOTOS} photos.`;
  }
  if (videoSeconds > MAX_VIDEO_SECONDS) {
    return `Combined video must be ${MAX_VIDEO_SECONDS} seconds or less.`;
  }
  return null;
}

async function uploadOfficialMedia(
  userId: string,
  reportId: string,
  media: CapturedMedia[],
): Promise<{ uploaded: OfficialReportMediaPayload[]; error: string | null }> {
  const uploaded: OfficialReportMediaPayload[] = [];

  for (const item of media) {
    const { storagePath, error } = await uploadReportMedia({
      userId,
      reportId,
      media: item,
    });
    if (error || !storagePath) {
      return {
        uploaded: [],
        error: error ?? 'Media upload failed.',
      };
    }
    uploaded.push({
      id: item.id,
      type: item.type,
      storagePath,
      durationSeconds: item.durationSeconds,
    });
  }

  return { uploaded, error: null };
}

/** Create a verified official incident via the Edge Function. */
export async function submitOfficialReport(
  input: CreateOfficialReportInput,
): Promise<{ reportId: string | null; error: string | null }> {
  const description = input.description.trim();
  if (!description) {
    return { reportId: null, error: 'Enter a description.' };
  }
  if (
    !Number.isFinite(input.position.latitude) ||
    !Number.isFinite(input.position.longitude)
  ) {
    return { reportId: null, error: 'Capture a GPS location first.' };
  }

  const media = input.media ?? [];
  const mediaError = validateOptionalOfficialMedia(media);
  if (mediaError) {
    return { reportId: null, error: mediaError };
  }

  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { reportId: null, error: 'Sign in to log an incident.' };
  }

  const reportId = randomUuid();
  let uploaded: OfficialReportMediaPayload[] = [];

  if (media.length > 0) {
    const uploadResult = await uploadOfficialMedia(userId, reportId, media);
    if (uploadResult.error) {
      return { reportId: null, error: uploadResult.error };
    }
    uploaded = uploadResult.uploaded;
  }

  try {
    const { data, error, response } = await supabase.functions.invoke(
      'create-official-report',
      {
        body: {
          reportId,
          title: (input.title ?? '').trim() || undefined,
          description,
          latitude: input.position.latitude,
          longitude: input.position.longitude,
          addressText: input.addressText?.trim() || undefined,
          barangayId: input.barangayId || undefined,
          media: uploaded,
        },
      },
    );

    if (error) {
      const message = await readEdgeFunctionErrorMessage(
        error,
        response,
        'Could not log this incident. Please try again.',
      );
      return { reportId: null, error: message };
    }

    const createdId =
      data && typeof data === 'object' && 'reportId' in data
        ? String((data as { reportId: unknown }).reportId)
        : reportId;

    return { reportId: createdId, error: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return { reportId: null, error: detail };
  }
}

/** Update content fields on an official-authored report. */
export async function updateOfficialReport(
  input: UpdateOfficialReportInput,
): Promise<{ reportId: string | null; error: string | null }> {
  const description = input.description.trim();
  if (!description) {
    return { reportId: null, error: 'Enter a description.' };
  }
  if (
    !Number.isFinite(input.position.latitude) ||
    !Number.isFinite(input.position.longitude)
  ) {
    return { reportId: null, error: 'Capture a GPS location first.' };
  }

  const session = await getActiveSession();
  if (!session?.user?.id) {
    return { reportId: null, error: 'Sign in to update this incident.' };
  }

  try {
    const { data, error, response } = await supabase.functions.invoke(
      'update-official-report',
      {
        body: {
          reportId: input.reportId,
          title: (input.title ?? '').trim() || undefined,
          description,
          latitude: input.position.latitude,
          longitude: input.position.longitude,
          addressText: input.addressText?.trim() || undefined,
          barangayId: input.barangayId || undefined,
        },
      },
    );

    if (error) {
      const message = await readEdgeFunctionErrorMessage(
        error,
        response,
        'Could not update this incident. Please try again.',
      );
      return { reportId: null, error: message };
    }

    const updatedId =
      data && typeof data === 'object' && 'reportId' in data
        ? String((data as { reportId: unknown }).reportId)
        : input.reportId;

    return { reportId: updatedId, error: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return { reportId: null, error: detail };
  }
}
