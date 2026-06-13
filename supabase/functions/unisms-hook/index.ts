import { Webhook } from "standardwebhooks";
import {
  buildOtpMessage,
  isE164Phone,
  sendUniSms,
} from "../_shared/unisms.ts";

/**
 * Supabase Auth maps ANY HTTP 400 from the hook URL to
 * "Invalid payload sent to hook". Always respond with HTTP 200.
 */
function hookSuccess() {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function hookError(message: string, httpCode: number) {
  console.error(`Send SMS hook error [${httpCode}]:`, message);
  return new Response(
    JSON.stringify({
      error: {
        message,
        http_code: httpCode,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return "***";
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}

/** Supabase may send +639... or 639... — normalize to E.164 for UniSMS. */
function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  return isE164Phone(withPlus) ? withPlus : null;
}

function getWebhookHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const key of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
    const value = req.headers.get(key);
    if (value) headers[key] = value;
  }
  return headers;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return hookError("Method not allowed", 405);
  }

  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET")?.trim();
  if (!hookSecret) {
    return hookError("SMS hook is not configured", 500);
  }

  const payload = await req.text();
  const headers = getWebhookHeaders(req);
  const base64Secret = hookSecret.replace(/^v1,whsec_/, "");

  try {
    const wh = new Webhook(base64Secret);
    const verified = wh.verify(payload, headers) as {
      user?: { phone?: string };
      sms?: { otp?: string };
    };

    const phone = normalizePhone(verified.user?.phone);
    const otp = verified.sms?.otp?.trim();

    console.log("Send SMS hook invoked for", maskPhone(phone ?? "unknown"));

    if (!phone || !otp) {
      console.error("Hook payload missing phone or otp");
      return hookError("Missing phone or OTP in hook payload", 400);
    }

    // Supabase OTP length can be 6–8 depending on project settings.
    if (!/^\d{6,8}$/.test(otp)) {
      console.error("Hook payload OTP format rejected:", otp.length, "digits");
      return hookError("Invalid OTP format", 400);
    }

    const result = await sendUniSms({
      recipient: phone,
      content: buildOtpMessage(otp),
    });

    if (!result.ok) {
      console.error("UniSMS send failed:", result.body);
      return hookError(
        `Failed to dispatch SMS via UniSMS: ${result.body}`,
        502,
      );
    }

    console.log("UniSMS send succeeded for", maskPhone(phone));
    return hookSuccess();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown hook error";
    console.error("Send SMS hook verify/process error:", message);
    return hookError(`Failed to process SMS hook: ${message}`, 500);
  }
});
