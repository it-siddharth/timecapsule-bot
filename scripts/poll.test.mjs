import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pollScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "poll.mjs");

test("long-polls for message and edit updates and delegates the full batch", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-poll-test-"));
  const scripts = path.join(root, "scripts");
  fs.mkdirSync(scripts, { recursive: true });
  fs.writeFileSync(
    path.join(scripts, "telegram-feed.mjs"),
    `let body=""; for await (const chunk of process.stdin) body += chunk;\n
     const payload=JSON.parse(body);\n
     if (process.env.TELEGRAM_BOT_TOKEN !== "token" || process.env.TELEGRAM_CHAT_ID !== "42") process.exit(2);\n
     console.log(JSON.stringify({received: payload.result.length}));\n
     console.log("MAX_UPDATE_ID=77");\n`,
  );

  let requestedUrl;
  const server = http.createServer((request, response) => {
    requestedUrl = new URL(request.url, "http://localhost");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true, result: [{ update_id: 77, message: { message_id: 7 } }] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const child = spawn(process.execPath, [pollScript], {
    env: {
      ...process.env,
      BOT_TOKEN: "token",
      CHAT_ID: "42",
      CAPSULE_DIR: root,
      TELEGRAM_OFFSET: "70",
      TELEGRAM_POLL_TIMEOUT: "0",
      TELEGRAM_API_BASE: `http://127.0.0.1:${server.address().port}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const status = await new Promise((resolve) => child.on("close", resolve));
  server.close();

  assert.equal(status, 0, stderr);
  assert.match(stdout, /MAX_UPDATE_ID=77/);
  assert.equal(requestedUrl.searchParams.get("offset"), "70");
  assert.deepEqual(JSON.parse(requestedUrl.searchParams.get("allowed_updates")), ["message", "edited_message"]);
});
