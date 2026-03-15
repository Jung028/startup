# AECSA — Autonomous Enterprise Customer Service Agent

> Reduce support ticket resolution costs by 60–80% with an AI agent that auto-resolves tickets, learns from human feedback, and integrates with your CRM.

## Architecture

```
CRM (Zendesk/Salesforce/Intercom)
         │
         ▼
  Ticket Ingestion
         │
         ▼
  BullMQ Processing Queue
         │
         ├──► RAG Retrieval (Pinecone + PostgreSQL)
         │
         ▼
      LLM API (Claude / GPT-4o)
         │
         ▼
  Confidence Scoring (6 signals)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Auto-Resolve  Human Review Dashboard
(≥85% conf)   (60–85% conf)
    │         │
    └────┬────┘
         ▼
  Workflow Executor → CRM API
         ▼
  Metrics & Analytics
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind + Recharts |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis + BullMQ |
| AI/LLM | Anthropic Claude / OpenAI GPT-4o |
| RAG | Pinecone vector DB |
| Auth | JWT + bcrypt |
| Infra | Docker + Kubernetes |

## Quick Start

```bash
git clone https://github.com/Jung028/startup.git
cd startup
cp backend/.env.example backend/.env
# Add your API keys to backend/.env
docker-compose up -d
```

- Backend API: http://localhost:3001
- Frontend: http://localhost:5173
- Demo login: admin@demo.com / demo1234

## Project Structure

```
├── backend/src/
│   ├── api/              # REST endpoints
│   ├── services/
│   │   ├── llmService.ts       # Claude + GPT-4o dual provider
│   │   ├── ragService.ts       # Pinecone + DB retrieval + Redis cache
│   │   ├── confidence.ts       # 6-factor weighted scoring
│   │   └── workflowExecutor.ts # Automated CRM actions
│   ├── queues/           # BullMQ ticket processor
│   └── db/schema.sql     # Full PostgreSQL schema
│
├── frontend/src/pages/
│   ├── Dashboard.tsx     # Live KPI + charts
│   ├── TicketQueue.tsx   # Filterable ticket list
│   ├── TicketDetail.tsx  # AI review + edit-in-place
│   ├── TicketReview.tsx  # Human-in-the-loop queue
│   ├── Analytics.tsx     # Cost savings + resolution charts
│   └── KnowledgeBase.tsx # RAG document manager
│
├── ml/prompts/           # LLM prompt templates
├── tests/                # Unit + ML accuracy eval
└── infrastructure/k8s/   # Kubernetes manifests
```

## Key API Endpoints

```
POST  /api/tickets                # Create ticket → auto-queued
GET   /api/tickets?status=human_review  # Get review queue
POST  /api/tickets/:id/review     # Approve / edit / reject / escalate
GET   /api/analytics/summary      # KPI overview
POST  /api/crm/zendesk/sync       # Pull from Zendesk
POST  /api/crm/salesforce/sync    # Pull from Salesforce
```

## Confidence Scoring (6 signals)

| Signal | Weight | Description |
|---|---|---|
| RAG Relevance | 30% | Similarity score of retrieved KB docs |
| Response Coherence | 25% | Length, structure, uncertainty markers |
| Ticket Complexity | 15% | Word count, multi-issue detection |
| Channel Reliability | 10% | email/chat/form/api factor |
| Priority Factor | 10% | Critical always escalates |
| Sensitivity Detection | 10% | Billing/legal/account patterns |

**≥0.85** → auto-resolve · **0.60–0.85** → human review · **<0.60** → escalate

## Target Metrics

| Metric | Target |
|---|---|
| Auto-Resolution Rate | ≥80% |
| AI Accuracy (accepted without edits) | ≥80% |
| Cost Reduction | 60–80% |
| Response Latency | <5 seconds |
| SLA Compliance | ≥95% |

## Environment Variables

See `backend/.env.example`. Key vars:
```
ANTHROPIC_API_KEY, PINECONE_API_KEY, DATABASE_URL, REDIS_URL, JWT_SECRET
AUTO_RESOLVE_CONFIDENCE_THRESHOLD=0.85
ESCALATION_CONFIDENCE_THRESHOLD=0.60
```

## License

MIT
