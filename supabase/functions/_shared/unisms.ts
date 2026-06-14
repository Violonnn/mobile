const UNISMS_API_URL = "https://unismsapi.com/api/sms";
const UNISMS_FETCH_TIMEOUT_MS = 3500;

export type UniSmsSendOptions = {
  recipient: string;
  content: string;
  senderId?: string;
};

type UniSmsSuccessResponse = {
  message?: {
    status?: string;
    fail_reason?: string | null;
  };
};

function getApiSecretKey(): string | null {
  return (
    Deno.env.get("UNISMS_API_SECRET_KEY")?.trim() ||
    Deno.env.get("UNISMS_ACCESS_KEY_SECRET")?.trim() ||
    null
  );
}

function buildBasicAuthHeader(apiSecretKey: string): string {
  // UniSMS docs: Authorization: Basic Base64Encode(API_SECRET_KEY:)
  return `Basic ${btoa(`${apiSecretKey}:`)}`;
}

const UNISMS_SUCCESS_STATUSES = new Set(["sent", "pending", "queued", "accepted"]);

function isUniSmsAccepted(status?: string, failReason?: string | null): boolean {
  if (failReason) return false;
  if (!status) return true;
  const normalized = status.toLowerCase();
  if (UNISMS_SUCCESS_STATUSES.has(normalized)) return true;
  if (normalized === "failed" || normalized === "error" || normalized === "rejected") {
    return false;
  }
  // 201/200 with an unknown status — treat as accepted (often means queued)
  return true;
}

function parseErrorBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: string | { fail_reason?: string | null; status?: string };
      error?: string;
      detail?: string;
    };

    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.detail === "string") return parsed.detail;

    if (typeof parsed.message === "string") return parsed.message;

    if (parsed.message && typeof parsed.message === "object") {
      return parsed.message.fail_reason ??
        parsed.message.status ??
        body;
    }
  } catch {
    // plain text body
  }

  return body;
}

export async function sendUniSms(
  options: UniSmsSendOptions,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const apiSecretKey = getApiSecretKey();
  if (!apiSecretKey) {
    console.error("UniSMS config missing: UNISMS_API_SECRET_KEY");
    return {
      ok: false,
      status: 500,
      body: "UNISMS_API_SECRET_KEY is not configured",
    };
  }

  const senderId = options.senderId?.trim() ||
    Deno.env.get("UNISMS_SENDER_ID")?.trim() ||
    undefined;

  const payload: Record<string, string> = {
    recipient: options.recipient,
    content: options.content.slice(0, 160),
  };

  if (senderId) {
    payload.sender_id = senderId;
  }

  console.log("UniSMS request to", options.recipient.replace(/\d(?=\d{4})/g, "*"));

  let response: Response;
  try {
    response = await fetch(UNISMS_API_URL, {
      method: "POST",
      headers: {
        Authorization: buildBasicAuthHeader(apiSecretKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UNISMS_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UniSMS request failed";
    console.error("UniSMS fetch error:", message);
    return { ok: false, status: 504, body: message };
  }

  const body = await response.text();
  console.log("UniSMS response status:", response.status);

  // Docs say 201; accept 200 as well in case the API varies.
  if (response.status === 201 || response.status === 200) {
    try {
      const parsed = JSON.parse(body) as UniSmsSuccessResponse;
      const deliveryStatus = parsed.message?.status;
      const failReason = parsed.message?.fail_reason;

      if (!isUniSmsAccepted(deliveryStatus, failReason)) {
        const reason = failReason ?? deliveryStatus ?? "unknown";
        console.error("UniSMS delivery rejected:", reason);
        return { ok: false, status: response.status, body: String(reason) };
      }

      console.log("UniSMS delivery accepted:", deliveryStatus ?? "ok");
    } catch {
      // 2xx with non-JSON body still counts as success
    }
    return { ok: true };
  }

  const errorText = parseErrorBody(body);
  console.error("UniSMS HTTP error:", response.status, errorText);
  return { ok: false, status: response.status, body: errorText };
}

export function buildOtpMessage(otp: string): string {
  return `Hello! Please verify your phone number using the code ${otp} valid for 10 min - DisasterLink`;
}

export function isE164Phone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
