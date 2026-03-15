import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { enqueueTicket } from '../queues/ticketProcessor';
import { requireRole } from '../auth/authMiddleware';
import { AppError } from '../middleware/errorHandler';
import { CreateTicketRequest, TicketReviewRequest } from '../types';

export const ticketRouter = Router();

// Validation schemas
const createTicketSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  channel: z.enum(['email', 'chat', 'form', 'api']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  requester_email: z.string().email().optional(),
  requester_name: z.string().optional(),
  external_id: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

const reviewSchema = z.object({
  action: z.enum(['approve', 'edit', 'reject', 'escalate']),
  edited_response: z.string().optional(),
  rejection_reason: z.string().optional(),
  quality_score: z.number().min(1).max(5).optional(),
});

// GET /tickets - list tickets with filters
ticketRouter.get('/', async (req: Request, res: Response) => {
  const { status, priority, page = '1', limit = '20', search } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const orgId = req.user!.organizationId;

  let whereClause = 'WHERE t.organization_id = $1';
  const params: any[] = [orgId];
  let paramIdx = 2;

  if (status) {
    whereClause += ` AND t.status = $${paramIdx++}`;
    params.push(status);
  }
  if (priority) {
    whereClause += ` AND t.priority = $${paramIdx++}`;
    params.push(priority);
  }
  if (search) {
    whereClause += ` AND (t.subject ILIKE $${paramIdx} OR t.body ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  const tickets = await query(
    `SELECT t.*, 
            ar.confidence_score, ar.draft_response, ar.id as ai_response_id
     FROM tickets t
     LEFT JOIN ai_responses ar ON ar.ticket_id = t.id AND ar.id = (
       SELECT id FROM ai_responses WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1
     )
     ${whereClause}
     ORDER BY 
       CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       t.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, parseInt(limit as string), offset]
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM tickets ${whereClause}`, params
  );

  res.json({
    data: tickets,
    total: parseInt(count),
    page: parseInt(page as string),
    limit: parseInt(limit as string),
    hasMore: offset + tickets.length < parseInt(count),
  });
});

// GET /tickets/:id - get single ticket with AI response
ticketRouter.get('/:id', async (req: Request, res: Response) => {
  const ticket = await queryOne(
    `SELECT t.*, 
            ar.confidence_score, ar.draft_response, ar.rag_context, 
            ar.id as ai_response_id, ar.is_accepted, ar.edited_response,
            ar.model_used, ar.tokens_used, ar.latency_ms
     FROM tickets t
     LEFT JOIN ai_responses ar ON ar.ticket_id = t.id
     WHERE t.id = $1 AND t.organization_id = $2
     ORDER BY ar.created_at DESC
     LIMIT 1`,
    [req.params.id, req.user!.organizationId]
  );

  if (!ticket) throw new AppError(404, 'Ticket not found');
  res.json(ticket);
});

// POST /tickets - create new ticket
ticketRouter.post('/', async (req: Request, res: Response) => {
  const body = createTicketSchema.parse(req.body);
  const orgId = req.user!.organizationId;

  // Compute SLA deadline based on priority
  const slaHours = { low: 72, medium: 24, high: 8, critical: 2 };
  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + slaHours[body.priority]);

  const [ticket] = await query<any>(
    `INSERT INTO tickets (organization_id, subject, body, channel, priority, 
                          requester_email, requester_name, external_id, metadata, sla_deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [orgId, body.subject, body.body, body.channel, body.priority,
     body.requester_email, body.requester_name, body.external_id,
     JSON.stringify(body.metadata), slaDeadline]
  );

  // Priority mapping for queue
  const queuePriority = { critical: 1, high: 2, medium: 3, low: 4 };
  await enqueueTicket(ticket.id, queuePriority[body.priority as keyof typeof queuePriority]);

  res.status(201).json(ticket);
});

// POST /tickets/:id/review - human agent reviews AI response
ticketRouter.post('/:id/review', requireRole('agent', 'manager', 'admin'), async (req: Request, res: Response) => {
  const body = reviewSchema.parse(req.body);
  const { id: ticketId } = req.params;
  const agentId = req.user!.userId;

  const ticket = await queryOne(
    'SELECT * FROM tickets WHERE id = $1 AND organization_id = $2',
    [ticketId, req.user!.organizationId]
  );
  if (!ticket) throw new AppError(404, 'Ticket not found');

  const aiResponse = await queryOne<any>(
    'SELECT * FROM ai_responses WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1',
    [ticketId]
  );

  // Store feedback for continuous learning
  await query(
    `INSERT INTO feedback (ai_response_id, ticket_id, agent_id, action, original_response, corrected_response, rejection_reason, quality_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      aiResponse?.id, ticketId, agentId, body.action,
      aiResponse?.draft_response, body.edited_response,
      body.rejection_reason, body.quality_score,
    ]
  );

  let newStatus: string;
  switch (body.action) {
    case 'approve':
      newStatus = 'resolved';
      await query('UPDATE ai_responses SET is_accepted = true, reviewed_by = $1, reviewed_at = NOW() WHERE id = $2', [agentId, aiResponse?.id]);
      break;
    case 'edit':
      newStatus = 'resolved';
      await query(
        'UPDATE ai_responses SET is_accepted = true, edited_response = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3',
        [body.edited_response, agentId, aiResponse?.id]
      );
      break;
    case 'reject':
      newStatus = 'pending'; // Re-queue
      await enqueueTicket(ticketId);
      break;
    case 'escalate':
      newStatus = 'escalated';
      break;
    default:
      newStatus = 'human_review';
  }

  await query(
    `UPDATE tickets SET status = $1, resolved_at = $2 WHERE id = $3`,
    [newStatus, ['resolved', 'closed'].includes(newStatus) ? new Date() : null, ticketId]
  );

  res.json({ success: true, ticketId, newStatus, action: body.action });
});

// POST /tickets/ingest - CRM webhook ingestion
ticketRouter.post('/ingest', async (req: Request, res: Response) => {
  const { provider, tickets: incomingTickets } = req.body;

  const created = [];
  for (const t of incomingTickets) {
    const [ticket] = await query<any>(
      `INSERT INTO tickets (organization_id, external_id, crm_provider, subject, body, channel, priority, requester_email, requester_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (organization_id, external_id) DO NOTHING
       RETURNING *`,
      [req.user!.organizationId, t.id, provider, t.subject, t.body, t.channel || 'email', t.priority || 'medium', t.email, t.name]
    );
    if (ticket) {
      await enqueueTicket(ticket.id);
      created.push(ticket.id);
    }
  }

  res.json({ ingested: created.length, ticketIds: created });
});
