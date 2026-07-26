import axios from "axios";
import { ENV } from "./_core/env";
import { getInviteEmailStrings } from "./emailI18n";

const BREVO_API_URL = "https://api.brevo.com/v3";

interface EmailPayload {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  sender?: { email: string; name: string };
  replyTo?: { email: string; name?: string };
  /** Brevo attachment payloads (base64 content) */
  attachment?: Array<{ name: string; content: string }>;
}

/** Prefer EMAIL_FROM (verified Brevo sender). Falls back only for local/dev. */
export function getEmailSender(): { email: string; name: string } {
  const email = (ENV.emailFrom || "").trim();
  if (email) {
    return { email, name: ENV.emailFromName || "Cliavo" };
  }
  // Last resort — many Brevo accounts reject unverified domains like noreply@cliavo.ch
  console.warn(
    "[Email] EMAIL_FROM is not set; using noreply@cliavo.ch (likely undeliverable until verified in Brevo)"
  );
  return { email: "noreply@cliavo.ch", name: ENV.emailFromName || "Cliavo" };
}

export async function sendEmail(payload: EmailPayload): Promise<{ messageId: string }> {
  if (!ENV.brevoApiKey) {
    const msg = "Brevo API key not configured (BREVO_API_KEY)";
    console.warn(`[Email] ${msg}`);
    if (ENV.isProduction) {
      throw new Error(msg);
    }
    return { messageId: "mock-" + Date.now() };
  }

  const sender = payload.sender || getEmailSender();
  if (ENV.isProduction && !(ENV.emailFrom || "").trim()) {
    throw new Error(
      "EMAIL_FROM is not set. Use a verified Brevo sender (e.g. corporateshift@gmail.com)."
    );
  }

  const body = {
    ...payload,
    sender,
  };

  try {
    const response = await axios.post(`${BREVO_API_URL}/smtp/email`, body, {
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
  inviterName: string,
  locale?: string | null
): Promise<void> {
  const s = getInviteEmailStrings(locale);
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7C3AED; margin-bottom: 20px;">${s.firmHeading(firmName)}</h2>
          <p>${s.greeting}</p>
          <p>${s.firmBody(inviterName, firmName)}</p>
          <p style="margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #00BFA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              ${s.firmCta}
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">${s.firmExpiry}</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">${s.firmFooter}</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: inviteeEmail }],
    subject: s.firmSubject(firmName),
    htmlContent,
  });
}

export async function sendClientInviteEmail(
  clientEmail: string,
  firmName: string,
  inviteUrl: string,
  locale?: string | null
): Promise<void> {
  const s = getInviteEmailStrings(locale);
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7C3AED; margin-bottom: 20px;">${s.clientHeading(firmName)}</h2>
          <p>${s.greeting}</p>
          <p>${s.clientBody(firmName)}</p>
          <p style="margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #00BFA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              ${s.clientCta}
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">${s.clientHint}</p>
          <p style="color: #666; font-size: 14px;">${s.clientExpiry}</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">${s.clientFooter}</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: clientEmail }],
    subject: s.clientSubject,
    htmlContent,
  });
}

