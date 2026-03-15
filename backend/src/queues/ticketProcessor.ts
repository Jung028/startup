import { Queue, Worker, QueueEvents } from 'bullmq';
import { config } from '../config';
import { logger } from '../config/logger';
import { query, queryOne } from '../db';
import { Ticket } from '../types';
import { generateDraftResponse } from '../services/llmService';
import { retrieveContext } from '../services/ragService';
import { computeConfidenceScore } from '../services/confidence';
import { executeWorkflowAction } from '../services/workflowExecutor';

export const TICKET_QUEUE_NAME = 'ticket-processing';

let ticketQueue: Queue;
let ticketWorker: Worker;

export async function initializeQueue(): Promise<void> {
  const connection = { url: config.redis.url };

  ticketQueue = new Queue(TICKET_QUEUE_NAME, {
    connection: { host: 'localhost', port: 6379 },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  ticketWorker = new Worker(
    TICKET_QUEUE_NAME,
    processTicketJob,
    {
      connection: { host: 'localhost', port: 6379 },
      concurrency: config.queue.concurrency,
    }
  );

  ticketWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, ticketId: job.data.ticketId }, 'Ticket processed successfully');
  });

  ticketWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Ticket processing failed');
  });

  logger.info('✅ Ticket processing queue initialized');
}

export async function enqueueTicket(ticketId: string, priority: number = 0): Promise<void> {
  await ticketQueue.add(
    'process-ticket',
    { ticketId },
    { priority, delay: config.queue.processingDelay }
  );
  logger.debug({ ticketId }, 'Ticket enqueued');
}

async function processTicketJob(job: any): Promise<void> {
  const { ticketId } = job.data;

  logger.info({ ticketId, attempt: job.attemptsMade + 1 }, 'Processing ticket');

  // 1. Fetch ticket
  const ticket = await queryOne<Ticket>(
    'SELECT * FROM tickets WHERE id = $1', [ticketId]
  );
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  // Mark as processing
  await query('UPDATE tickets SET status = $1 WHERE id = $2', ['processing', ticketId]);

  try {
    // 2. Retrieve RAG context
    await job.updateProgress(20);
    const ragContext = await retrieveContext(ticket);

    // 3. Generate AI draft response
    await job.updateProgress(50);
    const llmResponse = await generateDraftResponse(ticket, ragContext);

    // 4. Compute confidence score
    await job.updateProgress(70);
    const confidence = computeConfidenceScore(ticket, llmResponse, ragContext);

    // 5. Store AI response
    const [aiResponse] = await query<any>(
      `INSERT INTO ai_responses 
        (ticket_id, draft_response, confidence_score, resolution_type, rag_context, model_used, tokens_used, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        ticketId,
        llmResponse.draft_response,
        confidence.score,
        confidence.decision === 'auto_resolve' ? 'auto' : 'human',
        JSON.stringify(ragContext),
        llmResponse.model_used,
        llmResponse.tokens_used,
        llmResponse.latency_ms,
      ]
    );

    // 6. Route based on decision
    await job.updateProgress(85);

    if (confidence.decision === 'auto_resolve') {
      await handleAutoResolve(ticket, aiResponse);
    } else if (confidence.decision === 'escalate') {
      await handleEscalation(ticket, confidence.reasons);
    } else {
      await handleHumanReview(ticket);
    }

    // 7. Update metrics
    await job.updateProgress(95);
    await updateDailyMetrics(ticket, confidence.score, confidence.decision);

    await job.updateProgress(100);
  } catch (error) {
    // Restore ticket to pending on failure
    await query('UPDATE tickets SET status = $1 WHERE id = $2', ['pending', ticketId]);
    throw error;
  }
}

async function handleAutoResolve(ticket: Ticket, aiResponse: any): Promise<void> {
  // Execute CRM actions
  await executeWorkflowAction(ticket, aiResponse, { type: 'send_response', payload: {} });
  await executeWorkflowAction(ticket, aiResponse, { type: 'close_ticket', payload: {} });

  await query(
    'UPDATE ai_responses SET is_accepted = true WHERE id = $1',
    [aiResponse.id]
  );

  logger.info({ ticketId: ticket.id, confidence: aiResponse.confidence_score }, 'Ticket auto-resolved');
}

async function handleEscalation(ticket: Ticket, reasons: string[]): Promise<void> {
  await query(
    'UPDATE tickets SET status = $1 WHERE id = $2',
    ['escalated', ticket.id]
  );

  await executeWorkflowAction(ticket, {} as any, {
    type: 'escalate',
    payload: { reason: reasons.join('; ') },
  });

  logger.info({ ticketId: ticket.id, reasons }, 'Ticket escalated');
}

async function handleHumanReview(ticket: Ticket): Promise<void> {
  await query(
    'UPDATE tickets SET status = $1 WHERE id = $2',
    ['human_review', ticket.id]
  );

  logger.info({ ticketId: ticket.id }, 'Ticket sent to human review');
}

async function updateDailyMetrics(ticket: Ticket, score: number, decision: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const isAutoResolved = decision === 'auto_resolve' ? 1 : 0;
  const isEscalated = decision === 'escalate' ? 1 : 0;
  const isHumanReview = decision === 'human_review' ? 1 : 0;

  await query(
    `INSERT INTO daily_metrics (organization_id, date, total_tickets, auto_resolved, escalated, human_reviewed, avg_confidence)
     VALUES ($1, $2, 1, $3, $4, $5, $6)
     ON CONFLICT (organization_id, date) DO UPDATE SET
       total_tickets = daily_metrics.total_tickets + 1,
       auto_resolved = daily_metrics.auto_resolved + $3,
       escalated = daily_metrics.escalated + $4,
       human_reviewed = daily_metrics.human_reviewed + $5,
       avg_confidence = (daily_metrics.avg_confidence * daily_metrics.total_tickets + $6) / (daily_metrics.total_tickets + 1)`,
    [ticket.organization_id, today, isAutoResolved, isEscalated, isHumanReview, score]
  );
}

export function getTicketQueue(): Queue {
  return ticketQueue;
}
