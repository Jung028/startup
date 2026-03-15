// Core domain types for AECSA Platform

export type TicketStatus = 'pending' | 'processing' | 'ai_resolved' | 'human_review' | 'escalated' | 'resolved' | 'closed';
export type TicketChannel = 'email' | 'chat' | 'form' | 'api';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type CRMProvider = 'salesforce' | 'zendesk' | 'intercom' | 'custom';
export type UserRole = 'admin' | 'agent' | 'manager' | 'viewer';
export type ResolutionType = 'auto' | 'human' | 'escalated';

export interface Organization {
  id: string;
  name: string;
  domain: string;
  crm_provider: CRMProvider;
  crm_config: Record<string, any>;
  settings: Record<string, any>;
  subscription_tier: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Ticket {
  id: string;
  organization_id: string;
  external_id?: string;
  crm_provider?: CRMProvider;
  channel: TicketChannel;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  body: string;
  requester_email?: string;
  requester_name?: string;
  metadata: Record<string, any>;
  sla_deadline?: Date;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

export interface AIResponse {
  id: string;
  ticket_id: string;
  draft_response: string;
  confidence_score: number;
  resolution_type?: ResolutionType;
  rag_context: RAGDocument[];
  prompt_template?: string;
  model_used?: string;
  tokens_used?: number;
  latency_ms?: number;
  is_accepted?: boolean;
  edited_response?: string;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
}

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  score: number;
  doc_type: string;
}

export interface Feedback {
  id: string;
  ai_response_id: string;
  ticket_id: string;
  agent_id: string;
  action: 'approved' | 'edited' | 'rejected';
  original_response: string;
  corrected_response?: string;
  rejection_reason?: string;
  quality_score?: number;
  created_at: Date;
}

export interface WorkflowAction {
  id: string;
  ticket_id: string;
  action_type: string;
  action_payload: Record<string, any>;
  status: 'pending' | 'success' | 'failed';
  executed_by: string;
  result?: Record<string, any>;
  error?: string;
  executed_at: Date;
}

export interface KnowledgeBaseDoc {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  doc_type: string;
  tags: string[];
  vector_id?: string;
  is_active: boolean;
  created_at: Date;
}

export interface DailyMetrics {
  id: string;
  organization_id: string;
  date: Date;
  total_tickets: number;
  auto_resolved: number;
  human_reviewed: number;
  escalated: number;
  avg_confidence: number;
  avg_resolution_time_minutes: number;
  avg_csat: number;
  cost_savings_usd: number;
  sla_compliance_rate: number;
}

// API Request/Response types
export interface CreateTicketRequest {
  subject: string;
  body: string;
  channel: TicketChannel;
  priority?: TicketPriority;
  requester_email?: string;
  requester_name?: string;
  external_id?: string;
  metadata?: Record<string, any>;
}

export interface TicketReviewRequest {
  action: 'approve' | 'edit' | 'reject' | 'escalate';
  edited_response?: string;
  rejection_reason?: string;
  quality_score?: number;
}

export interface ConfidenceResult {
  score: number;
  decision: 'auto_resolve' | 'human_review' | 'escalate';
  reasons: string[];
}

export interface LLMResponse {
  draft_response: string;
  model_used: string;
  tokens_used: number;
  latency_ms: number;
  raw_probability?: number;
}

export interface JWTPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: UserRole;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
