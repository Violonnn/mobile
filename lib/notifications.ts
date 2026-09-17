import { getActiveSession } from './auth';
import { supabase } from './supabase';
import { isProfilePhotoSchemaMissing } from './schemaCompatibility';

export type NotificationActor = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  avatarPath: string | null;
};

export type InAppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
  actor: NotificationActor | null;
};

type NotificationRow = {
  id: unknown;
  type: unknown;
  title: unknown;
  body: unknown;
  related_entity_type: unknown;
  related_entity_id: unknown;
  is_read: unknown;
  created_at: unknown;
  actor_id: unknown;
};

type ActorRow = {
  id: unknown;
  first_name: unknown;
  last_name: unknown;
  middle_name: unknown;
  avatar_path: unknown;
};

function mapActor(row: ActorRow): NotificationActor {
  return {
    id: String(row.id),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    middleName: row.middle_name ? String(row.middle_name) : null,
    avatarPath: row.avatar_path ? String(row.avatar_path) : null,
  };
}

export async function fetchMyNotifications(): Promise<{
  notifications: InAppNotification[];
  error: string | null;
}> {
  const session = await getActiveSession();
  if (!session?.user.id) {
    return { notifications: [], error: 'Sign in to view notifications.' };
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, type, title, body, related_entity_type, related_entity_id, is_read, created_at, actor_id',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return { notifications: [], error: error.message };

  const rows = (data ?? []) as NotificationRow[];
  const actorIds = [
    ...new Set(
      rows
        .map((row) => (row.actor_id ? String(row.actor_id) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const actorsById = new Map<string, NotificationActor>();

  if (actorIds.length > 0) {
    const actorResult = await supabase
      .from('app_profiles_public')
      .select('id, first_name, last_name, middle_name, avatar_path')
      .in('id', actorIds);

    let actorRows = actorResult.data as unknown as ActorRow[] | null;
    let actorError = actorResult.error;
    if (actorResult.error && isProfilePhotoSchemaMissing(actorResult.error.message)) {
      const legacyResult = await supabase
        .from('app_profiles_public')
        .select('id, first_name, last_name, middle_name')
        .in('id', actorIds);
      actorRows = legacyResult.data as unknown as ActorRow[] | null;
      actorError = legacyResult.error;
    }

    if (actorError) {
      return { notifications: [], error: actorError.message };
    }

    actorRows?.forEach((row) => {
      const actor = mapActor(row);
      actorsById.set(actor.id, actor);
    });
  }

  return {
    notifications: rows.map((row) => {
      const actorId = row.actor_id ? String(row.actor_id) : null;
      return {
        id: String(row.id),
        type: String(row.type),
        title: String(row.title ?? 'Notification'),
        body: String(row.body ?? ''),
        relatedEntityType: row.related_entity_type
          ? String(row.related_entity_type)
          : null,
        relatedEntityId: row.related_entity_id
          ? String(row.related_entity_id)
          : null,
        isRead: Boolean(row.is_read),
        createdAt: String(row.created_at ?? ''),
        actor: actorId ? actorsById.get(actorId) ?? null : null,
      };
    }),
    error: null,
  };
}

export async function updateNotificationReadState(
  notificationId: string,
  isRead: boolean,
): Promise<string | null> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: isRead })
    .eq('id', notificationId);
  return error?.message ?? null;
}

export async function deleteNotification(
  notificationId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);
  return error?.message ?? null;
}
