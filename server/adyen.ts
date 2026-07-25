import crypto from "crypto";

/**
 * Adyen Payment Integration
 * Handles payment link creation for invoices
 */

export interface AdyenPaymentLinkRequest {
  amount: number; // in cents
  currency: string;
  reference: string; // invoice ID
  description: string;
  returnUrl: string;
  merchantAccount: string;
  apiKey: string;
  environment?: "test" | "live";
}

export interface AdyenPaymentLinkResponse {
  id: string;
  url: string;
  reference: string;
  amount: {
    value: number;
    currency: string;
  };
  status: string;
}

function checkoutBaseUrl(environment: "test" | "live" = "test") {
  return environment === "live"
    ? "https://checkout-live.adyen.com/v71/paymentLinks"
    : "https://checkout-test.adyen.com/v71/paymentLinks";
}

/**
 * Create a payment link for an invoice
 */
export async function createAdyenPaymentLink(
  request: AdyenPaymentLinkRequest
): Promise<AdyenPaymentLinkResponse> {
  const {
    amount,
    currency,
    reference,
    description,
    returnUrl,
    merchantAccount,
    apiKey,
    environment = "test",
  } = request;

  const payload = {
    amount: {
      value: amount,
      currency: currency,
    },
    reference: reference,
    description: description,
    returnUrl: returnUrl,
    merchantAccount: merchantAccount,
  };

  try {
    const response = await fetch(checkoutBaseUrl(environment), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Adyen error: ${error.errorCode || response.status} - ${error.message || response.statusText}`
      );
    }

    const data = await response.json();
    return {
      id: data.id,
      url: data.url,
      reference: data.reference,
      amount: data.amount,
      status: data.status,
    };
  } catch (error) {
    console.error("[Adyen] Payment link creation failed:", error);
    throw error;
  }
}

/**
 * Verify webhook HMAC signature from Adyen (hex HMAC-SHA256 over the payload).
 * Returns false when hmacKey is missing or signature does not match.
 */
export function verifyAdyenWebhookSignature(
  body: string,
  signature: string,
  hmacKey: string
): boolean {
  if (!hmacKey || !signature) return false;
  try {
    const key = Buffer.from(hmacKey, "hex");
    const digest = crypto.createHmac("sha256", key).update(body, "utf8").digest("base64");
    const a = Buffer.from(digest);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Handle Adyen webhook events
 */
export function handleAdyenWebhookEvent(event: any) {
  const eventType = event.type;

  switch (eventType) {
    case "payment":
      return {
        action: "updateInvoiceStatus",
        status: "paid",
        reference: event.originalReference || event.merchantReference,
      };
    case "paymentExpired":
      return {
        action: "expirePaymentLink",
        reference: event.originalReference || event.merchantReference,
      };
    default:
      return null;
  }
}