export async function sendFirmCredentialsEmail(opts: {
  email: string;
  firmName: string;
  ownerName: string;
  loginUrl: string;
  temporaryPassword: string;
}): Promise<void> {
  const { email, firmName, ownerName, loginUrl, temporaryPassword } = opts;
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7C3AED; margin-bottom: 20px;">Your Cliavo workspace is ready</h2>
          <p>Hi ${ownerName},</p>
          <p>Your law firm <strong>${firmName}</strong> has been provisioned on Cliavo.</p>
          <p>Sign in with these credentials, then complete onboarding (branding, currency, taxes, subdomain):</p>
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
            <p style="margin: 0 0 8px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Temporary password:</strong> <code style="font-size: 15px;">${temporaryPassword}</code></p>
          </div>
          <p style="color: #666; font-size: 14px;">You will be asked to change this password on first login. Do not share these credentials.</p>
          <p style="margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #00BFA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Sign in to Cliavo
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Cliavo — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email, name: ownerName }],
    subject: `${firmName} — your Cliavo login credentials`,
    htmlContent,
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
          <h2 style="color: #7C3AED; margin-bottom: 20px;">New Message in ${caseTitle}</h2>
          <p>Hi,</p>
          <p><strong>${senderName}</strong> sent you a message in case <strong>${caseTitle}</strong>:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #00BFA6; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #333;">${messagePreview}</p>
          </div>
          <p style="margin: 30px 0;">
            <a href="${caseUrl}" style="background-color: #00BFA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Full Message
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Cliavo — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: recipientEmail }],
    subject: `New message from ${senderName} in ${caseTitle}`,
    htmlContent,
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
          <h2 style="color: #7C3AED; margin-bottom: 20px;">New Document in ${caseTitle}</h2>
          <p>Hi,</p>
          <p><strong>${uploaderName}</strong> uploaded a document in case <strong>${caseTitle}</strong>:</p>
          <p style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #00BFA6; margin: 20px 0; border-radius: 4px; color: #333;">
            📄 <strong>${documentName}</strong>
          </p>
          <p style="margin: 30px 0;">
            <a href="${caseUrl}" style="background-color: #00BFA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Document
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Cliavo — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: [{ email: recipientEmail }],
    subject: `New document: ${documentName} in ${caseTitle}`,
    htmlContent,
  });
}

export async function sendCaseUpdateEmail(opts: {
  recipientEmail: string;
  recipientName: string;
  caseTitle: string;
  updateTitle: string;
  updateBody: string;
  caseUrl: string;
}): Promise<void> {
  const { recipientEmail, recipientName, caseTitle, updateTitle, updateBody, caseUrl } = opts;
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7C3AED; margin-bottom: 20px;">Update on ${caseTitle}</h2>
          <p>Hi ${recipientName},</p>
          <p><strong>${updateTitle}</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #00BFA6; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #333;">${updateBody}</p>
          </div>
          <p style="margin: 30px 0;">
            <a href="${caseUrl}" style="background-color: #00BFA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Open case
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Cliavo — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;
  await sendEmail({
    to: [{ email: recipientEmail, name: recipientName }],
    subject: `${caseTitle}: ${updateTitle}`,
    htmlContent,
  });
}

export async function sendDocumentRequestEmail(opts: {
  recipientEmail: string;
  recipientName: string;
  caseTitle: string;
  requestTitle: string;
  description?: string | null;
  caseUrl: string;
}): Promise<void> {
  const { recipientEmail, recipientName, caseTitle, requestTitle, description, caseUrl } = opts;
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7C3AED; margin-bottom: 20px;">Document requested</h2>
          <p>Hi ${recipientName},</p>
          <p>Your legal team requested a document for <strong>${caseTitle}</strong>:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #00BFA6; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px;"><strong>${requestTitle}</strong></p>
            ${description ? `<p style="margin: 0; color: #333;">${description}</p>` : ""}
          </div>
          <p style="margin: 30px 0;">
            <a href="${caseUrl}" style="background-color: #00BFA6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Upload in client portal
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Cliavo — Swiss Legal Practice Management</p>
        </div>
      </body>
    </html>
  `;
  await sendEmail({
    to: [{ email: recipientEmail, name: recipientName }],
    subject: `Document requested: ${requestTitle}`,
    htmlContent,
  });
}

export async function sendLeadNotificationEmail(opts: {
  toEmail: string;
  type: string;
  firmName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  message?: string | null;
}): Promise<void> {
  const htmlContent = `
    <html>
      <body style="font-family: Inter, sans-serif; color: #1a1a1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7C3AED;">New ${opts.type} lead</h2>
          <p><strong>Firm:</strong> ${opts.firmName}</p>
          <p><strong>Contact:</strong> ${opts.contactName}</p>
          <p><strong>Email:</strong> ${opts.email}</p>
          ${opts.phone ? `<p><strong>Phone:</strong> ${opts.phone}</p>` : ""}
          ${opts.message ? `<p><strong>Message:</strong> ${opts.message}</p>` : ""}
        </div>
      </body>
    </html>
  `;
  await sendEmail({
    to: [{ email: opts.toEmail }],
    subject: `Cliavo lead (${opts.type}): ${opts.firmName}`,
    htmlContent,
  });
}

