import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { initDb, pool } from './db';
import { initEs } from './es';
import { ensureSenders } from './senders';
import { emailQueue, toJob } from './queue';
import { startWorker } from './worker';
import { authRouter } from './auth';
import { apiRouter } from './routes';

// On every boot, re-enqueue emails still marked "scheduled". Same jobId => BullMQ ignores
// jobs that already exist, so this only restores jobs if Redis lost data. No duplicates.
async function reconcile() {
  const { rows } = await pool.query(`SELECT * FROM emails WHERE status='scheduled'`);
  if (!rows.length) return;
  await emailQueue.addBulk(
    rows.map((r) =>
      toJob({ emailId: r.id, userId: r.user_id, senderId: r.sender_id, hourlyLimit: r.hourly_limit }, new Date(r.scheduled_at)),
    ),
  );
  console.log(`[boot] reconciled ${rows.length} scheduled emails`);
}

async function main() {
  await initDb();
  await initEs();
  await ensureSenders();
  await reconcile();
  startWorker();

  const app = express();
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '60mb' }));
  app.use(cookieParser());

  // Live BullMQ dashboard
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter });
  app.use('/admin/queues', serverAdapter.getRouter());

  app.use('/auth', authRouter);
  app.use('/api', apiRouter);

  app.listen(config.port, () => console.log(`[api] http://localhost:${config.port}  (queue UI: /admin/queues)`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
