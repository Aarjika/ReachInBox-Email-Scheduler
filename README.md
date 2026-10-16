# ReachInbox – Email Job Scheduler (Backend + Dashboard)
 
## Title and Description

ReachInbox is a local-development email scheduling application built around a simple idea: scheduling email delivery should be manageable, observable, and resilient to routine process restarts.

The application lets an authenticated user compose an email, provide recipients directly or through a CSV list, choose a start time and delay between recipients, and monitor scheduled and completed or failed messages. A background worker processes jobs through BullMQ and Redis, while PostgreSQL stores application records Elasticsearch provides text search over indexed email fields.

## Quick start

```bash
docker compose up -d                      # Postgres, Redis, Elasticsearch
cd backend && cp .env.example .env        # fill GOOGLE_* and SLACK_* values
npm install && npm run dev                # API + worker on :4000
cd ../frontend && cp .env.example .env
npm install && npm run dev                # dashboard on :5173
```
BullMQ live dashboard: http://localhost:4000/admin/queues

## Demo link: will be updated in an hour

## Screenshots: https://drive.google.com/drive/folders/1DFttJ0A4oKq7S8khfLzjPrL6AxS1u355?usp=sharing

## Architecture

1. **Scheduling:** `POST /api/emails/schedule` stores one row per recipient in Postgres (`status=scheduled`) and adds one **BullMQ delayed job** per row (`delay = scheduled_at - now`). Email *i* is scheduled at `start + i * delay`. No cron anywhere.
2. **Senders:** `SENDER_COUNT` Ethereal accounts are created once on first boot and stored in the DB. Emails are assigned round-robin.
3. **Persistence on restart:** delayed jobs live in Redis (AOF enabled in docker-compose) and the source of truth is Postgres. On boot, `reconcile()` re-adds all `scheduled` rows with `jobId = email id`; BullMQ ignores ids that already exist, so nothing is duplicated or restarted.
4. **Idempotency:** (1) `jobId = email id` so the same email can't be queued twice; (2) the worker atomically does `UPDATE ... SET status='sending' WHERE status='scheduled'` – only one worker can win, a second attempt is skipped.
5. **Concurrency:** `WORKER_CONCURRENCY` (default 5) parallel jobs per worker process.
6.  **Delay between sends:** BullMQ limiter `{max:1, duration: MIN_DELAY_BETWEEN_EMAILS_MS}` → **min 2 seconds between sends** by default (global across workers, storein Redis).
7. **Hourly limit:** Redis counter `rl:{senderId}:{hourWindow}` (`INCR`, expires after 2h) shared by all workers/instances. Limit = value entered in the Compose form(falls back to `MAX_EMAILS_PER_HOUR_PER_SENDER`). When exceeded the counter is rolled back and the job is **moved to the start of the next hour window** with `job.moveToDelayed` – never dropped or failed. Order is preserved as far as possible (same timestamp → BullMQ keeps insertion order).
8. **Behaviour under load (1000+ at once):** jobs become due together; the limiter spaces sends 2s apart, concurrency keeps workers busy, each sender stops at its hourly cap and the surplus rolls into following hours automatically.
9. **Slack:** "Connect Slack" runs Slack OAuth v2 (`incoming-webhook` scope); the webhook URL is stored per user. When a sender first hits its limit in an hour, a real message is POSTed to that webhook (once per sender per hour). Not connected → silently skipped; connecting later works immediately (webhook is read at hit time).
10. **Elasticsearch:** every email is indexed on schedule and re-indexed on sent/failed. Search: `GET /api/emails/search?q=text` (logged-in session).
11. **Auth:** real Google OAuth; JWT in an httpOnly cookie.

## Features

