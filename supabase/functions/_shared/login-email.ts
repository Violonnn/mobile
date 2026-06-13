/** Internal email used only for server-issued login tokens (not shown to users). */
export function loginEmailForUserId(userId: string): string {
  // RFC 2606 reserved domain — accepted by Supabase Auth; never shown to users.
  return `${userId}@login.disasterlink.invalid`;
}
