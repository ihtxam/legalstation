#!/usr/bin/env tsx
import "dotenv/config";
import { seedDemoData, DEMO_USERS } from "../server/demo/seedDemo";

async function main() {
  const result = await seedDemoData();
  console.log("[seed-demo] OK");
  console.log(JSON.stringify({ ...result, demoEmails: DEMO_USERS.map((u) => u.email) }, null, 2));
}

main()
  .catch((err) => {
    console.error("[seed-demo] failed:", err);
    process.exit(1);
  })
  .finally(() => {
    // drizzle/mysql2 keeps the event loop alive
    process.exit(0);
  });
