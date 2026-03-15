import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { requireRole } from '../auth/authMiddleware';
import { AppError } from '../middleware/errorHandler';
import { upsertDocument } from '../services/ragService';

export const knowledgeBaseRouter = Router();

const createDocSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(10),
  doc_type: z.enum(['faq', 'manual', 'policy', 'past_ticket']),
  tags: z.array(z.string()).optional().default([]),
});

// GET /knowledge-base - list documents
knowledgeBaseRouter.get('/', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { type, search, page = '1', limit = '20' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let where = 'WHERE organization_id = $1 AND is_active = true';
  const params: any[] = [orgId];
  let idx = 2;

  if (type) {
    where += ` AND doc_type = $${idx++}`;
    params.push(type);
  }
  if (search) {
    where += ` AND (title ILIKE $${idx} OR content ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  const docs = await query(
    `SELECT id, title, content, doc_type, tags, is_active, created_at, updated_at
     FROM knowledge_base ${where}
     ORDER BY updated_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, parseInt(limit as string), offset]
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM knowledge_base ${where}`,
    params.slice(0, idx - 3)
  );

  res.json({
    data: docs,
    total: parseInt(count),
    page: parseInt(page as string),
    limit: parseInt(limit as string),
  });
});

// GET /knowledge-base/:id
knowledgeBaseRouter.get('/:id', async (req: Request, res: Response) => {
  const doc = await queryOne(
    'SELECT * FROM knowledge_base WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.user!.organizationId]
  );
  if (!doc) throw new AppError(404, 'Document not found');
  res.json(doc);
});

// POST /knowledge-base - create and index a new document
knowledgeBaseRouter.post('/', requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const body = createDocSchema.parse(req.body);
  const orgId = req.user!.organizationId;

  const [doc] = await query<any>(
    `INSERT INTO knowledge_base (organization_id, title, content, doc_type, tags)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [orgId, body.title, body.content, body.doc_type, body.tags]
  );

  // Upsert into Pinecone vector DB (async, non-blocking)
  upsertDocument(orgId, {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    doc_type: doc.doc_type,
  }).catch(err => console.warn('Vector upsert failed (non-critical):', err));

  res.status(201).json(doc);
});

// PATCH /knowledge-base/:id - update a document
knowledgeBaseRouter.patch('/:id', requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const { title, content, tags, is_active } = req.body;
  const orgId = req.user!.organizationId;

  const existing = await queryOne(
    'SELECT * FROM knowledge_base WHERE id = $1 AND organization_id = $2',
    [req.params.id, orgId]
  );
  if (!existing) throw new AppError(404, 'Document not found');

  const [updated] = await query<any>(
    `UPDATE knowledge_base
     SET title = COALESCE($1, title),
         content = COALESCE($2, content),
         tags = COALESCE($3, tags),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE id = $5 AND organization_id = $6
     RETURNING *`,
    [title, content, tags, is_active, req.params.id, orgId]
  );

  // Re-index in Pinecone if content changed
  if (content) {
    upsertDocument(orgId, {
      id: updated.id,
      title: updated.title,
      content: updated.content,
      doc_type: updated.doc_type,
    }).catch(() => {});
  }

  res.json(updated);
});

// DELETE /knowledge-base/:id - soft delete
knowledgeBaseRouter.delete('/:id', requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const result = await query(
    `UPDATE knowledge_base SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [req.params.id, req.user!.organizationId]
  );
  res.json({ success: true });
});

// POST /knowledge-base/bulk-index - re-index all active docs
knowledgeBaseRouter.post('/bulk-index', requireRole('admin'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const docs = await query<any>(
    'SELECT id, title, content, doc_type FROM knowledge_base WHERE organization_id = $1 AND is_active = true',
    [orgId]
  );

  let indexed = 0;
  for (const doc of docs) {
    try {
      await upsertDocument(orgId, doc);
      indexed++;
    } catch { /* skip failed docs */ }
  }

  res.json({ total: docs.length, indexed });
});
