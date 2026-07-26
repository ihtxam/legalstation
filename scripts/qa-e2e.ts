/**
 * Live end-to-end QA harness.
 *
 * Exercises the deployed platform over plain HTTP(S) the way real browsers /
 * mobile clients do: REST auth endpoints + tRPC procedures (superjson format).
 *
 *   QA_BASE_URL=https://cliavo.com \
 *   QA_SUPERADMIN_EMAIL=... QA_SUPERADMIN_PASSWORD=... \
 *   pnpm exec tsx scripts/qa-e2e.ts
 *
 * Creates disposable "qa-*" firms/users; clean them up with scripts/qa-cleanup.sql.
 */

const BASE = (process.env.QA_BASE_URL || "https://cliavo.com").replace(/\/$/, "");
const SA_EMAIL = process.env.QA_SUPERADMIN_EMAIL || "";
const SA_PASSWORD = process.env.QA_SUPERADMIN_PASSWORD || "";
const RUN_ID = Date.now().toString(36);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, cond: unknown, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)?.slice(0, 400)}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title}`);
}

/** Cookie-jar session speaking REST + tRPC (superjson envelope). */
class Session {
  cookies = new Map<string, string>();

  private cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private storeCookies(res: Response) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const line of setCookies) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (value) this.cookies.set(name, value);
        else this.cookies.delete(name);
      }
    }
  }

  async raw(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        cookie: this.cookieHeader(),
        ...(init.headers || {}),
      },
      redirect: "manual",
    });
    this.storeCookies(res);
    return res;
  }

  /** Multipart upload (lets fetch set the boundary content-type itself). */
  async upload(path: string, form: FormData): Promise<{ status: number; data: any }> {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { cookie: this.cookieHeader() },
      body: form,
      redirect: "manual",
    });
    this.storeCookies(res);
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, data };
  }

  async rest(path: string, body?: unknown): Promise<{ status: number; data: any }> {
    const res = await this.raw(path, {
      method: body === undefined ? "GET" : "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, data };
  }

  /** tRPC query (GET). Returns { data } or { error }. */
  async query(proc: string, input?: unknown): Promise<{ data?: any; error?: any }> {
    const qs =
      input === undefined
        ? ""
        : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
    const res = await this.raw(`/api/trpc/${proc}${qs}`, { method: "GET" });
    return this.parseTrpc(res);
  }

  /** tRPC mutation (POST). */
  async mutate(proc: string, input?: unknown): Promise<{ data?: any; error?: any }> {
    const res = await this.raw(`/api/trpc/${proc}`, {
      method: "POST",
      body: JSON.stringify({ json: input ?? null }),
    });
    return this.parseTrpc(res);
  }

  private async parseTrpc(res: Response): Promise<{ data?: any; error?: any }> {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      return { error: { message: `HTTP ${res.status} (non-JSON)` } };
    }
    if (body?.error) {
      return { error: body.error.json ?? body.error };
    }
    return { data: body?.result?.data?.json };
  }
}

async function main() {
  console.log(`QA run ${RUN_ID} against ${BASE}`);

  // ---------------------------------------------------------------- PHASE 0
  section("Phase 0 — Public surface");
  const anon = new Session();

  {
    const res = await anon.raw("/", { method: "GET" });
    const html = await res.text();
    ok("homepage returns 200", res.status === 200, res.status);
    ok("homepage is the Cliavo app shell", html.includes("Cliavo"));
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    ok("homepage references built assets", assets.length > 0, assets.length);
    for (const a of assets.slice(0, 4)) {
      const r = await anon.raw(a, { method: "GET" });
      ok(`asset ${a.slice(0, 60)} loads`, r.status === 200, r.status);
    }
    for (const route of ["/login", "/signup", "/platform/login", "/pricing"]) {
      const r = await anon.raw(route, { method: "GET" });
      ok(`SPA route ${route} serves`, r.status === 200, r.status);
    }
  }

  {
    const info = await anon.query("signup.info");
    ok("signup.info responds", !!info.data, info.error);
    ok("signup.info saasEnabled", info.data?.saasEnabled === true, info.data);
    ok("signup.info advertises cliavo IP", info.data?.customDomainIp === "179.237.107.63", info.data?.customDomainIp);
    const tenant = await anon.rest("/api/auth/tenant");
    ok("tenant resolve on apex = platform mode", tenant.data?.mode === "platform", tenant.data);
    const health = await anon.raw("/api/health", { method: "GET" });
    ok("health endpoint OK", health.status === 200 || health.status === 404, health.status);
  }

  {
    const lead = await anon.mutate("leads.submit", {
      type: "demo",
      firmName: `QA Lead Firm ${RUN_ID}`,
      contactName: "QA Bot",
      email: `qa-lead-${RUN_ID}@example.com`,
      message: "Automated QA lead — safe to delete.",
    });
    ok("public demo lead submits", !lead.error, lead.error);
  }

  {
    // Unauthenticated protected call must fail cleanly
    const denied = await anon.query("clients.list", {});
    ok("protected proc rejects anonymous", !!denied.error, denied.data);
  }

  // ---------------------------------------------------------------- PHASE 1
  section("Phase 1 — Self-serve trial signup (Firm A)");
  const firmA = new Session();
  const firmAEmail = `qa-owner-${RUN_ID}@example.com`;
  const firmAPassword = `QaPass!${RUN_ID}xx`;
  let firmASlug = "";

  {
    const res = await firmA.mutate("signup.createFirmTrial", {
      firmName: `QA Firm ${RUN_ID}`,
      contactName: "QA Owner",
      email: firmAEmail,
      password: firmAPassword,
      phone: "+41 44 000 00 00",
      preferredLocale: "en",
    });
    ok("trial signup creates firm", !!res.data?.firmId, res.error);
    firmASlug = res.data?.slug || "";
    ok("trial returns slug + login url", !!firmASlug && !!res.data?.loginUrl, res.data);
    const me = await firmA.query("auth.me");
    ok("signup auto-logs-in owner", me.data?.email === firmAEmail, me.data);
  }

  {
    // fresh login (logout → login) exercises the password path
    await firmA.rest("/api/auth/logout", {});
    const bad = await firmA.rest("/api/auth/login", { email: firmAEmail, password: "wrong-password" });
    ok("wrong password rejected", bad.status === 401, bad.status);
    const good = await firmA.rest("/api/auth/login", { email: firmAEmail, password: firmAPassword });
    ok("owner can log back in", good.status === 200 && good.data?.ok, good.data);
    ok("owner redirected to dashboard", good.data?.redirectTo === "/dashboard", good.data?.redirectTo);
  }

  {
    const my = await firmA.query("firm.myFirm");
    ok("firm.myFirm returns workspace", my.data?.firm?.slug === firmASlug, my.error ?? my.data);
    const step = await firmA.mutate("firm.completeOnboardingStep", {
      step: 1,
      name: `QA Firm ${RUN_ID}`,
      address: "Bahnhofstrasse 1, Zürich",
      phone: "+41 44 000 00 00",
      email: firmAEmail,
    });
    ok("onboarding step 1 (profile)", !step.error, step.error);
    const step2 = await firmA.mutate("firm.completeOnboardingStep", {
      step: 2,
      primaryColor: "#0B1F3A",
    });
    ok("onboarding step 2 (branding)", !step2.error, step2.error);
    const step3 = await firmA.mutate("firm.completeOnboardingStep", {
      step: 3,
      defaultCurrency: "CHF",
      defaultVatRate: 8.1,
    });
    ok("onboarding step 3 (currency/tax)", !step3.error, step3.error);
    const branding = await firmA.query("firm.branding");
    ok("firm.branding reflects color", branding.data?.primaryColor === "#0B1F3A", branding.data);
  }

  // ---------------------------------------------------------------- PHASE 2
  section("Phase 2 — Clients, cases, tasks (Firm A)");
  let clientId = 0;
  let companyClientId = 0;
  let caseId = 0;

  {
    const c1 = await firmA.mutate("clients.create", {
      type: "individual",
      firstName: "Anna",
      lastName: "QA-Muster",
      email: `qa-client-${RUN_ID}@example.com`,
      phone: "+41 79 000 00 00",
      city: "Zürich",
      country: "CH",
    });
    clientId = c1.data?.id ?? 0;
    ok("create individual client", clientId > 0, c1.error);

    const c2 = await firmA.mutate("clients.create", {
      type: "company",
      companyName: `QA Corp ${RUN_ID} AG`,
      contactPerson: "Max QA",
      email: `qa-corp-${RUN_ID}@example.com`,
    });
    companyClientId = c2.data?.id ?? 0;
    ok("create company client", companyClientId > 0, c2.error);

    const missing = await firmA.mutate("clients.create", { type: "individual" });
    ok("individual client without name rejected", !!missing.error, missing.data);

    const upd = await firmA.mutate("clients.update", {
      id: clientId,
      notes: "QA note",
      status: "active",
    });
    ok("update client", !upd.error, upd.error);
    const got = await firmA.query("clients.get", { id: clientId });
    ok("client detail readable", got.data?.notes === "QA note", got.error ?? got.data);
  }

  {
    const cs = await firmA.mutate("cases.create", {
      title: `QA Case ${RUN_ID}`,
      type: "civil",
      description: "Automated QA case",
      clientIds: [clientId],
    });
    caseId = cs.data?.id ?? cs.data?.caseId ?? 0;
    ok("create case with client", caseId > 0, cs.error ?? cs.data);

    const got = await firmA.query("cases.get", { id: caseId });
    ok("case detail readable", got.data?.title === `QA Case ${RUN_ID}`, got.error);

    const note = await firmA.mutate("cases.addNote", { caseId, content: "QA note on case", visibility: "internal" });
    ok("add case note", !note.error, note.error);

    const assign2 = await firmA.mutate("cases.assignClient", { caseId, clientId: companyClientId });
    ok("assign second client to case", !assign2.error, assign2.error);

    const task = await firmA.mutate("caseTasks.create", {
      caseId,
      title: "QA task",
      description: "Do QA things",
    });
    ok("create case task", !task.error, task.error);

    const stages = await firmA.query("matterStages.list");
    ok("matter stages list", Array.isArray(stages.data), stages.error);
  }

  // ---------------------------------------------------------------- PHASE 3
  section("Phase 3 — Time tracking & billing (Firm A)");
  let invoiceId = 0;

  {
    const rate = await firmA.mutate("timeEntries.setHourlyRate", { hourlyRate: 250 });
    ok("set hourly rate", !rate.error, rate.error);

    const entry = await firmA.mutate("timeEntries.create", {
      caseId,
      description: "QA manual time entry",
      durationMinutes: 90,
      date: new Date().toISOString().slice(0, 10),
    });
    ok("create manual time entry", !entry.error, entry.error);

    const started = await firmA.mutate("timeEntries.startTimer", { caseId, description: "QA timer" });
    ok("start timer", !started.error, started.error);
    const active = await firmA.query("timeEntries.activeTimer");
    ok("active timer visible", !!active.data, active.error ?? active.data);
    const stopped = await firmA.mutate("timeEntries.stopTimer", {});
    ok("stop timer", !stopped.error, stopped.error);

    const list = await firmA.query("timeEntries.list", {});
    const entries = Array.isArray(list.data) ? list.data : (list.data?.entries ?? []);
    ok("time entries listed", entries.length >= 1, list.error ?? list.data);

    const entryIds = entries.filter((e: any) => e.status === "draft").map((e: any) => e.id);
    if (entryIds.length) {
      const submit = await firmA.mutate("timeEntries.submitMany", { ids: entryIds });
      ok("submit time entries", !submit.error, submit.error);
      const inv = await firmA.mutate("timeEntries.createInvoiceFromEntries", {
        entryIds,
        clientId,
        caseId,
        dueDate: Date.now() + 30 * 86400_000,
        vatRate: 8.1,
      });
      ok("invoice from time entries", !inv.error, inv.error);
    }
  }

  {
    const inv = await firmA.mutate("invoices.create", {
      clientId,
      caseId,
      dueDate: Date.now() + 30 * 86400_000,
      vatRate: 8.1,
      items: [
        { description: "QA consultation", billingType: "hourly", quantity: 2, unitPrice: 250 },
        { description: "QA flat fee", billingType: "flat_fee", quantity: 1, unitPrice: 500 },
      ],
    });
    invoiceId = inv.data?.id ?? inv.data?.invoiceId ?? 0;
    ok("create invoice", invoiceId > 0, inv.error ?? inv.data);

    const got = await firmA.query("invoices.get", { id: invoiceId });
    ok("invoice readable, CHF currency", got.data?.invoice?.currency === "CHF" || got.data?.currency === "CHF", got.data?.invoice?.currency ?? got.data?.currency);

    const sent = await firmA.mutate("invoices.updateStatus", { id: invoiceId, status: "sent" });
    ok("invoice status → sent", !sent.error, sent.error);

    const pdf = await firmA.raw(`/api/invoices/${invoiceId}/pdf`, { method: "GET" });
    ok("invoice PDF endpoint responds", [200, 404].includes(pdf.status), pdf.status);

    const plan = await firmA.mutate("paymentPlans.create", {
      invoiceId,
      name: "QA payment plan",
      installmentCount: 3,
      intervalDays: 30,
      sendFirstNow: false,
      generateDueNow: false,
      installments: [
        { installmentNumber: 1, amount: 300, daysFromNow: 7 },
        { installmentNumber: 2, amount: 300, daysFromNow: 37 },
        { installmentNumber: 3, amount: 407.05, daysFromNow: 67 },
      ],
    });
    ok("create payment plan", !plan.error, plan.error);
  }

  // ---------------------------------------------------------------- PHASE 4
  section("Phase 4 — CMS, packages, services, public site (Firm A)");

  {
    const pkg = await firmA.mutate("clientPackages.createPackage", {
      name: `QA Package ${RUN_ID}`,
      description: "QA subscription package",
      monthlyPrice: 199,
      casesPerPeriod: 1,
      consultationHoursPerPeriod: 2,
      isActive: true,
      isPublic: true,
    });
    ok("create client package", !pkg.error, pkg.error);

    const svc = await firmA.mutate("ondemandServices.createService", {
      name: `QA Service ${RUN_ID}`,
      description: "QA on-demand service",
      category: "contract",
      fulfillmentType: "document",
      price: 350,
      estimatedHours: 2,
      isActive: true,
      isPublic: true,
    });
    ok("create on-demand service", !svc.error, svc.error);

    const pubPkgs = await anon.query("clientPackages.listPublicByFirmSlug", { firmSlug: firmASlug });
    ok("public packages by slug", (pubPkgs.data?.packages ?? pubPkgs.data ?? []).length >= 1, pubPkgs.error ?? pubPkgs.data);
    const pubSvcs = await anon.query("ondemandServices.listPublicByFirmSlug", { firmSlug: firmASlug });
    ok("public services by slug", (pubSvcs.data?.services ?? pubSvcs.data ?? []).length >= 1, pubSvcs.error ?? pubSvcs.data);
  }

  {
    const blocks = [
      { id: "b1", type: "hero", title: "QA Law Firm", subtitle: "Automated QA hero", ctaLabel: "Contact", ctaHref: "#contact" },
      { id: "b2", type: "text", title: "About", body: "QA body text" },
      { id: "b3", type: "packages", title: "Our packages" },
      { id: "b4", type: "services", title: "Our services" },
      { id: "b5", type: "faq", title: "FAQ", items: [{ id: "f1", title: "Q?", body: "A." }] },
      { id: "b6", type: "contact", title: "Contact us" },
    ];
    const page = await firmA.mutate("firmPages.create", {
      title: "QA Home",
      content: JSON.stringify({ version: 1, blocks }),
      published: true,
      isHome: true,
      seoTitle: "QA Home SEO",
      seoDescription: "QA description",
    });
    const pageId = page.data?.id ?? 0;
    ok("create CMS home page (new blocks)", pageId > 0, page.error ?? page.data);

    const pub = await anon.query("firmPages.publicPage", { firmSlug: firmASlug, home: true });
    ok("public homepage resolves", pub.data?.page?.title === "QA Home" || pub.data?.title === "QA Home", pub.error ?? pub.data);

    // Site page via Host header (subdomain tenant resolution)
    const siteRes = await fetch(`${BASE}/site/${firmASlug}`, { redirect: "manual" });
    ok("public /site/<slug> serves", siteRes.status === 200, siteRes.status);
  }

  // ---------------------------------------------------------------- PHASE 5
  section("Phase 5 — Team invites & client portal (Firm A)");
  const lawyerSession = new Session();
  const clientSession = new Session();
  const lawyerEmail = `qa-lawyer-${RUN_ID}@example.com`;
  const clientUserEmail = `qa-portal-${RUN_ID}@example.com`;

  {
    const inv = await firmA.mutate("firm.invite", { email: lawyerEmail, role: "lawyer" });
    const token = inv.data?.token ?? inv.data?.inviteToken ?? "";
    ok("invite lawyer", !!token || !inv.error, inv.error ?? inv.data);

    if (token) {
      const info = await anon.query("firm.getInvite", { token });
      ok("public invite lookup", info.data?.email === lawyerEmail, info.error ?? info.data);
      const reg = await lawyerSession.mutate("firm.registerFromInvite", {
        token,
        name: "QA Lawyer",
        password: firmAPassword,
      });
      ok("lawyer registers from invite", !reg.error, reg.error);
      const me = await lawyerSession.query("auth.me");
      ok("lawyer session works", me.data?.email === lawyerEmail, me.data);
      const cases = await lawyerSession.query("cases.list", {});
      ok("lawyer can list cases", !cases.error, cases.error);
    }
  }

  {
    const inv = await firmA.mutate("firm.invite", { email: clientUserEmail, role: "client", clientId });
    const token = inv.data?.token ?? inv.data?.inviteToken ?? "";
    ok("invite client portal user", !!token || !inv.error, inv.error ?? inv.data);

    if (token) {
      const reg = await clientSession.mutate("firm.registerFromInvite", {
        token,
        name: "QA Portal Client",
        password: firmAPassword,
      });
      ok("client registers from invite", !reg.error, reg.error);

      const stats = await clientSession.query("dashboard.clientStats");
      ok("client dashboard stats", !stats.error, stats.error);
      const msg = await clientSession.mutate("messages.send", { caseId, content: "Hello from QA client" });
      ok("client sends message on case", !msg.error, msg.error);
      const messages = await firmA.query("messages.list", { caseId });
      ok("firm sees client message", JSON.stringify(messages.data ?? "").includes("Hello from QA client"), messages.error ?? messages.data);

      const svcList = await clientSession.query("ondemandServices.listPublicForClient");
      const svcId = (svcList.data ?? [])[0]?.id;
      ok("client sees services catalog", !!svcId, svcList.error ?? svcList.data);
      if (svcId) {
        const add = await clientSession.mutate("ondemandServices.addToCart", { serviceId: svcId, quantity: 1 });
        ok("client adds service to cart", !add.error, add.error);
        const checkout = await clientSession.mutate("ondemandServices.checkout", {});
        // No Stripe/Adyen configured — accept graceful outcomes
        ok("checkout responds (gateway-less)", !!checkout.data || !!checkout.error?.message, checkout.error ?? checkout.data);
      }
    }
  }

  {
    const ticket = await firmA.mutate("supportTickets.create", {
      subject: `QA ticket ${RUN_ID}`,
      body: "Automated QA support ticket — please ignore.",
      sensitivity: "low",
    });
    ok("firm creates support ticket", !ticket.error, ticket.error);
  }

  // ---------------------------------------------------------------- PHASE 6
  section("Phase 6 — Tenant isolation (Firm B)");
  const firmB = new Session();

  {
    const res = await firmB.mutate("signup.createFirmTrial", {
      firmName: `QA Firm B ${RUN_ID}`,
      contactName: "QA Owner B",
      email: `qa-ownerb-${RUN_ID}@example.com`,
      password: firmAPassword,
    });
    ok("second trial firm created", !!res.data?.firmId, res.error);

    const leak1 = await firmB.query("clients.get", { id: clientId });
    ok("firm B cannot read firm A client", !!leak1.error || !leak1.data, leak1.data);
    const leak2 = await firmB.query("cases.get", { id: caseId });
    ok("firm B cannot read firm A case", !!leak2.error || !leak2.data, leak2.data);
    const leak3 = await firmB.query("invoices.get", { id: invoiceId });
    ok("firm B cannot read firm A invoice", !!leak3.error || !leak3.data, leak3.data);
    const leak4 = await firmB.mutate("cases.addNote", { caseId, content: "cross-tenant write" });
    ok("firm B cannot write firm A case", !!leak4.error, leak4.data);

    const saDenied = await firmB.query("superadmin.listFirms");
    ok("firm admin cannot call superadmin procs", !!saDenied.error, saDenied.data);
  }

  // ---------------------------------------------------------------- PHASE 7
  if (SA_EMAIL && SA_PASSWORD) {
    section("Phase 7 — Superadmin");
    const sa = new Session();

    const wrongPortal = await sa.rest("/api/auth/login", { email: SA_EMAIL, password: SA_PASSWORD, portal: "app" });
    ok("superadmin blocked from firm portal", wrongPortal.status === 403, wrongPortal.status);
    const login = await sa.rest("/api/auth/login", { email: SA_EMAIL, password: SA_PASSWORD, portal: "platform" });
    ok("superadmin platform login", login.status === 200 && login.data?.redirectTo === "/superadmin", login.data);

    const firmsList = await sa.query("superadmin.listFirms");
    const allFirms = firmsList.data ?? [];
    ok("listFirms includes QA firms", allFirms.some((f: any) => (f.firm?.name ?? f.name ?? "").includes(`QA Firm ${RUN_ID}`)), firmsList.error ?? allFirms.length);

    const stats = await sa.query("superadmin.getStats");
    ok("platform stats", !stats.error, stats.error);
    const sysStatus = await sa.query("superadmin.getSystemStatus");
    ok("system status", !sysStatus.error, sysStatus.error);
    const settings = await sa.query("superadmin.getPlatformSettings");
    ok("platform settings readable", !settings.error, settings.error);
    ok("platform currencies configured", Array.isArray(settings.data?.supportedCurrencies) && settings.data.supportedCurrencies.length > 0, settings.data?.supportedCurrencies);

    const audit = await sa.query("superadmin.listAuditLog", {});
    ok("audit log readable", !audit.error, audit.error);
    const usersList = await sa.query("superadmin.listUsers", {});
    ok("platform users listable", !usersList.error, usersList.error);

    const tickets = await sa.query("superadmin.listSupportTickets", {});
    const allTickets = tickets.data?.tickets ?? tickets.data ?? [];
    const qaTicket = allTickets.find((t: any) => (t.subject ?? "").includes(`QA ticket ${RUN_ID}`));
    ok("QA support ticket visible to superadmin", !!qaTicket, tickets.error ?? allTickets.length);
    if (qaTicket) {
      const reply = await sa.mutate("superadmin.replySupportTicket", {
        ticketId: qaTicket.id,
        body: "QA reply from platform support.",
      });
      ok("superadmin replies to ticket", !reply.error, reply.error);
      const resolved = await sa.mutate("superadmin.updateSupportTicketStatus", {
        id: qaTicket.id,
        status: "resolved",
      });
      ok("ticket resolved", !resolved.error, resolved.error);
    }

    const platformLeads = await sa.query("leads.list", {});
    const leadRows = platformLeads.data?.leads ?? platformLeads.data ?? [];
    const qaLead = leadRows.find((l: any) => (l.email ?? "").includes(`qa-lead-${RUN_ID}`));
    ok("QA lead visible to superadmin", !!qaLead, platformLeads.error ?? leadRows.length);

    const ann = await sa.mutate("superadmin.createAnnouncement", {
      title: `QA announcement ${RUN_ID}`,
      body: "Automated QA — will be deleted.",
      severity: "info",
      audience: "firm_admins",
    });
    ok("create platform announcement", !ann.error, ann.error);
    const seen = await firmA.query("announcements.activeForMe");
    const seenRows = seen.data ?? [];
    const qaAnn = seenRows.find((a: any) => (a.title ?? "").includes(`QA announcement ${RUN_ID}`));
    ok("firm admin sees announcement", !!qaAnn, seen.error ?? seenRows.length);
    if (qaAnn) {
      const dismissed = await firmA.mutate("announcements.dismiss", { announcementId: qaAnn.id });
      ok("firm admin dismisses announcement", !dismissed.error, dismissed.error);
    }
    const annList = await sa.query("superadmin.listAnnouncements");
    const created = (annList.data ?? []).find((a: any) => (a.title ?? "").includes(`QA announcement ${RUN_ID}`));
    if (created) {
      const del = await sa.mutate("superadmin.deleteAnnouncement", { id: created.id });
      ok("delete QA announcement", !del.error, del.error);
    }

    // firm lifecycle from platform side
    const qaFirmRow = allFirms.find((f: any) => (f.firm?.name ?? f.name ?? "") === `QA Firm ${RUN_ID}`);
    const qaFirmId = qaFirmRow?.firm?.id ?? qaFirmRow?.id;
    if (qaFirmId) {
      const detail = await sa.query("superadmin.getFirmDetail", { firmId: qaFirmId });
      ok("firm detail from platform", !detail.error, detail.error);
      const suspended = await sa.mutate("superadmin.suspendFirm", { firmId: qaFirmId });
      ok("suspend firm", !suspended.error, suspended.error);
      const blocked = await firmA.query("clients.list", {});
      ok("suspended firm loses access", !!blocked.error, blocked.data);
      const reactivated = await sa.mutate("superadmin.reactivateFirm", { firmId: qaFirmId });
      ok("reactivate firm", !reactivated.error, reactivated.error);
    }
  } else {
    section("Phase 7 — Superadmin (SKIPPED: no QA_SUPERADMIN credentials)");
  }

  // ---------------------------------------------------------------- PHASE 8
  section("Phase 8 — Uploads (local storage backend)");
  {
    // Firm logo upload: 1×1 PNG
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const logoForm = new FormData();
    logoForm.append("file", new Blob([pngBytes], { type: "image/png" }), "qa-logo.png");
    logoForm.append("purpose", "logo");
    const logo = await firmA.upload("/api/upload", logoForm);
    ok("logo upload succeeds", logo.status === 200 && !!logo.data?.url, logo.data);
    if (logo.data?.url) {
      const fetched = await firmA.raw(logo.data.url, { method: "GET" });
      ok("uploaded logo is downloadable", fetched.status === 200, fetched.status);
    }

    // Case document upload: minimal PDF
    const pdfBytes = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF"
    );
    const docForm = new FormData();
    docForm.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "qa-doc.pdf");
    docForm.append("purpose", "document");
    const doc = await firmA.upload("/api/upload", docForm);
    ok("document upload succeeds", doc.status === 200 && !!doc.data?.url, doc.data);
    if (doc.data?.url) {
      const fetched = await firmA.raw(doc.data.url, { method: "GET" });
      ok("uploaded document is downloadable", fetched.status === 200, fetched.status);
    }
  }

  // ---------------------------------------------------------------- PHASE 9
  if (SA_EMAIL && SA_PASSWORD) {
    section("Phase 9 — Provisioned firm, forced password change, 2FA, impersonation");
    const sa = new Session();
    await sa.rest("/api/auth/login", { email: SA_EMAIL, password: SA_PASSWORD, portal: "platform" });

    // plan needed for provisioning
    let planId = 0;
    {
      const plans = await sa.query("superadmin.listPlans");
      planId = (plans.data ?? [])[0]?.id ?? 0;
      if (!planId) {
        await sa.mutate("superadmin.seedDefaultPlans");
        const again = await sa.query("superadmin.listPlans");
        planId = (again.data ?? [])[0]?.id ?? 0;
      }
      ok("subscription plan available", planId > 0, plans.error);
    }

    const provEmail = `qa-prov-${RUN_ID}@example.com`;
    let tempPassword = "";
    let provFirmId = 0;
    {
      const created = await sa.mutate("superadmin.createFirm", {
        name: `QA Provisioned ${RUN_ID}`,
        email: provEmail,
        ownerName: "QA Provisioned Owner",
        planId,
        sendCredentials: false,
        defaultCurrency: "CHF",
      });
      tempPassword = created.data?.temporaryPassword ?? "";
      provFirmId = created.data?.firmId ?? 0;
      ok("superadmin provisions firm", provFirmId > 0 && !!tempPassword, created.error ?? created.data);
    }

    const owner = new Session();
    if (tempPassword) {
      const login = await owner.rest("/api/auth/login", { email: provEmail, password: tempPassword });
      ok("owner logs in with temp password", login.status === 200 && login.data?.mustChangePassword === true, login.data);

      // Forced change WITHOUT re-entering the temp password (the previously fixed bug)
      const newPassword = `QaNew!${RUN_ID}zz`;
      const changed = await owner.rest("/api/auth/change-password", { newPassword });
      ok("forced password change without currentPassword", changed.status === 200 && changed.data?.ok, changed.data);

      await owner.rest("/api/auth/logout", {});
      const relogin = await owner.rest("/api/auth/login", { email: provEmail, password: newPassword });
      ok("owner logs in with new password", relogin.status === 200 && relogin.data?.mustChangePassword === false, relogin.data);
      const oldRejected = await owner.rest("/api/auth/login", { email: provEmail, password: tempPassword });
      ok("temp password no longer works", oldRejected.status === 401, oldRejected.status);

      // 2FA end-to-end with real TOTP codes
      const { TOTP, Secret } = await import("otpauth");
      const setup = await owner.mutate("auth.setupTotp");
      ok("2FA setup returns secret + QR", !!setup.data?.secret && !!setup.data?.qrDataUrl, setup.error);
      if (setup.data?.secret) {
        const totp = new TOTP({
          issuer: "Cliavo",
          label: provEmail,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: Secret.fromBase32(setup.data.secret),
        });
        const enabled = await owner.mutate("auth.enableTotp", { code: totp.generate() });
        ok("2FA enabled with valid code", !enabled.error, enabled.error);

        await owner.rest("/api/auth/logout", {});
        const loginWith2fa = await owner.rest("/api/auth/login", { email: provEmail, password: newPassword });
        ok("login flags requires2fa", loginWith2fa.data?.requires2fa === true, loginWith2fa.data);
        const me2fa = await owner.query("auth.me");
        ok("session requires 2FA before verify", me2fa.data?.requires2fa === true, me2fa.data);
        const badCode = await owner.mutate("auth.verifyTotp", { code: "000000" });
        ok("wrong TOTP code rejected", !!badCode.error, badCode.data);
        const verified = await owner.mutate("auth.verifyTotp", { code: totp.generate() });
        ok("valid TOTP code accepted", !verified.error, verified.error);
        const meOk = await owner.query("auth.me");
        ok("2FA satisfied after verify", meOk.data?.requires2fa === false, meOk.data);
        const disabled = await owner.mutate("auth.disableTotp", { code: totp.generate() });
        ok("2FA disabled", !disabled.error, disabled.error);
      }

      // locale
      const locale = await owner.mutate("auth.setLocale", { locale: "fr" });
      ok("set preferred locale", !locale.error, locale.error);
      const meFr = await owner.query("auth.me");
      ok("locale persisted", meFr.data?.preferredLocale === "fr", meFr.data?.preferredLocale);
    }

    // impersonation
    if (provFirmId) {
      const imp = await sa.mutate("superadmin.impersonateFirmAdmin", { firmId: provFirmId });
      ok("impersonate firm admin", !imp.error, imp.error);
      const meImp = await sa.query("auth.me");
      ok("impersonation session active", meImp.data?.impersonation?.active === true, meImp.data?.impersonation);
      const firmCall = await sa.query("firm.myFirm");
      ok("impersonated session can use firm APIs", !firmCall.error, firmCall.error);
      const stop = await sa.mutate("auth.stopImpersonation");
      ok("stop impersonation", !stop.error, stop.error);
      const meBack = await sa.query("auth.me");
      ok("superadmin session restored", meBack.data?.role === "superadmin", meBack.data?.role);
    }
  }

  // ---------------------------------------------------------------- summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("QA harness crashed:", err);
  process.exitCode = 2;
});
