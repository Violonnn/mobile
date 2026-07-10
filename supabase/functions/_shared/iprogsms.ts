const IPROG_API_URL = "https://www.iprogsms.com/api/v1/sms_messages";
const IPROG_FETCH_TIMEOUT_MS = 3500;

export type IprogSmsSendOptions = {
  /** Philippine local format expected by IPROG: 09XXXXXXXXX */
  phoneNumber: string;
  message: string;
};

// IPROG send-endpoint success body: integer `status`, plus a `message_id`.
// NOTE: the `status` field type is inconsistent across IPROG endpoints
// (integer on send, string "success"/"error" elsewhere), so we only trust
// this shape for the sms_messages endpoint — see iprogsms.api docs.
type IprogSendResponse = {
  status?: number | string;
  message?: string;
  message_id?: string;
};

function getApiToken(): string | null {
  return Deno.env.get("IPROG_SMS_API_TOKEN")?.trim() || null;
}

function parseErrorBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // plain text body
  }
  return body;
}

export async function sendIprogSms(
  options: IprogSmsSendOptions,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const apiToken = getApiToken();
  if (!apiToken) {
    console.error("IPROG config missing: IPROG_SMS_API_TOKEN");
    return {
      ok: false,
      status: 500,
      body: "IPROG_SMS_API_TOKEN is not configured",
    };
  }

  // Sender name is account-level on IPROG (no per-request field). Only
  // api_token, phone_number, and message are sent. sms_provider is left
  // unset so it defaults to 0 (its 0/1/2 values are undocumented).
  const payload = {
    api_token: apiToken,
    phone_number: options.phoneNumber,
    message: options.message.slice(0, 160),
  };

  console.log("IPROG request to", options.phoneNumber.replace(/\d(?=\d{4})/g, "*"));

  let response: Response;
  try {
    response = await fetch(IPROG_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(IPROG_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IPROG request failed";
    console.error("IPROG fetch error:", message);
    return { ok: false, status: 504, body: message };
  }

  const body = await response.text();
  console.log("IPROG response status:", response.status);

  let parsed: IprogSendResponse | null = null;
  try {
    parsed = JSON.parse(body) as IprogSendResponse;
  } catch {
    // non-JSON body handled below
  }

  // Confirmed error shape (documented for content-validation, integer status):
  // { "status": 500, "message": "Invalid Token" }
  if (parsed?.status === 500 && parsed.message) {
    console.error("IPROG rejected request:", parsed.message);
    return { ok: false, status: 500, body: parsed.message };
  }

  // Documented success: HTTP 2xx, integer status 200, and a message_id.
  if (response.ok && parsed?.status === 200 && parsed.message_id) {
    console.log("IPROG send accepted:", parsed.message_id);
    return { ok: true };
  }

  // TODO: Confirm error shapes for the send endpoint against the live API
  // (insufficient credits, invalid/malformed phone_number, and any other
  // failure). These are NOT documented by IPROG — run a deliberate failing
  // request, log the raw body below, and add specific handling once known.
  const errorText = parseErrorBody(body);
  console.error("IPROG send failed (unconfirmed error shape):", response.status, errorText);
  return { ok: false, status: response.status || 502, body: errorText };
}

export function buildOtpMessage(otp: string): string {
  return `Hello! Please verify your phone number using the code ${otp} valid for 10 min. Do not share.`;
}

export function isE164Phone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/**
 * Convert a Philippine E.164 number (+639XXXXXXXXX) to IPROG's expected
 * local format (09XXXXXXXXX). IPROG's send endpoint consistently documents
 * the 09XX format; E.164 on send is undocumented, so we always convert.
 * Returns null if the input isn't a recognizable PH mobile number.
 */
export function e164ToPhilippineLocal(phone: string): string | null {
  const trimmed = phone.trim();
  // +639XXXXXXXXX  -> 09XXXXXXXXX
  if (/^\+639\d{9}$/.test(trimmed)) {
    return `0${trimmed.slice(3)}`;
  }
  // 639XXXXXXXXX (no plus) -> 09XXXXXXXXX
  if (/^639\d{9}$/.test(trimmed)) {
    return `0${trimmed.slice(2)}`;
  }
  // Already local 09XXXXXXXXX
  if (/^09\d{9}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}
