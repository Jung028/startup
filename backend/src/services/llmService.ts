import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../config/logger';
import { LLMResponse, Ticket, RAGDocument } from '../types';
import { loadPromptTemplate } from './promptService';

const anthropic = new Anthropic({ apiKey: config.ai.anthropicApiKey });
const openai = new OpenAI({ apiKey: config.ai.openaiApiKey });

export async function generateDraftResponse(
  ticket: Ticket,
  ragContext: RAGDocument[]
): Promise<LLMResponse> {
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(ticket, ragContext);

  logger.debug({ ticketId: ticket.id, provider: config.ai.provider }, 'Generating AI response');

  try {
    if (config.ai.provider === 'anthropic') {
      return await generateWithAnthropic(systemPrompt, userPrompt, startTime);
    } else {
      return await generateWithOpenAI(systemPrompt, userPrompt, startTime);
    }
  } catch (error) {
    logger.error({ error, ticketId: ticket.id }, 'LLM generation failed');
    throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateWithAnthropic(
  systemPrompt: string,
  userPrompt: string,
  startTime: number
): Promise<LLMResponse> {
  const response = await anthropic.messages.create({
    model: config.ai.model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const latency = Date.now() - startTime;

  return {
    draft_response: text,
    model_used: response.model,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
    latency_ms: latency,
  };
}

async function generateWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  startTime: number
): Promise<LLMResponse> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    logprobs: true,
    top_logprobs: 1,
  });

  const text = response.choices[0].message.content || '';
  const latency = Date.now() - startTime;

  // Extract probability for confidence scoring
  const rawProbability = response.choices[0].logprobs?.content?.[0]?.logprob
    ? Math.exp(response.choices[0].logprobs.content[0].logprob)
    : undefined;

  return {
    draft_response: text,
    model_used: response.model,
    tokens_used: response.usage?.total_tokens || 0,
    latency_ms: latency,
    raw_probability: rawProbability,
  };
}

function buildSystemPrompt(): string {
  return `You are an expert enterprise customer support agent. Your goal is to:
1. Understand the customer's issue clearly and empathetically
2. Provide a clear, professional, and helpful response
3. Reference relevant policies, FAQs, or past solutions when appropriate
4. Resolve the issue in a single response when possible
5. Escalate when the issue requires human judgment (refunds > $500, legal matters, complex technical issues)

RESPONSE FORMAT RULES:
- Be concise and professional
- Use the customer's name if provided
- Acknowledge the issue first, then provide solution steps
- End with a clear next step or confirmation
- Do NOT make up policies or procedures you're unsure about
- If unsure, acknowledge the limitation and offer to escalate

TONE: Professional, empathetic, solution-focused
LANGUAGE: Clear, jargon-free, customer-friendly`;
}

function buildUserPrompt(ticket: Ticket, ragContext: RAGDocument[]): string {
  const contextSection = ragContext.length > 0
    ? `\n\nRELEVANT KNOWLEDGE BASE CONTEXT:\n${ragContext.map((doc, i) =>
        `[${i + 1}] ${doc.title}\n${doc.content.substring(0, 500)}...`
      ).join('\n\n')}`
    : '';

  return `CUSTOMER TICKET:
Subject: ${ticket.subject}
Channel: ${ticket.channel}
Priority: ${ticket.priority}
Customer: ${ticket.requester_name || 'Customer'} <${ticket.requester_email || 'unknown'}>

Message:
${ticket.body}
${contextSection}

Please generate a professional support response that resolves this ticket.`;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}
