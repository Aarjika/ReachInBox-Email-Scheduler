import { Client } from '@elastic/elasticsearch';
import { config } from './config';

export const es = new Client({ node: config.esUrl });
const INDEX = 'emails';

export async function initEs() {
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      await es.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'integer' },
            recipient: { type: 'text' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
    }
  } catch (e) {
    console.warn('[es] init failed (is Elasticsearch running?)', (e as Error).message);
  }
}

const toDoc = (r: any) => ({
  id: r.id,
  userId: r.user_id,
  recipient: r.recipient,
  subject: r.subject,
  body: r.body,
  status: r.status,
  scheduledAt: r.scheduled_at,
  sentAt: r.sent_at,
});

export async function indexEmails(rows: any[]) {
  if (!rows.length) return;
  try {
    const operations = rows.flatMap((r) => [{ index: { _index: INDEX, _id: r.id } }, toDoc(r)]);
    await es.bulk({ operations });
  } catch (e) {
    console.warn('[es] index failed', (e as Error).message);
  }
}

export async function searchEmails(userId: number, q: string) {
  const r = await es.search({
    index: INDEX,
    size: 50,
    query: {
      bool: {
        filter: [{ term: { userId } }],
        must: q
          ? [{ multi_match: { query: q, fields: ['recipient', 'subject', 'body', 'status'] } }]
          : [{ match_all: {} }],
      },
    },
  });
  return r.hits.hits.map((h) => h._source);
}
