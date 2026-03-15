-- AECSA Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE ticket_status AS ENUM ('pending', 'processing', 'ai_resolved', 'human_review', 'escalated', 'resolved', 'closed');
CREATE TYPE ticket_channel AS ENUM ('email', 'chat', 'form', 'api');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE crm_provider AS ENUM ('salesforce', 'zendesk', 'intercom', 'custom');
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'manager', 'viewer');
CREATE TYPE resolution_type AS ENUM ('auto', 'human', 'escalated');

-- Organizations (Enterprise customers)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  crm_provider crm_provider NOT NULL DEFAULT 'custom',
  crm_config JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  subscription_tier VARCHAR(50) DEFAULT 'starter',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Support agents, admins)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'agent',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255),                        -- CRM ticket ID
  crm_provider crm_provider,
  channel ticket_channel NOT NULL DEFAULT 'email',
  status ticket_status NOT NULL DEFAULT 'pending',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  requester_email VARCHAR(255),
  requester_name VARCHAR(255),
  metadata JSONB DEFAULT '{}',                     -- Attachments, tags, CRM fields
  sla_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- AI Responses (drafts generated per ticket)
CREATE TABLE ai_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  draft_response TEXT NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL,
  resolution_type resolution_type,
  rag_context JSONB DEFAULT '[]',                  -- Retrieved documents used
  prompt_template VARCHAR(100),
  model_used VARCHAR(100),
  tokens_used INTEGER,
  latency_ms INTEGER,
  is_accepted BOOLEAN,
  edited_response TEXT,                            -- Human-edited version
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback (human corrections for continuous improvement)
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai_response_id UUID REFERENCES ai_responses(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,                     -- 'approved', 'edited', 'rejected'
  original_response TEXT,
  corrected_response TEXT,
  rejection_reason TEXT,
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Actions (automated CRM actions)
CREATE TABLE workflow_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,               -- 'close_ticket', 'refund', 'password_reset', etc.
  action_payload JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending',
  executed_by VARCHAR(50) DEFAULT 'ai',            -- 'ai' or user ID
  result JSONB,
  error TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Base (RAG source documents)
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  doc_type VARCHAR(100),                           -- 'faq', 'manual', 'policy', 'past_ticket'
  tags TEXT[],
  vector_id VARCHAR(255),                          -- Pinecone vector ID
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics (aggregated analytics)
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tickets INTEGER DEFAULT 0,
  auto_resolved INTEGER DEFAULT 0,
  human_reviewed INTEGER DEFAULT 0,
  escalated INTEGER DEFAULT 0,
  avg_confidence DECIMAL(5,4),
  avg_resolution_time_minutes INTEGER,
  avg_csat DECIMAL(3,2),
  cost_savings_usd DECIMAL(10,2),
  sla_compliance_rate DECIMAL(5,4),
  UNIQUE(organization_id, date)
);

-- CSAT Scores
CREATE TABLE csat_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  score INTEGER CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_priority ON tickets(priority, sla_deadline);
CREATE INDEX idx_ai_responses_ticket ON ai_responses(ticket_id);
CREATE INDEX idx_feedback_ticket ON feedback(ticket_id);
CREATE INDEX idx_daily_metrics_org_date ON daily_metrics(organization_id, date);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