1. **Email scheduling:** Schedule an email for a future time and stagger recipient delivery with a configurable delay.
2. **Recipient lists:** Upload a CSV list and review the detected email-address count in the compose workflow.
3. **Background processing:** BullMQ and Redis handle delayed jobs outside the HTTP request lifecycle.
4. **Persistent records:** PostgreSQL stores users, email records, sender configuration, and attachment data.
5. **Queue recovery:** On startup, scheduled records are reconciled with the queue using stable job IDs.
6. **Sending limits:** Apply a per-sender hourly limit and a configurable minimum interval between sends.
7. **Sender distribution:** Assign recipients to configured senders in round-robin order.
8. **Search:** Index email recipient, subject, body, status, and timestamps in Elasticsearch and search records through the authenticated API.
9. **Authentication:** Sign in with Google OAuth or use the email/password flow.
10. **Slack notifications:** Optionally connect a Slack incoming webhook to receive hourly-limit notifications.
11. **Attachments:** Attach up to five files, with a 10 MB per-file and 25 MB total limit.
12. **Email preview/testing:** Ethereal is the default mail transport when real SMTP settings are not configured.
13. **Optional real SMTP:** Configure an SMTP provider to test actual delivery to real inboxes.
14. **Queue visibility:** Bull Board exposes the BullMQ queue dashboard at `/admin/queues`.
15. **Email status views:** Review scheduled, sent, and failed records from the dashboard.

> **Important:** Ethereal is a testing service. Messages sent through Ethereal are captured for preview and are not delivered to recipients' real inboxes. Real delivery requires a properly configured SMTP provider.

**TechStack**

1. **Frontend**
   Technology: React 18, TypeScript, Vite, Purpose: Dashboard and compose interface
2. **Styling**
   Technology: Tailwind CSS 4, Purpose: UI styling and design tokens
3. **Backend**
   Technology: Node.js, Express 4, TypeScript, Purpose: HTTP API and application logic
4. **Database**
   Technology: PostgreSQL 16, Purpose: Users, email records, senders, attachments
5. **Queue and cache**
   Technology: Redis 7, BullMQ 5, Purpose: Delayed jobs, worker coordination, rate counters
6. **Search**
   Technology: Elasticsearch 8, Purpose: Full-text email search
7. **Authentication**
   Technology: Google OAuth, JWT, HTTP-only cookie, Purpose: User sign-in and session cookie
8. **Email transport**
   Technology: Nodemailer, Ethereal SMTP, optional SMTP provider, Purpose: Message delivery/testing
9. **Notifications**
   Technology: Slack OAuth v2 and incoming webhooks, Purpose: Hourly-limit notifications
10. **Local infrastructure**
   Technology: Docker Compose, Purpose: PostgreSQL, Redis, Elasticsearch


## Scheduling lifecycle

1.  The authenticated API validates the request and normalizes recipient addresses.
2.  Each unique recipient is stored as an email record in PostgreSQL.
3.  A delayed BullMQ job is created for each record.
4.  The worker waits until a job is due, checks sending limits, and claims the email record.
5.  Nodemailer sends the message using the configured transport.
6.  The record status is updated and the search index is refreshed.
7.  If the per-sender hourly limit has been reached, the job is deferred rather than intentionally discarded.

## Reliability notes

1.  Redis uses append-only persistence in the supplied Docker Compose configuration.
2.  PostgreSQL remains the source of truth for scheduled email records.
3.  Startup reconciliation re-adds records that remain marked `scheduled`.
4.  A conditional database status update prevents multiple workers from claiming the same scheduled record simultaneously.

These mechanisms improve resilience but are not a guarantee of exactly-once email delivery. A process failure during an external SMTP operation can leave uncertainty about whether a recipient received a message. Production-grade delivery would need additional recovery and observability controls.


## Installation

## Prerequisites

Install the following before starting:

1. **Node.js 20 or 22 LTS** and npm
2. **Docker Desktop** with Docker Compose
3. **Git** (if cloning after a repository is created)
4.  A Google Cloud project with OAuth credentials for Google sign-in
5.  A Slack app with incoming-webhook permission if Slack notifications are needed

