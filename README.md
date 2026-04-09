# Equity Vault — Deal Intelligence Platform

Autonomous deal intelligence. Input a target company → Apollo enriches → deterministic scoring → AI-generated deal brief → operator reviews and decides.

## Architecture

```
Frontend (Next.js 14)  →  Backend (FastAPI)  →  Apollo API + Claude API
     ↓                         ↓
  8 pages               20 endpoints
  Tailwind CSS          7 DB models
  Glassmorphism UI      6 services
```

## Core Loop

1. **Intake** — Add target company (single or batch)
2. **Profile** — Apollo enriches company data, people, web signals
3. **Score** — Deterministic scoring engine (no LLM). Financial × Market × Risk → Composite
4. **Brief** — Single Claude API call generates evidence-linked deal brief
5. **Decide** — Operator advances, passes, or watches

## Features

- **Pipeline Dashboard** — Kanban + table views with real-time polling
- **Deal Detail** — Score breakdown, AI brief, notes, timeline, outreach generation
- **Batch Intake** — Process multiple companies at once
- **Deal Comparison** — Side-by-side scoring for up to 5 deals
- **Analytics** — Pipeline metrics, tier distribution, conversion rates
- **Watch List** — Monitored deals with re-evaluation scheduling
- **Settings** — Configurable scoring weights and tier thresholds
- **Export** — CSV pipeline export, JSON deal snapshots

## Tech Stack

**Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, Apollo API, Anthropic Claude API
**Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
**Design:** Glassmorphism (deep space gradient, backdrop-blur, amber-500 accent)

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env  # Add your API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APOLLO_API_KEY` | Yes | Apollo.io API key for enrichment |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for brief generation |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL for frontend |

## API Endpoints (20 total)

### Deals (6)
- `POST /api/deals` — Create deal
- `GET /api/deals` — List all deals
- `GET /api/deals/{id}` — Get deal detail
- `POST /api/deals/{id}/profile` — Trigger enrichment
- `POST /api/deals/{id}/score` — Score + generate brief
- `POST /api/deals/{id}/decide` — Advance/pass/watch

### Batch & Extensions (9)
- `POST /api/batch/intake` — Batch process targets
- `POST /api/deals/{id}/notes` — Add note
- `GET /api/deals/{id}/notes` — Get notes
- `POST /api/deals/{id}/outreach` — Generate outreach
- `POST /api/deals/{id}/watch` — Add to watch list
- `GET /api/watch` — Get watch list
- `POST /api/compare` — Compare deals
- `GET /api/settings/scoring` — Get config
- `PUT /api/settings/scoring` — Update config

### Analytics & Export (4)
- `GET /api/analytics` — Pipeline stats
- `GET /api/deals/{id}/timeline` — Activity timeline
- `GET /api/export/pipeline` — CSV export
- `GET /api/export/deals/{id}` — JSON export

## Scoring Engine

Pure deterministic. No LLM. Same inputs = same scores.

```
Composite = (Financial × 0.40) + (Market × 0.35) + (Risk × 0.25)
```

| Tier | Threshold | Meaning |
|------|-----------|---------|
| HOT  | ≥ 75      | High-priority target |
| WARM | ≥ 55      | Worth pursuing |
| COOL | ≥ 35      | Monitor |
| PASS | < 35      | Skip |

Weights and thresholds are configurable via Settings.

## License

Proprietary — Blues Prince Media / Elevated Engagement
