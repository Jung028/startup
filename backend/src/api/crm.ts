import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireRole } from '../auth/authMiddleware';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';

export const crmRouter = Router();

// GET /crm/status - connection health
crmRouter.get('/status', async (req: Request, res: Response) => {
  const org = await query('SELECT crm_provider, crm_config FROM organizations WHERE id = $1', [req.user!.organizationId]);
  res.json({ provider: org[0]?.crm_provider || 'none', connected: !!org[0]?.crm_provider });
});

// POST /crm/zendesk/sync - pull tickets from Zendesk
crmRouter.post('/zendesk/sync', requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { subdomain, email, token } = req.body;

  try {
    const response = await fetch(
      `https://${subdomain}.zendesk.com/api/v2/tickets.json?status=open&sort_by=created_at&sort_order=desc&per_page=50`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}/token:${token}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) throw new AppError(400, `Zendesk API error: ${response.statusText}`);

    const data: any = await response.json();
    const tickets = data.tickets || [];

    // Normalize and insert
    let ingested = 0;
    for (const t of tickets) {
      const [existing] = await query(
        'SELECT id FROM tickets WHERE external_id = $1 AND organization_id = $2',
        [String(t.id), req.user!.organizationId]
      );
      if (!existing) {
        await query(
          `INSERT INTO tickets (organization_id, external_id, crm_provider, subject, body, channel, priority, requester_email)
           VALUES ($1, $2, 'zendesk', $3, $4, 'email', $5, $6)`,
          [req.user!.organizationId, String(t.id), t.subject, t.description, mapZendeskPriority(t.priority), t.requester?.email]
        );
        ingested++;
      }
    }

    res.json({ synced: tickets.length, new: ingested });
  } catch (error) {
    throw new AppError(500, `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// POST /crm/webhook - receive real-time CRM webhooks
crmRouter.post('/webhook/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params;
  const payload = req.body;

  // Process based on provider
  switch (provider) {
    case 'zendesk':
      await processZendeskWebhook(payload, req.user!.organizationId);
      break;
    case 'intercom':
      await processIntercomWebhook(payload, req.user!.organizationId);
      break;
    default:
      throw new AppError(400, `Unknown CRM provider: ${provider}`);
  }

  res.json({ received: true });
});

// GET /crm/knowledge-base - list KB docs
crmRouter.get('/knowledge-base', async (req: Request, res: Response) => {
  const docs = await query(
    `SELECT id, title, doc_type, tags, is_active, created_at
     FROM knowledge_base WHERE organization_id = $1 ORDER BY created_at DESC`,
    [req.user!.organizationId]
  );
  res.json(docs);
});

// POST /crm/knowledge-base - add KB doc
crmRouter.post('/knowledge-base', requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { title, content, doc_type, tags } = req.body;

  const [doc] = await query<any>(
    `INSERT INTO knowledge_base (organization_id, title, content, doc_type, tags)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user!.organizationId, title, content, doc_type || 'article', tags || []]
  );

  // Trigger async vector embedding (in production use queue)
  setImmediate(async () => {
    try {
      const { upsertDocument } = await import('../services/ragService');
      await upsertDocument(req.user!.organizationId, doc);
      await query('UPDATE knowledge_base SET vector_id = $1 WHERE id = $2', [doc.id, doc.id]);
    } catch (err) {
      console.error('Vector embedding failed:', err);
    }
  });

  res.status(201).json(doc);
});

// Helpers
function mapZendeskPriority(p: string): string {
  const map: Record<string, string> = { urgent: 'critical', high: 'high', normal: 'medium', low: 'low' };
  return map[p] || 'medium';
}

async function processZendeskWebhook(payload: any, orgId: string): Promise<void> {
  const t = payload.ticket;
  if (!t) return;
  await query(
    `INSERT INTO tickets (organization_id, external_id, crm_provider, subject, body, channel, priority)
     VALUES ($1, $2, 'zendesk', $3, $4, 'email', $5)
     ON CONFLICT DO NOTHING`,
    [orgId, String(t.id), t.subject, t.description, mapZendeskPriority(t.priority)]
  );
}

async function processIntercomWebhook(payload: any, orgId: string): Promise<void> {
  const conv = payload.data?.item;
  if (!conv) return;
  await query(
    `INSERT INTO tickets (organization_id, external_id, crm_provider, subject, body, channel)
     VALUES ($1, $2, 'intercom', $3, $4, 'chat')
     ON CONFLICT DO NOTHING`,
    [orgId, conv.id, conv.source?.subject || 'Chat conversation', conv.source?.body || '']
  );
}
