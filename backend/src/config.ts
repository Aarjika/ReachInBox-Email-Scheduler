import 'dotenv/config';

const num = (key: string, def: number) => Number(process.env[key] ?? def);
const str = (key: string, def = '') => process.env[key] ?? def;

export const config = {
  port: num('PORT', 4000),
  frontendUrl: str('FRONTEND_URL', 'http://localhost:5173'),
  backendUrl: str('BACKEND_URL', 'http://localhost:4000'),
  jwtSecret: str('JWT_SECRET', 'dev-secret'),
  databaseUrl: str('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/reachinbox'),
  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),
  esUrl: str('ELASTICSEARCH_URL', 'http://localhost:9200'),
  workerConcurrency: num('WORKER_CONCURRENCY', 5),
  minDelayMs: num('MIN_DELAY_BETWEEN_EMAILS_MS', 2000),
  maxEmailsPerHourPerSender: num('MAX_EMAILS_PER_HOUR_PER_SENDER', 50),
  senderCount: num('SENDER_COUNT', 3),
  // Optional real SMTP provider. Leave SMTP_HOST empty to keep using Ethereal (fake SMTP).
  smtp: {
    host: str('SMTP_HOST'),
    port: num('SMTP_PORT', 587),
    secure: str('SMTP_SECURE', 'false') === 'true',
    user: str('SMTP_USER'),
    pass: str('SMTP_PASS'),
    from: str('SMTP_FROM'),
  },
  google: { clientId: str('GOOGLE_CLIENT_ID'), clientSecret: str('GOOGLE_CLIENT_SECRET') },
  slack: {
    clientId: str('SLACK_CLIENT_ID'),
    clientSecret: str('SLACK_CLIENT_SECRET'),
    redirectUri: str('SLACK_REDIRECT_URI', `${str('BACKEND_URL', 'http://localhost:4000')}/auth/slack/callback`),
  },
};
