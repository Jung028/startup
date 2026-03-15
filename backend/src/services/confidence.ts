import { config } from '../config';
import { logger } from '../config/logger';
import { ConfidenceResult, LLMResponse, RAGDocument, Ticket } from '../types';

interface ConfidenceFactors {
  ragRelevanceScore: number;      // How relevant retrieved docs are
  responseCoherence: number;       // Is the response well-structured?
  ticketComplexity: number;        // Is the ticket simple or complex?
  channelReliability: number;      // Email vs chat reliability
  priorityFactor: number;          // Critical tickets get lower auto-resolve
  sensitivityFactor: number;       // Detect sensitive topics
}

export function computeConfidenceScore(
  ticket: Ticket,
  llmResponse: LLMResponse,
  ragDocs: RAGDocument[]
): ConfidenceResult {
  const factors = computeFactors(ticket, llmResponse, ragDocs);
  const score = weightedScore(factors);
  const decision = makeDecision(score, ticket);
  const reasons = explainDecision(factors, score, ticket);

  logger.debug({ ticketId: ticket.id, score, decision, factors }, 'Confidence computed');

  return { score, decision, reasons };
}

function computeFactors(
  ticket: Ticket,
  llmResponse: LLMResponse,
  ragDocs: RAGDocument[]
): ConfidenceFactors {
  // RAG relevance: average similarity score of retrieved docs
  const ragRelevanceScore = ragDocs.length > 0
    ? ragDocs.reduce((sum, d) => sum + d.score, 0) / ragDocs.length
    : 0.3; // Low baseline if no docs found

  // Response coherence: length, structure heuristics
  const responseCoherence = computeResponseCoherence(llmResponse.draft_response);

  // Ticket complexity: long tickets / multiple issues = lower confidence
  const wordCount = ticket.body.split(/\s+/).length;
  const ticketComplexity = wordCount > 200 ? 0.5 : wordCount > 100 ? 0.7 : 0.9;

  // Channel reliability factor
  const channelReliability = {
    email: 0.95,
    chat: 0.90,
    form: 0.95,
    api: 1.0,
  }[ticket.channel] || 0.85;

  // Priority factor (critical tickets require human review)
  const priorityFactor = {
    low: 1.0,
    medium: 0.95,
    high: 0.80,
    critical: 0.50,
  }[ticket.priority] || 0.9;

  // Sensitivity detection (refunds, legal, complaints, billing)
  const sensitivityFactor = detectSensitivity(ticket);

  return {
    ragRelevanceScore,
    responseCoherence,
    ticketComplexity,
    channelReliability,
    priorityFactor,
    sensitivityFactor,
  };
}

function computeResponseCoherence(response: string): number {
  if (!response || response.length < 50) return 0.2;
  if (response.length < 100) return 0.5;

  // Penalize responses with uncertainty markers
  const uncertaintyMarkers = [
    "i'm not sure", "i don't know", "i cannot", "i'm unable",
    "i don't have access", "as an ai", "i apologize but",
  ];

  const lowerResponse = response.toLowerCase();
  const uncertaintyCount = uncertaintyMarkers.filter(m => lowerResponse.includes(m)).length;

  const baseScore = Math.min(1.0, response.length / 500);
  return Math.max(0.2, baseScore - (uncertaintyCount * 0.15));
}

function detectSensitivity(ticket: Ticket): number {
  const sensitivePatterns = [
    /refund|money back|credit card|billing|charge|fraud/i,
    /legal|lawsuit|lawyer|court|sue|complaint/i,
    /cancel.*account|delete.*account|close.*account/i,
    /password.*reset|account.*hacked|unauthorized/i,
    /discrimination|harassment|abuse|threat/i,
    /urgent|emergency|critical|asap|immediately/i,
  ];

  const text = `${ticket.subject} ${ticket.body}`;
  const matchCount = sensitivePatterns.filter(p => p.test(text)).length;

  if (matchCount >= 3) return 0.4;
  if (matchCount === 2) return 0.6;
  if (matchCount === 1) return 0.8;
  return 1.0;
}

function weightedScore(factors: ConfidenceFactors): number {
  const weights = {
    ragRelevanceScore: 0.30,
    responseCoherence: 0.25,
    ticketComplexity: 0.15,
    channelReliability: 0.10,
    priorityFactor: 0.10,
    sensitivityFactor: 0.10,
  };

  const score = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + factors[key as keyof ConfidenceFactors] * weight;
  }, 0);

  return Math.round(score * 10000) / 10000; // 4 decimal places
}

function makeDecision(score: number, ticket: Ticket): ConfidenceResult['decision'] {
  // Always escalate critical tickets regardless of score
  if (ticket.priority === 'critical') return 'escalate';

  if (score >= config.confidence.autoResolveThreshold) return 'auto_resolve';
  if (score >= config.confidence.escalationThreshold) return 'human_review';
  return 'escalate';
}

function explainDecision(factors: ConfidenceFactors, score: number, ticket: Ticket): string[] {
  const reasons: string[] = [];

  if (factors.ragRelevanceScore < 0.5) reasons.push('Low knowledge base match - limited relevant context found');
  if (factors.responseCoherence < 0.6) reasons.push('Response quality below threshold');
  if (factors.ticketComplexity < 0.7) reasons.push('Complex multi-issue ticket detected');
  if (factors.sensitivityFactor < 0.7) reasons.push('Sensitive topic detected (billing/legal/account)');
  if (ticket.priority === 'critical') reasons.push('Critical priority ticket - mandatory human review');
  if (ticket.priority === 'high') reasons.push('High priority ticket - elevated scrutiny');
  if (score >= config.confidence.autoResolveThreshold) reasons.push('High confidence - safe for auto-resolution');

  return reasons;
}
