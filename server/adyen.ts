import { ENV } from "./_core/env";

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

/**
 * Create a payment link for an invoice
 */
export async function createAdyenPaymentLink(
  request: AdyenPaymentLinkRequest
): Promise<AdyenPaymentLinkResponse> {
  const { amount, currency, reference, description, returnUrl, merchantAccount, apiKey } = request;

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
    const response = await fetch("https://checkout-test.adyen.com/v71/paymentLinks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Adyen error: ${error.errorCode} - ${error.message}`);
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
 * Verify webhook signature from Adyen
 */
export function verifyAdyenWebhookSignature(
  body: string,
  signature: string,
  hmacKey: string
): boolean {
  // TODO: Implement HMAC verification
  // For now, return true (implement proper verification in production)
  return true;
}

/**
 * Handle Adyen webhook events
 */
export function handleAdyenWebhookEvent(event: any) {
  const eventType = event.type;

  switch (eventType) {
    case "payment":
      // Handle successful payment
      return {
        action: "updateInvoiceStatus",
        status: "paid",
        reference: event.originalReference,
      };
    case "paymentExpired":
      // Handle expired payment link
      return {
        action: "expirePaymentLink",
        reference: event.originalReference,
      };
    default:
      return null;
  }
}
