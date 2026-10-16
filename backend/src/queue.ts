import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';

export const QUEUE_NAME = 'email-queue';

// BullMQ requires maxRetriesPerRequest: null for blocking connections
export const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const emailQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 },
});

export interface EmailJobData {
  emailId: string;
  userId: number;
  senderId: number;
  hourlyLimit: number;
}

// jobId = emailId -> adding the same email twice is ignored (idempotent)
export const toJob = (d: EmailJobData, scheduledAt: Date) => ({
  name: 'send-email',
  data: d,
  opts: { jobId: d.emailId, delay: Math.max(0, scheduledAt.getTime() - Date.now()) },
});
