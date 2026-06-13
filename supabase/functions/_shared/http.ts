/** Small JSON helpers shared by user-facing edge functions. */

export function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Generic message shown to users when something fails on the server. */
export const GENERIC_SERVER_ERROR =
  "Something went wrong. Please try again later.";
