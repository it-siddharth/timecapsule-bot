// Polls a Telegram bot for new messages and writes them as Time Capsule feed
// entries into a local clone of the Timecapsule repo. Stateless: entries are
// named by Telegram update_id, so already-committed messages are skipped and
// no offset file is needed. The workflow acks Telegram only after a
// successful push, so nothing is lost if a run fails mid-way.
import fs from "node:fs";
import path from "node:path";

const BOT = process.env.BOT_TOKEN;
const CHAT = process.env.CHAT_ID;
const CAPSULE = process.env.CAPSULE_DIR || "capsule";
const API = `https://api.telegram.org/bot${BOT}`;

if (!BOT || !CHAT) {
  console.error("BOT_TOKEN and CHAT_ID must be set");
  process.exit(1);
}

const res = await fetch(`${API}/getUpdates?timeout=0`);
const data = await res.json();
if (!data.ok) {
  console.error("getUpdates failed:", JSON.stringify(data));
  process.exit(1);
}

const updates = data.result;
if (updates.length === 0) {
  console.log("no new messages");
  console.log("MAX_UPDATE_ID=0");
  process.exit(0);
}

const maxId = Math.max(...updates.map((u) => u.update_id));

const mine = updates
  .filter((u) => u.message && String(u.message.chat.id) === String(CHAT))
  .map((u) => ({ id: u.update_id, m: u.message }))
  .filter((x) => x.m.text || x.m.caption || x.m.photo);

// Photo albums arrive as separate messages sharing a media_group_id; merge
// each album into a single feed entry.
const groups = new Map();
for (const x of mine) {
  const key = x.m.media_group_id ? `g${x.m.media_group_id}` : `u${x.id}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(x);
}

const feedDir = path.join(CAPSULE, "content", "feed");
const imgDir = path.join(CAPSULE, "public", "feed", "img");
fs.mkdirSync(feedDir, { recursive: true });
fs.mkdirSync(imgDir, { recursive: true });

let wrote = 0;
for (const group of groups.values()) {
  group.sort((a, b) => a.id - b.id);
  const entryPath = path.join(feedDir, `tg-${group[0].id}.json`);
  if (fs.existsSync(entryPath)) continue;

  const body = group
    .map((x) => x.m.text || x.m.caption || "")
    .filter(Boolean)
    .join("\n\n");

  const images = [];
  for (const x of group) {
    if (!x.m.photo) continue;
    const best = x.m.photo[x.m.photo.length - 1];
    const fileRes = await (await fetch(`${API}/getFile?file_id=${best.file_id}`)).json();
    if (!fileRes.ok) {
      console.error("getFile failed:", JSON.stringify(fileRes));
      process.exit(1);
    }
    const ext = path.extname(fileRes.result.file_path) || ".jpg";
    const name = `tg-${x.id}${ext}`;
    const bin = await fetch(`https://api.telegram.org/file/bot${BOT}/${fileRes.result.file_path}`);
    fs.writeFileSync(path.join(imgDir, name), Buffer.from(await bin.arrayBuffer()));
    images.push(`/feed/img/${name}`);
  }

  const entry = {
    timestamp: new Date(group[0].m.date * 1000).toISOString(),
    body,
    images,
  };
  fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2) + "\n");
  console.log(`wrote ${entryPath} (${images.length} image(s))`);
  wrote += 1;
}

console.log(`${wrote} new entr${wrote === 1 ? "y" : "ies"}`);
console.log(`MAX_UPDATE_ID=${maxId}`);
