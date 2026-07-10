import axios from "axios";
import { ENV } from "./_core/env";

const BREVO_API_URL = "https://api.brevo.com/v3";

interface EmailPayload {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  sender: { email: string; name: string };
  replyTo?: { email: string; name?: string };
}

export async function sendEmail(payload: EmailPayload): Promise<{ messageId: string }> {
  if (!ENV.brevoApiKey) {
    console.warn("[Email] Brevo API key not configured, skipping email send");
    return { messageId: "mock-" + Date.now() };
  }

  try {
    const response = await axios.post(`${BREVO_API_URL}/smtp/email`, payload, {
      headers: {
        "api-key": ENV.brevoApiKey,
        "Content-Type": "application/json",
      },
    });
    return { messageId: response.data.messageId };
  } catch (error: any) {
    console.error("[Email] Failed to send email:", error.response?.data || error.message);
    throw new Error(`Email send failed: ${error.response?.data?.message || error.message}`);
  }
}

export async function sendFirmInviteEmail(
  inviteeEmail: string,
  firmName: string,
  inviteUrl: string,
  inviterName: string
): Promise<void> {
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #001f3f; margin-bottom: 20px;">Join ${firmName} on LexFlow</h2>
          <p>Hi,</p>
          <p>${inviterName} has invited you to join <strong>${firmName}</strong> on LexFlow, a modern legal practice management platform.</p>
          <p style="margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #001f3f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This invitation expires in 7 days. If you have questions, contact your firm administrator.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">LexFlow — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: inviteeEmail }],
    subject: `Join ${firmName} on LexFlow`,
    htmlContent,
    sender: { email: "noreply@lexflow.ch", name: "LexFlow" },
  });
}

export async function sendClientInviteEmail(
  clientEmail: string,
  firmName: string,
  inviteUrl: string
): Promise<void> {
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #001f3f; margin-bottom: 20px;">Welcome to ${firmName}'s LexFlow Portal</h2>
          <p>Hi,</p>
          <p><strong>${firmName}</strong> has invited you to access your case information and documents through LexFlow, a secure legal practice management platform.</p>
          <p style="margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #001f3f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Get Started
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">You'll be able to view your cases, upload documents, and communicate securely with your legal team.</p>
          <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">LexFlow — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: clientEmail }],
    subject: `Access your case information on LexFlow`,
    htmlContent,
    sender: { email: "noreply@lexflow.ch", name: "LexFlow" },
  });
}

export async function sendMessageNotificationEmail(
  recipientEmail: string,
  senderName: string,
  caseTitle: string,
  messagePreview: string,
  caseUrl: string
): Promise<void> {
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #001f3f; margin-bottom: 20px;">New Message in ${caseTitle}</h2>
          <p>Hi,</p>
          <p><strong>${senderName}</strong> sent you a message in case <strong>${caseTitle}</strong>:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #001f3f; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #333;">${messagePreview}</p>
          </div>
          <p style="margin: 30px 0;">
            <a href="${caseUrl}" style="background-color: #001f3f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Full Message
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">LexFlow — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: recipientEmail }],
    subject: `New message from ${senderName} in ${caseTitle}`,
    htmlContent,
    sender: { email: "noreply@lexflow.ch", name: "LexFlow" },
  });
}

export async function sendDocumentUploadNotificationEmail(
  recipientEmail: string,
  uploaderName: string,
  caseTitle: string,
  documentName: string,
  caseUrl: string
): Promise<void> {
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #001f3f; margin-bottom: 20px;">New Document in ${caseTitle}</h2>
          <p>Hi,</p>
          <p><strong>${uploaderName}</strong> uploaded a document in case <strong>${caseTitle}</strong>:</p>
          <p style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #001f3f; margin: 20px 0; border-radius: 4px; color: #333;">
            📄 <strong>${documentName}</strong>
          </p>
          <p style="margin: 30px 0;">
            <a href="${caseUrl}" style="background-color: #001f3f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Document
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">LexFlow — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: recipientEmail }],
    subject: `New document: ${documentName} in ${caseTitle}`,
    htmlContent,
    sender: { email: "noreply@lexflow.ch", name: "LexFlow" },
  });
}
