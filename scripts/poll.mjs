// Performs one Telegram long-poll and delegates all update handling to the
// canonical processor in the checked-out Timecapsule repository.
import path from "node:path";
import { spawnSync } from "node:child_process";

const BOT = process.env.BOT_TOKEN;
const CHAT = process.env.CHAT_ID;
const CAPSULE = process.env.CAPSULE_DIR || "capsule";
const OFFSET = process.env.TELEGRAM_OFFSET;
const TIMEOUT = Math.min(Math.max(Number(process.env.TELEGRAM_POLL_TIMEOUT || 50), 0), 50);
const API_BASE = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";

if (!BOT || !CHAT) {
  console.error("BOT_TOKEN and CHAT_ID must be set");
  process.exit(1);
}

const url = new URL(`${API_BASE}/bot${BOT}/getUpdates`);
url.searchParams.set("timeout", String(TIMEOUT));
url.searchParams.set("allowed_updates", JSON.stringify(["message", "edited_message"]));
if (OFFSET && /^\d+$/.test(OFFSET)) url.searchParams.set("offset", OFFSET);

const response = await fetch(url);
const payload = await response.json();
if (!response.ok || !payload.ok) {
  console.error("getUpdates failed:", payload.description || response.status);
  process.exit(1);
}

if (payload.result.length === 0) {
  console.log("no new messages");
  console.log("MAX_UPDATE_ID=0");
  process.exit(0);
}

const handler = path.join(CAPSULE, "scripts", "telegram-feed.mjs");
const child = spawnSync(process.execPath, [handler, "apply-batch", "-"], {
  input: JSON.stringify(payload),
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  env: {
    ...process.env,
    TELEGRAM_BOT_TOKEN: BOT,
    TELEGRAM_CHAT_ID: CHAT,
  },
});

if (child.stdout) process.stdout.write(child.stdout);
if (child.stderr) process.stderr.write(child.stderr);
if (child.status !== 0) process.exit(child.status || 1);
