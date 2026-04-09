"""
Brief Generator — the ONLY LLM call in the entire system.
Takes profile data + scores, produces a structured deal brief in markdown.
Every claim must cite its source.
"""

import anthropic
from app.config import get_settings

settings = get_settings()


async def generate_brief(
    company_name: str,
    profile: dict,
    scores: dict,
) -> dict:
    """
    Generate a deal brief using Claude. Returns markdown + evidence map.
    """
    company = profile.get("company_data", {})
    people = profile.get("people_data", [])
    web = profile.get("web_data", {})
    sources = profile.get("raw_sources", [])

    # Build the prompt with all evidence
    prompt = f"""You are a deal analyst at Equity Vault writing a structured deal brief.

TARGET: {company_name}
WEBSITE: {company.get('domain', 'N/A')}

COMPANY DATA (from Apollo):
- Industry: {company.get('industry', 'Unknown')}
- Employees: {company.get('employee_count', 'Unknown')}
- Revenue Estimate: {company.get('estimated_revenue', 'No data')}
- Founded: {company.get('founded_year', 'Unknown')}
- HQ: {company.get('hq_city', '')}, {company.get('hq_state', '')}
- Description: {company.get('description', 'No description available')}
- Technologies: {', '.join(company.get('technologies', [])[:10]) or 'None detected'}
- Total Funding: {company.get('funding_total', 'No data')}
- Latest Round: {company.get('latest_funding_round', 'None')} — {company.get('latest_funding_amount', 'N/A')}
- LinkedIn: {company.get('linkedin_url', 'None')}

KEY PEOPLE:
{_format_people(people)}

WEBSITE SIGNALS:
- Pricing page: {'Yes' if web.get('has_pricing_page') else 'No'}
- Blog: {'Yes' if web.get('has_blog') else 'No'}
- Careers page: {'Yes' if web.get('has_careers') else 'No'}

SCORES:
- Financial: {scores.get('financial_score', 0)}/100 (confidence: {scores.get('confidence', 'low')})
- Market: {scores.get('market_score', 0)}/100
- Risk: {scores.get('risk_score', 0)}/100 (higher = less risk)
- Composite: {scores.get('composite_score', 0)}/100
- Tier: {scores.get('tier', 'unknown').upper()}

FINANCIAL EVIDENCE:
{_format_evidence(scores.get('financial_evidence', []))}

MARKET EVIDENCE:
{_format_evidence(scores.get('market_evidence', []))}

RISK EVIDENCE:
{_format_evidence(scores.get('risk_evidence', []))}

---

Write the deal brief in this EXACT format:

## Executive Summary

[2 paragraphs max. Company name, what they do, composite score, tier classification, and your headline assessment. Be specific with numbers.]

## Financial Intelligence

[Key financial signals. Every claim cites the data point and source in parentheses. If data is limited, say so.]

## Market Position

[Market signals only — do NOT estimate TAM. Present what was found about their positioning, tech stack, content presence, and market clarity.]

## Risk Factors

[Identified risks with evidence. Include mitigants where data supports them. Be specific.]

## Scoring Breakdown

| Dimension | Score | Key Signal |
|-----------|-------|------------|
| Financial | {scores.get('financial_score', 0)}/100 | [top signal] |
| Market | {scores.get('market_score', 0)}/100 | [top signal] |
| Risk | {scores.get('risk_score', 0)}/100 | [top signal] |
| **Composite** | **{scores.get('composite_score', 0)}/100** | **{scores.get('tier', '').upper()}** |

## Key People

[List decision-makers found with titles. Note gaps if no leadership data.]

## Recommended Next Steps

[2-3 specific actions if the operator wants to advance this deal. Be tactical.]

RULES:
- Every factual claim MUST cite the specific source in parentheses — e.g. "(Apollo enrichment)" or "(Website scrape)"
- Do NOT estimate TAM or market size
- Do NOT make claims without data
- If data is limited on a dimension, say: "Data limited — confidence reduced"
- Keep it tight. No filler. No motivational language.
- Use specific numbers everywhere possible."""

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    brief_md = message.content[0].text

    # Build evidence map from sources
    brief_evidence = sources + [
        {"type": "scoring_model", "version": "v1.0", "method": "deterministic_formula"}
    ]

    return {
        "brief_md": brief_md,
        "brief_evidence": brief_evidence,
    }


def _format_people(people: list) -> str:
    if not people:
        return "No key people found."
    lines = []
    for p in people:
        lines.append(f"- {p.get('name', 'Unknown')} — {p.get('title', 'Unknown')} ({p.get('linkedin_url', 'no LinkedIn')})")
    return "\n".join(lines)


def _format_evidence(evidence: list) -> str:
    if not evidence:
        return "No evidence collected."
    lines = []
    for e in evidence:
        lines.append(f"- {e.get('signal', '')}: {e.get('value', '')} ({e.get('points', 0):+d} pts, source: {e.get('source', 'unknown')})")
    return "\n".join(lines)
