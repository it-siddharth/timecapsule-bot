# timecapsule-bot

Bridges a private Telegram bot to the [Time Capsule](https://it-siddharth.github.io) feed.

Every 10 minutes, a GitHub Action polls the bot for new messages from Siddharth's
chat, converts them into feed entries (`content/feed/tg-*.json`, photos in
`public/feed/img/`), and pushes them to the `Timecapsule` repo — which triggers
its own build-and-deploy workflow.

Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TIMECAPSULE_DEPLOY_KEY`.
No message content or credentials live in this repo.
