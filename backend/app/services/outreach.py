"""
Outreach Brief Generator — auto-generates personalized outreach when a deal is advanced.
Uses deal profile + scores + brief to create tactical outreach materials.
"""

import anthropic
from app.config import get_settings

settings = get_settings()


async def generate_outreach_brief(
    company_name: str,
    profile: dict,
    scores: dict,
    brief_md: str,
) -> dict:
    """
    Generate outreach materials: cold email, talking points, objection handlers.
    """
    company = profile.get("company_data", {})
    people = profile.get("people_data", [])

    # Build contact list for outreach targeting
    contacts_str = ""
    for p in people[:3]:
        contacts_str += f"- {p.get('name', 'Unknown')}, {p.get('title', 'Unknown')} ({p.get('email', 'no email')})\n"

    prompt = f"""You are a deal sourcing analyst preparing outreach materials for Equity Vault.

TARGET: {company_name}
DOMAIN: {company.get('domain', 'N/A')}
INDUSTRY: {company.get('industry', 'Unknown')}
EMPLOYEES: {company.get('employee_count', 'Unknown')}
REVENUE: {company.get('estimated_revenue', 'Unknown')}
DESCRIPTION: {company.get('description', 'N/A')}

KEY CONTACTS:
{contacts_str or 'No contacts found — will need manual research.'}

COMPOSITE SCORE: {scores.get('composite_score', 0)}/100 ({scores.get('tier', 'unknown').upper()})
CONFIDENCE: {scores.get('confidence', 'low')}

DEAL BRIEF SUMMARY (first 500 chars):
{brief_md[:500]}

---

Generate outreach materials in this EXACT format:

## Outreach Strategy

### Primary Target
[Who to contact first and why — based on people data]

### Angle
[2-3 sentences: what's the hook? Why would they take a meeting? What value can we offer or what opportunity can we present?]

### Cold Email Draft

Subject: [compelling subject line — not salesy, not generic]

[Body: 4-6 sentences max. Personalized to the company. Reference something specific from the research. Clear ask for a conversation. Professional but direct.]

### Talking Points (If They Respond)
1. [Key point about their business that shows you did homework]
2. [Specific opportunity or challenge you can speak to]
3. [Value proposition relevant to their situation]
4. [Open-ended question to get them talking]

### Likely Objections & Responses
- **"Not interested in selling"** → [response]
- **"How did you find us?"** → [response]
- **"What's your offer?"** → [response]

### Risk Points to Probe
[2-3 things from the risk analysis that need answers during conversation]

RULES:
- Be specific to THIS company. No generic outreach.
- Reference actual data from the research.
- Keep the email under 100 words.
- Make the talking points actionable, not vague.
- Tone: professional, direct, informed. Not desperate."""

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    return {
        "outreach_md": message.content[0].text,
        "target_contacts": people[:3],
    }