Elasticsearch needs additional memory. Allocate at least 4 GB to Docker Desktop if possible.


``` bash
git clone https://github.com/Aarjika/ReachInbox.git
cd reachinbox
```

## Start infrastructure

From the project root --- the folder containing `docker-compose.yml` ---
run:

``` bash
docker compose up -d
docker compose ps
```

## Configure the backend

In a terminal at the project root:

``` bash
cd backend
```

Create the local environment file:

**Windows PowerShell**

``` powershell
Copy-Item .env.example .env
```

**macOS/Linux**

``` bash
cp .env.example .env
```

Edit `backend/.env`. At minimum, set a long random `JWT_SECRET`. Add Google OAuth credentials if you intend to use Google sign-in. Add Slack credentials only if you want Slack notifications.

Install dependencies and start the API/worker:

``` bash
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default.

## Configure the frontend

Open a second terminal from the project root:

``` bash
cd frontend
```

Create the environment file:

**Windows PowerShell**

``` powershell
Copy-Item .env.example .env
```

**macOS/Linux**

``` bash
cp .env.example .env
```

Install dependencies and start Vite:

``` bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run Locally

After completing the installation steps, the usual development workflow uses three terminals.

**Terminal 1 --- Infrastructure** (from the project root):

``` bash
docker compose up -d
```

**Terminal 2 --- Backend API and worker:**

``` bash
cd backend
npm run dev
```

**Terminal 3 --- Frontend:**

``` bash
cd frontend
npm run dev
```

Useful local URLs:

  Service                      URL
  ---------------------------- ------------------------------------
  Frontend                     http://localhost:5173
  Backend                      http://localhost:4000
  Bull Board queue dashboard   http://localhost:4000/admin/queues
  Elasticsearch                http://localhost:9200
  PostgreSQL                   `localhost:5432`
  Redis                        `localhost:6379`

## Schedule an email through the API

The schedule endpoint expects an authenticated session cookie. It creates one email record and one delayed queue job per unique recipient.

Example request:

``` http
POST /api/emails/schedule
Content-Type: application/json
Cookie: token=<session-cookie>
```

``` json
{
  "subject": "A quick update",
  "body": "Hello! This is a scheduled message.",
  "recipients": [
    "alex@example.com",
    "sam@example.com"
  ],
  "startTime": "2026-12-01T10:00:00.000Z",
  "delaySeconds": 2,
  "hourlyLimit": 50,
  "attachments": []
}
Example response:
json
{
  "scheduled": 2
}
```

### Known trade-offs and limitations

1.  Elasticsearch initialization and indexing errors are logged, but indexing failures do not currently have a durable retry/reconciliation mechanism.
2.  The worker can leave an email marked `sending` if a process fails at an unfortunate point in the send lifecycle.
3.  The rate-limit counter uses increment/decrement operations rather than a single atomic Lua script, so edge-case races are possible.
4.  The Bull Board UI is not independently protected by authentication in the current implementation.
5.  The Google OAuth flow should receive a production security review, including state/CSRF handling.
6.  A job claim helps avoid concurrent sends, but cannot guarantee exactly-once delivery when the SMTP outcome is uncertain.
7.  The supplied Docker Compose configuration is intentionally configured for local development and should not be used as a public production configuration.


## Acknowledgements

1.  **Outbox Labs** for providing the project assignment.
2.  The maintainers of the open-source technologies used in this project.
3.  The documentation teams behind Node.js, React, TypeScript, PostgreSQL, Redis, BullMQ, and Elasticsearch.


## License

The project is intended to use the **MIT License**.


## Feedback

Feedback and suggestions are welcome.

-   GitHub: [@Aarjika](https://github.com/Aarjika)
-   LinkedIn: [Aarjika
    Lahiri](https://www.linkedin.com/in/aarjika-lahiri-471129281/)
