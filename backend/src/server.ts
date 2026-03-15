import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { config } from './config';
import { logger } from './config/logger';
import { ticketRouter } from './api/tickets';
import { analyticsRouter } from './api/analytics';
import { usersRouter } from './api/users';
import { crmRouter } from './api/crm';
import { knowledgeBaseRouter } from './api/knowledgeBase';
import { authMiddleware } from './auth/authMiddleware';
import { errorHandler } from './middleware/errorHandler';
import { initializeQueue } from './queues/ticketProcessor';
import { connectDatabase } from './db';
import { connectRedis } from './config/redis';

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(pinoHttp({ logger }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes (public)
app.use('/api/auth', usersRouter);

// API Routes (protected)
app.use('/api/tickets', authMiddleware, ticketRouter);
app.use('/api/analytics', authMiddleware, analyticsRouter);
app.use('/api/crm', authMiddleware, crmRouter);
app.use('/api/knowledge-base', authMiddleware, knowledgeBaseRouter);

// Error handling
app.use(errorHandler);

async function start() {
  try {
    await connectDatabase();
    await connectRedis();
    await initializeQueue();

    app.listen(config.port, () => {
      logger.info(`🚀 AECSA Backend running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
