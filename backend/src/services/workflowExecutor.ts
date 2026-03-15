import { logger } from '../config/logger';
import { query } from '../db';
import { Ticket, AIResponse } from '../types';

interface WorkflowAction {
  type: string;
  payload: Record<string, any>;
}

export async function executeWorkflowAction(
  ticket: Ticket,
  aiResponse: AIResponse,
  action: WorkflowAction
): Promise<{ success: boolean; result?: any; error?: string }> {
  logger.info({ ticketId: ticket.id, actionType: action.type }, 'Executing workflow action');

  const startTime = Date.now();

  try {
    let result: any;

    switch (action.type) {
      case 'close_ticket':
        result = await closeTicket(ticket, aiResponse);
        break;
      case 'send_response':
        result = await sendResponse(ticket, aiResponse);
        break;
      case 'update_status':
        result = await updateTicketStatus(ticket, action.payload.status);
        break;
      case 'escalate':
        result = await escalateTicket(ticket, action.payload.reason);
        break;
      case 'password_reset':
        result = await triggerPasswordReset(ticket);
        break;
      case 'issue_refund':
        result = await issueRefund(ticket, action.payload.amount);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    // Log the action
    await logWorkflowAction(ticket.id, action, 'success', result);

    return { success: true, result };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, ticketId: ticket.id, action }, 'Workflow action failed');

    await logWorkflowAction(ticket.id, action, 'failed', null, errMsg);

    return { success: false, error: errMsg };
  }
}

async function closeTicket(ticket: Ticket, aiResponse: AIResponse): Promise<any> {
  await query(
    `UPDATE tickets SET status = 'ai_resolved', resolved_at = NOW() WHERE id = $1`,
    [ticket.id]
  );

  // In production, also call the CRM API (Zendesk/Salesforce/Intercom)
  // await crmConnector.closeTicket(ticket.external_id, ticket.crm_provider);

  return { ticketId: ticket.id, status: 'ai_resolved' };
}

async function sendResponse(ticket: Ticket, aiResponse: AIResponse): Promise<any> {
  // In production: call CRM API to send the response to the customer
  // await crmConnector.sendReply(ticket.external_id, aiResponse.draft_response);

  logger.info({ ticketId: ticket.id }, 'Response sent to customer (simulated)');
  return { sent: true, channel: ticket.channel };
}

async function updateTicketStatus(ticket: Ticket, status: string): Promise<any> {
  await query(
    `UPDATE tickets SET status = $1 WHERE id = $2`,
    [status, ticket.id]
  );
  return { ticketId: ticket.id, newStatus: status };
}

async function escalateTicket(ticket: Ticket, reason: string): Promise<any> {
  await query(
    `UPDATE tickets SET status = 'escalated' WHERE id = $1`,
    [ticket.id]
  );
  return { ticketId: ticket.id, status: 'escalated', reason };
}

async function triggerPasswordReset(ticket: Ticket): Promise<any> {
  // In production: call user management system API
  logger.info({ ticketId: ticket.id, email: ticket.requester_email }, 'Password reset triggered (simulated)');
  return { email: ticket.requester_email, resetTriggered: true };
}

async function issueRefund(ticket: Ticket, amount: number): Promise<any> {
  // Safety: only allow refunds under $100 autonomously
  if (amount > 100) {
    throw new Error(`Refund amount $${amount} exceeds autonomous limit - requires human approval`);
  }
  // In production: call billing/payment API
  logger.info({ ticketId: ticket.id, amount }, 'Refund issued (simulated)');
  return { amount, status: 'processed' };
}

async function logWorkflowAction(
  ticketId: string,
  action: WorkflowAction,
  status: 'success' | 'failed',
  result: any,
  error?: string
): Promise<void> {
  await query(
    `INSERT INTO workflow_actions (ticket_id, action_type, action_payload, status, result, error, executed_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'ai')`,
    [ticketId, action.type, JSON.stringify(action.payload), status, JSON.stringify(result), error]
  );
}
