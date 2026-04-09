"""
Profiler Service — enriches a target company using Apollo + web signals.
Apollo does the heavy lifting. One API call = company + people + tech stack + funding.
"""

import httpx
from app.config import get_settings

settings = get_settings()

APOLLO_BASE = "https://api.apollo.io/api/v1"


async def enrich_company(company_name: str, website_url: str | None = None) -> dict:
    """
    Enrich a target company via Apollo organization enrichment.
    Returns structured company data, people, and source URLs.
    """
    company_data = {}
    people_data = []
    web_data = {}
    news_data = []
    raw_sources = []
    data_completeness = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Apollo Organization Enrichment
        try:
            domain = _extract_domain(website_url) if website_url else None
            payload = {"api_key": settings.apollo_api_key}

            if domain:
                payload["domain"] = domain
            else:
                payload["name"] = company_name

            resp = await client.post(
                f"{APOLLO_BASE}/organizations/enrich",
                json=payload,
            )

            if resp.status_code == 200:
                org = resp.json().get("organization", {})
                company_data = {
                    "name": org.get("name", company_name),
                    "domain": org.get("primary_domain", domain),
                    "industry": org.get("industry", ""),
                    "estimated_revenue": org.get("estimated_annual_revenue", ""),
                    "employee_count": org.get("estimated_num_employees", 0),
                    "founded_year": org.get("founded_year"),
                    "hq_city": org.get("city", ""),
                    "hq_state": org.get("state", ""),
                    "hq_country": org.get("country", ""),
                    "description": org.get("short_description", ""),
                    "linkedin_url": org.get("linkedin_url", ""),
                    "twitter_url": org.get("twitter_url", ""),
                    "technologies": org.get("current_technologies", []),
                    "keywords": org.get("keywords", []),
                    "funding_total": org.get("total_funding"),
                    "latest_funding_round": org.get("latest_funding_round_type"),
                    "latest_funding_amount": org.get("latest_funding_amount"),
                    "latest_funding_date": org.get("latest_funding_round_date"),
                    "logo_url": org.get("logo_url", ""),
                    "phone": org.get("phone", ""),
                }
                raw_sources.append({
                    "type": "apollo_org",
                    "url": f"https://app.apollo.io/#/organizations/{org.get('id', '')}",
                    "fetched_at": "auto",
                })
                data_completeness += 40
        except Exception:
            company_data = {"name": company_name, "domain": domain, "error": "Apollo org enrichment failed"}

        # 2. Apollo People Search — top 5 decision makers
        try:
            search_domain = company_data.get("domain") or _extract_domain(website_url)
            if search_domain:
                people_resp = await client.post(
                    f"{APOLLO_BASE}/mixed_people/search",
                    json={
                        "api_key": settings.apollo_api_key,
                        "q_organization_domains": search_domain,
                        "person_seniorities": ["owner", "founder", "c_suite", "vp", "director"],
                        "page": 1,
                        "per_page": 5,
                    },
                )
                if people_resp.status_code == 200:
                    for person in people_resp.json().get("people", []):
                        people_data.append({
                            "name": person.get("name", ""),
                            "title": person.get("title", ""),
                            "linkedin_url": person.get("linkedin_url", ""),
                            "email": person.get("email", ""),
                            "city": person.get("city", ""),
                            "seniority": person.get("seniority", ""),
                        })
                    raw_sources.append({
                        "type": "apollo_people",
                        "url": "https://app.apollo.io",
                        "fetched_at": "auto",
                    })
                    data_completeness += 20
        except Exception:
            pass  # people enrichment is nice-to-have, don't block

        # 3. Website signals — basic scrape of homepage
        if website_url:
            try:
                web_resp = await client.get(
                    website_url,
                    follow_redirects=True,
                    headers={"User-Agent": "EquityVault/1.0"},
                )
                if web_resp.status_code == 200:
                    html = web_resp.text[:50000]  # cap at 50k chars
                    web_data = {
                        "has_pricing_page": "/pricing" in html.lower(),
                        "has_blog": "/blog" in html.lower(),
                        "has_careers": "/careers" in html.lower() or "/jobs" in html.lower(),
                        "page_title": _extract_title(html),
                        "meta_description": _extract_meta_desc(html),
                    }
                    raw_sources.append({
                        "type": "website",
                        "url": website_url,
                        "fetched_at": "auto",
                    })
                    data_completeness += 20
            except Exception:
                web_data = {"error": "Could not fetch website"}

        # 4. News — use Apollo or simple search
        # For MVP, we pull from company description + any news API later
        # Placeholder: use company keywords as signals
        if company_data.get("keywords"):
            news_data = [{"signal": kw} for kw in company_data["keywords"][:5]]
            data_completeness += 10

        # 5. Fill remaining data completeness
        if company_data.get("estimated_revenue"):
            data_completeness += 10

    return {
        "company_data": company_data,
        "people_data": people_data,
        "web_data": web_data,
        "news_data": news_data,
        "raw_sources": raw_sources,
        "data_completeness": min(data_completeness, 100),
    }


def _extract_domain(url: str | None) -> str | None:
    if not url:
        return None
    url = url.replace("https://", "").replace("http://", "").replace("www.", "")
    return url.split("/")[0]


def _extract_title(html: str) -> str:
    try:
        start = html.lower().index("<title>") + 7
        end = html.lower().index("</title>")
        return html[start:end].strip()[:200]
    except ValueError:
        return ""


def _extract_meta_desc(html: str) -> str:
    try:
        idx = html.lower().index('name="description"')
        content_start = html.lower().index('content="', idx) + 9
        content_end = html.index('"', content_start)
        return html[content_start:content_end].strip()[:500]
    except (ValueError, IndexError):
        return ""
