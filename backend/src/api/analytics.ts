import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';

export const analyticsRouter = Router();

// GET /analytics/summary - key metrics for dashboard
analyticsRouter.get('/summary', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { days = '30' } = req.query;

  const [summary] = await query<any>(
    `SELECT
       SUM(total_tickets) as total_tickets,
       SUM(auto_resolved) as auto_resolved,
       SUM(human_reviewed) as human_reviewed,
       SUM(escalated) as escalated,
       AVG(avg_confidence)::DECIMAL(5,4) as avg_confidence,
       AVG(avg_resolution_time_minutes) as avg_resolution_time,
       AVG(avg_csat)::DECIMAL(3,2) as avg_csat,
       SUM(cost_savings_usd)::DECIMAL(10,2) as total_cost_savings,
       AVG(sla_compliance_rate)::DECIMAL(5,4) as avg_sla_compliance
     FROM daily_metrics
     WHERE organization_id = $1
       AND date >= NOW() - INTERVAL '1 day' * $2`,
    [orgId, parseInt(days as string)]
  );

  const totalTickets = parseInt(summary.total_tickets) || 1;
  const autoResolvedRate = (parseInt(summary.auto_resolved) / totalTickets);

  res.json({
    ...summary,
    auto_resolve_rate: autoResolvedRate,
    escalation_rate: parseInt(summary.escalated) / totalTickets,
    human_review_rate: parseInt(summary.human_reviewed) / totalTickets,
  });
});

// GET /analytics/resolution-rate - daily time series
analyticsRouter.get('/resolution-rate', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const { days = '30' } = req.query;

  const rows = await query(
    `SELECT 
       date,
       total_tickets,
       auto_resolved,
       human_reviewed,
       escalated,
       CASE WHEN total_tickets > 0 
            THEN ROUND(auto_resolved::DECIMAL / total_tickets * 100, 2)
            ELSE 0 END as resolution_rate
     FROM daily_metrics
     WHERE organization_id = $1
       AND date >= NOW() - INTERVAL '1 day' * $2
     ORDER BY date ASC`,
    [orgId, parseInt(days as string)]
  );

  res.json(rows);
});

// GET /analytics/escalation-rate
analyticsRouter.get('/escalation-rate', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;

  const rows = await query(
    `SELECT 
       date,
       escalated,
       total_tickets,
       CASE WHEN total_tickets > 0 
            THEN ROUND(escalated::DECIMAL / total_tickets * 100, 2) 
            ELSE 0 END as escalation_rate
     FROM daily_metrics
     WHERE organization_id = $1
       AND date >= NOW() - INTERVAL '30 days'
     ORDER BY date ASC`,
    [orgId]
  );

  res.json(rows);
});

// GET /analytics/csat
analyticsRouter.get('/csat', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;

  const [overall] = await query<any>(
    `SELECT 
       AVG(cs.score)::DECIMAL(3,2) as avg_score,
       COUNT(cs.id) as total_responses,
       COUNT(CASE WHEN cs.score >= 4 THEN 1 END) as positive,
       COUNT(CASE WHEN cs.score <= 2 THEN 1 END) as negative
     FROM csat_scores cs
     JOIN tickets t ON t.id = cs.ticket_id
     WHERE t.organization_id = $1
       AND cs.submitted_at >= NOW() - INTERVAL '30 days'`,
    [orgId]
  );

  const distribution = await query<any>(
    `SELECT cs.score, COUNT(*) as count
     FROM csat_scores cs
     JOIN tickets t ON t.id = cs.ticket_id
     WHERE t.organization_id = $1
       AND cs.submitted_at >= NOW() - INTERVAL '30 days'
     GROUP BY cs.score
     ORDER BY cs.score`,
    [orgId]
  );

  res.json({ overall, distribution });
});

// GET /analytics/ai-accuracy
analyticsRouter.get('/ai-accuracy', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;

  const [accuracy] = await query<any>(
    `SELECT
       COUNT(*) as total_ai_responses,
       COUNT(CASE WHEN is_accepted = true THEN 1 END) as accepted,
       COUNT(CASE WHEN edited_response IS NOT NULL THEN 1 END) as edited,
       COUNT(CASE WHEN is_accepted = false THEN 1 END) as rejected,
       AVG(confidence_score)::DECIMAL(5,4) as avg_confidence,
       AVG(latency_ms) as avg_latency_ms
     FROM ai_responses ar
     JOIN tickets t ON t.id = ar.ticket_id
     WHERE t.organization_id = $1`,
    [orgId]
  );

  const total = parseInt(accuracy.total_ai_responses) || 1;
  res.json({
    ...accuracy,
    acceptance_rate: parseInt(accuracy.accepted) / total,
    edit_rate: parseInt(accuracy.edited) / total,
    rejection_rate: parseInt(accuracy.rejected) / total,
  });
});

// GET /analytics/cost-savings
analyticsRouter.get('/cost-savings', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const COST_PER_HUMAN_TICKET = 15; // $15 avg cost per human-handled ticket
  const COST_PER_AI_TICKET = 0.50;  // $0.50 avg AI resolution cost

  const [metrics] = await query<any>(
    `SELECT SUM(auto_resolved) as ai_resolved, SUM(total_tickets) as total
     FROM daily_metrics WHERE organization_id = $1`,
    [orgId]
  );

  const aiResolved = parseInt(metrics.ai_resolved) || 0;
  const humanCost = aiResolved * COST_PER_HUMAN_TICKET;
  const aiCost = aiResolved * COST_PER_AI_TICKET;
  const savings = humanCost - aiCost;

  res.json({
    ai_resolved_tickets: aiResolved,
    human_cost_equivalent: humanCost,
    actual_ai_cost: aiCost,
    net_savings: savings,
    roi_multiplier: Math.round(savings / Math.max(aiCost, 1)),
    cost_per_ticket_ai: COST_PER_AI_TICKET,
    cost_per_ticket_human: COST_PER_HUMAN_TICKET,
  });
});

// GET /analytics/ticket-volume - hourly breakdown
analyticsRouter.get('/ticket-volume', async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;

  const rows = await query(
    `SELECT 
       DATE_TRUNC('hour', created_at) as hour,
       COUNT(*) as count,
       channel
     FROM tickets
     WHERE organization_id = $1
       AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY hour, channel
     ORDER BY hour ASC`,
    [orgId]
  );

  res.json(rows);
});
