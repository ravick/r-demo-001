# Guestbook

One-page guestbook (name + short message, newest first) storing entries in SQLite.

- `npm install && npm start` (port from `PORT`, default 3000)
- Database: `$BLACKTOPS_APP_DATA_DIR/guestbook.db` (`./.data` when unset), WAL mode, schema created at start
- `/data-info` shows the database path and entry count; `/health` returns 200
- Limits: name 1-50, message 1-500 characters
