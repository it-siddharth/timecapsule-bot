# timecapsule-bot

Bridges a private Telegram bot to the [Time Capsule](https://it-siddharth.github.io) feed.

An hourly GitHub Action safety trigger starts a 5.5-hour Telegram long-polling
worker. Each completed worker dispatches its own successor, while the cron
trigger recovers the chain if a run is manually cancelled. This avoids depending
on GitHub's best-effort cron timing for each individual message.

The bridge delegates update processing to `scripts/telegram-feed.mjs` in the
`Timecapsule` repository, then pushes new feed entries and photos back to that
repository. The shared processor handles new messages, photo albums, edited
messages, `/delete` replies, and explicit `delete <feed-id>` commands. Telegram
updates are acknowledged only after the corresponding commit is pushed.

Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TIMECAPSULE_DEPLOY_KEY`.
No message content or credentials live in this repo.
