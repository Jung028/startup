import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { generateToken, authMiddleware, requireRole } from '../auth/authMiddleware';
import { AppError } from '../middleware/errorHandler';

export const usersRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organizationId: z.string().uuid(),
  role: z.enum(['admin', 'agent', 'manager', 'viewer']).optional().default('agent'),
});

// POST /auth/login
usersRouter.post('/login', async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  const user = await queryOne<any>(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [body.email]
  );

  if (!user) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(body.password, user.password_hash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const token = generateToken({
    userId: user.id,
    organizationId: user.organization_id,
    email: user.email,
    role: user.role,
  });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// POST /auth/register
usersRouter.post('/register', async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 12);

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [body.email]);
  if (existing) throw new AppError(409, 'Email already registered');

  const [user] = await query<any>(
    `INSERT INTO users (email, password_hash, name, organization_id, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role`,
    [body.email, passwordHash, body.name, body.organizationId, body.role]
  );

  const token = generateToken({
    userId: user.id,
    organizationId: body.organizationId,
    email: user.email,
    role: user.role,
  });

  res.status(201).json({ token, user });
});

// GET /auth/me
usersRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await queryOne(
    'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
    [req.user!.userId]
  );
  if (!user) throw new AppError(404, 'User not found');
  res.json(user);
});

// GET /auth/agents - list agents for org
usersRouter.get('/agents', authMiddleware, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const agents = await query(
    `SELECT id, email, name, role, is_active, last_login_at, created_at
     FROM users WHERE organization_id = $1 ORDER BY name`,
    [req.user!.organizationId]
  );
  res.json(agents);
});

// PATCH /auth/users/:id/permissions
usersRouter.patch('/:id/permissions', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { role, is_active } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (role) { updates.push(`role = $${idx++}`); params.push(role); }
  if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }

  if (!updates.length) throw new AppError(400, 'No valid fields to update');

  params.push(req.params.id, req.user!.organizationId);
  const [user] = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING id, email, role, is_active`,
    params
  );

  if (!user) throw new AppError(404, 'User not found');
  res.json(user);
});
