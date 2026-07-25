import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";
import { storagePut } from "../storage";
import { getStripe } from "../stripe";
import { getDb } from "../db";
import { invoices } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
// `and` used by Stripe webhook firm-scoped paid updates
import { processDuePaymentPlanInstallments } from "../paymentPlanInvoices";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // File upload endpoint (enforces firm upload policy when session is present)
  const { UPLOAD_HARD_MAX_BYTES, validateUploadFile, formatBytes } = await import(
    "../../shared/uploadPolicy"
  );
  const { resolveUploadPolicyFromRequest } = await import("../uploadPolicyResolve");
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_HARD_MAX_BYTES },
  });
  app.post("/api/upload", (req: any, res: any, next: any) => {
    upload.single("file")(req, res, (err: any) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: `File is too large. Maximum size is ${formatBytes(UPLOAD_HARD_MAX_BYTES)}.`,
          code: "FILE_TOO_LARGE",
          maxBytes: UPLOAD_HARD_MAX_BYTES,
        });
      }
      if (err) {
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const purpose = String(req.body?.purpose || "document");
      // Firm logos: allow common image types up to 5MB (separate from document policy)
      if (purpose === "logo") {
        const mime = String(req.file.mimetype || "").toLowerCase();
        if (!mime.startsWith("image/")) {
          return res.status(400).json({
            error: "Logo must be an image file (PNG, JPEG, GIF, or WebP).",
            code: "FILE_TYPE_NOT_ALLOWED",
          });
        }
        if (req.file.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            error: "Logo is too large. Maximum size is 5 MB.",
            code: "FILE_TOO_LARGE",
            maxBytes: 5 * 1024 * 1024,
          });
        }
      } else {
        const policy = await resolveUploadPolicyFromRequest(req);
        const check = validateUploadFile({
          fileName: req.file.originalname || "file",
          mimeType: req.file.mimetype,
          size: req.file.size,
          policy,
        });
        if (!check.ok) {
          return res.status(400).json({
            error: check.message,
            code: check.code,
            maxBytes: policy.maxUploadBytes,
            allowedExtensions: policy.allowedExtensions,
          });
        }
      }
      const key = `documents/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const result = await storagePut(key, req.file.buffer, req.file.mimetype);
      res.json(result);
    } catch (err: any) {
      console.error("[Upload]", err);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  const { registerDemoAuthRoutes } = await import("../demo/demoAuth");
  registerDemoAuthRoutes(app);

  const { registerPasswordAuthRoutes } = await import("../auth/passwordAuth");
  registerPasswordAuthRoutes(app);

  // Scheduled jobs (heartbeat / cron). Path convention: /api/scheduled/*
  app.post("/api/scheduled/payment-plan-invoices", async (req, res) => {
    try {
      const secret = process.env.SCHEDULED_JOB_SECRET || ENV.cookieSecret;
      const provided =
        req.get("x-scheduled-job-secret") ||
        (typeof req.query.secret === "string" ? req.query.secret : undefined);
      if (secret && provided !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // System actor: use OWNER user id 0 semantics — pass 1 as fallback creator
      const createdByUserId = Number(process.env.SCHEDULED_JOB_USER_ID || 1);
      const result = await processDuePaymentPlanInstallments(createdByUserId);
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[Scheduled] payment-plan-invoices", err);
      return res.status(500).json({ error: err.message ?? "Job failed" });
    }
  });

  // Stripe webhook — must be raw body BEFORE json middleware
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: any, res: any) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const stripe = getStripe();
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret ?? "");
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        const invoiceId = session.metadata?.invoiceId;
        const firmId = session.metadata?.firmId;
        if (invoiceId) {
          const db = await getDb();
          if (db) {
            const id = parseInt(invoiceId, 10);
            if (firmId) {
              await db
                .update(invoices)
                .set({ status: "paid", paidAt: new Date() })
                .where(and(eq(invoices.id, id), eq(invoices.firmId, parseInt(firmId, 10))));
            } else {
              await db.update(invoices).set({ status: "paid", paidAt: new Date() }).where(eq(invoices.id, id));
            }
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("[Stripe Webhook]", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  // Adyen webhook (notification JSON). Verify HMAC when ADYEN_HMAC_KEY is set.
  app.post("/api/adyen/webhook", express.json(), async (req: any, res: any) => {
    try {
      const { verifyAdyenWebhookSignature, handleAdyenWebhookEvent } = await import("../adyen");
      const hmacKey = process.env.ADYEN_HMAC_KEY || "";
      const signature =
        req.get("hmacsignature") ||
        req.get("x-adyen-signature") ||
        req.body?.additionalData?.hmacSignature ||
        "";
      const raw = JSON.stringify(req.body ?? {});
      if (hmacKey && !verifyAdyenWebhookSignature(raw, signature, hmacKey)) {
        return res.status(401).json({ error: "Invalid HMAC signature" });
      }
      const notificationItems = req.body?.notificationItems || [{ NotificationRequestItem: req.body }];
      const db = await getDb();
      for (const wrapper of notificationItems) {
        const item = wrapper.NotificationRequestItem || wrapper;
        const handled = handleAdyenWebhookEvent({
          type: item.eventCode === "AUTHORISATION" && item.success === "true" ? "payment" : item.eventCode,
          originalReference: item.merchantReference,
        });
        if (handled?.action === "updateInvoiceStatus" && handled.reference && db) {
          const match = String(handled.reference).match(/INV-(\d+)/i);
          if (match) {
            await db
              .update(invoices)
              .set({ status: "paid", paidAt: new Date() })
              .where(eq(invoices.id, parseInt(match[1], 10)));
          }
        }
      }
      return res.json({ notificationResponse: "[accepted]" });
    } catch (err: any) {
      console.error("[Adyen Webhook]", err);
      return res.status(500).json({ error: err.message ?? "Webhook failed" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./viteDev");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
