import { computeConfidenceScore } from '../../src/services/confidence';
import { Ticket, LLMResponse, RAGDocument } from '../../src/types';

const mockTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'test-ticket-1',
  organization_id: 'org-1',
  channel: 'email',
  status: 'pending',
  priority: 'medium',
  subject: 'Cannot login to my account',
  body: 'I cannot login to my account. Can you help me reset my password?',
  metadata: {},
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const mockLLM = (overrides: Partial<LLMResponse> = {}): LLMResponse => ({
  draft_response: 'Hi, thank you for reaching out. Please click Forgot Password on the login page to reset your password. You will receive an email within 5 minutes. Let us know if you need further assistance.',
  model_used: 'claude-3-5-sonnet',
  tokens_used: 120,
  latency_ms: 800,
  ...overrides,
});

const mockRAG = (score = 0.9): RAGDocument[] => ([
  { id: 'doc-1', title: 'Password Reset FAQ', content: 'Click Forgot Password...', score, doc_type: 'faq' },
]);

describe('Confidence Scoring', () => {
  test('high confidence for simple password reset ticket', () => {
    const result = computeConfidenceScore(mockTicket(), mockLLM(), mockRAG(0.92));
    expect(result.score).toBeGreaterThan(0.75);
    expect(result.decision).toBe('auto_resolve');
  });

  test('critical tickets always escalate regardless of score', () => {
    const result = computeConfidenceScore(
      mockTicket({ priority: 'critical' }),
      mockLLM(),
      mockRAG(0.99)
    );
    expect(result.decision).toBe('escalate');
  });

  test('low RAG relevance reduces confidence', () => {
    const highResult = computeConfidenceScore(mockTicket(), mockLLM(), mockRAG(0.95));
    const lowResult = computeConfidenceScore(mockTicket(), mockLLM(), mockRAG(0.2));
    expect(highResult.score).toBeGreaterThan(lowResult.score);
  });

  test('sensitive billing topic reduces confidence', () => {
    const normal = computeConfidenceScore(mockTicket(), mockLLM(), mockRAG());
    const billing = computeConfidenceScore(
      mockTicket({ subject: 'Refund request - fraud charge on my credit card', body: 'I want a full refund for an unauthorized billing charge. This is urgent. I may need to contact my lawyer.' }),
      mockLLM(),
      mockRAG()
    );
    expect(normal.score).toBeGreaterThan(billing.score);
  });

  test('weak AI response reduces confidence', () => {
    const strong = computeConfidenceScore(mockTicket(), mockLLM(), mockRAG());
    const weak = computeConfidenceScore(
      mockTicket(),
      mockLLM({ draft_response: "I'm not sure how to help. I don't have access to your account." }),
      mockRAG()
    );
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  test('returns reasons array', () => {
    const result = computeConfidenceScore(
      mockTicket({ priority: 'critical' }),
      mockLLM(),
      mockRAG()
    );
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test('no RAG docs returns low base confidence', () => {
    const result = computeConfidenceScore(mockTicket(), mockLLM(), []);
    expect(result.score).toBeLessThan(0.85);
  });
});
