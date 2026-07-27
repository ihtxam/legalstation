/** GrapesJS page document stored in firm_pages.content (and platform legal HTML). */

export type GrapesPageDocument = {
  v: 2;
  format: "grapes";
  html: string;
  css: string;
  /** GrapesJS project JSON for round-trip editing */
  projectData?: unknown;
};

export function isGrapesPageDocument(value: unknown): value is GrapesPageDocument {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.v === 2 && v.format === "grapes" && typeof v.html === "string";
}

export function parseGrapesDocument(raw: string | null | undefined): GrapesPageDocument | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return isGrapesPageDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeGrapesDocument(doc: GrapesPageDocument): string {
  return JSON.stringify(doc);
}

export function emptyGrapesDocument(firmName = "Your firm"): GrapesPageDocument {
  return {
    v: 2,
    format: "grapes",
    html: `
<section style="padding:72px 24px;background:linear-gradient(135deg,#0F766E 0%,#00BFA6 100%);color:#fff;text-align:center;">
  <h1 style="margin:0 0 12px;font-size:42px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(firmName)}</h1>
  <p style="margin:0 auto;max-width:520px;font-size:18px;opacity:0.9;line-height:1.5;">Trusted legal counsel — clear advice, careful handling of your matters.</p>
  <a href="#contact" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#fff;color:#0F766E;border-radius:8px;text-decoration:none;font-weight:600;">Contact us</a>
</section>
<section style="padding:56px 24px;max-width:960px;margin:0 auto;">
  <h2 style="font-size:28px;margin:0 0 12px;">How we help</h2>
  <p style="color:#475569;line-height:1.6;margin:0 0 24px;">Drag blocks from the left panel to redesign this homepage — sections, text, images, and more.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
    <div style="padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
      <h3 style="margin:0 0 8px;font-size:16px;">Advice</h3>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">Practical guidance for individuals and businesses.</p>
    </div>
    <div style="padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
      <h3 style="margin:0 0 8px;font-size:16px;">Representation</h3>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">Dedicated lawyers for your cases and negotiations.</p>
    </div>
    <div style="padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
      <h3 style="margin:0 0 8px;font-size:16px;">Client portal</h3>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">Share documents and updates securely online.</p>
    </div>
  </div>
</section>
<section id="contact" style="padding:48px 24px;background:#f8fafc;text-align:center;">
  <h2 style="margin:0 0 8px;">Get in touch</h2>
  <p style="margin:0;color:#64748b;">Update this section with your phone, email, and office address.</p>
</section>`.trim(),
    css: "",
  };
}

export function defaultLegalHtml(kind: "terms" | "privacy" | "cookies", brand: string): string {
  const title =
    kind === "terms" ? "Terms & Conditions" : kind === "privacy" ? "Privacy Policy" : "Cookie Policy";
  const body =
    kind === "terms"
      ? `<p>These Terms &amp; Conditions govern use of services provided by <strong>${escapeHtml(brand)}</strong>. By accessing our website or client portal, you agree to these terms.</p>
<p>Please replace this placeholder with your firm’s full contractual terms, liability limits, and governing law.</p>`
      : kind === "privacy"
        ? `<p><strong>${escapeHtml(brand)}</strong> processes personal data to deliver legal services and operate this website. This Privacy Policy explains what we collect, why, and your rights.</p>
<p>Update this page with your data controller details, retention periods, and contact for privacy requests.</p>`
        : `<p>We use essential cookies to keep you signed in and remember preferences. Analytics or marketing cookies are only used if you consent.</p>
<p>Manage your choice anytime via the cookie banner. Contact <strong>${escapeHtml(brand)}</strong> for questions about cookies.</p>`;

  return `<article class="legal-doc" style="max-width:720px;margin:0 auto;padding:48px 24px;line-height:1.65;color:#0f172a;">
  <h1 style="font-size:32px;margin:0 0 16px;">${title}</h1>
  <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Last updated: ${new Date().toISOString().slice(0, 10)}</p>
  ${body}
</article>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
