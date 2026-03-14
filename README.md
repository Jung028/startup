# AutoSupport AI

An AI-powered customer support ticket resolution dashboard built with the Claude API.

## Features

- **AI Response Generation** — uses Claude claude-sonnet-4-20250514 + RAG knowledge base to draft responses
- **Human-in-the-loop** — agents can approve, edit, or escalate AI responses
- **Live Metrics** — tracks resolution rate, avg response time, and escalations
- **Priority Handling** — High / Medium / Low ticket prioritisation
- **No build step** — pure HTML/CSS/JS, open in any browser

## Setup

1. Clone the repo
2. Open `index.html`
3. Replace `YOUR_API_KEY_HERE` in the script with your [Anthropic API key](https://console.anthropic.com/)
4. Open in a browser — no server needed

## PRD Coverage (v1.0 MVP)

| Requirement | Status |
|---|---|
| AI resolution engine (LLM + RAG) | ✅ |
| Human review (approve / edit / escalate) | ✅ |
| Dashboard with resolution rate & escalations | ✅ |
| SLA-aware priority display | ✅ |
| Ticket ingestion (demo data) | ✅ |
| CRM integrations (Zendesk, Salesforce) | 🔜 Phase 2 |
| Multilingual support | 🔜 Phase 2 |
| Sentiment detection | 🔜 Phase 2 |

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- No frameworks, no build tools

## License

MIT
