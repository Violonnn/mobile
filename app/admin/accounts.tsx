import { Redirect } from 'expo-router';

/** Preserve old saved links without exposing a separate Accounts destination. */
export default function AdminAccountsRedirect() {
  return <Redirect href="/admin/settings" />;
}
