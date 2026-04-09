"""
Scoring Engine — PURE DETERMINISTIC FORMULA. No LLM.
Same inputs = same scores = every time = auditable.

Three dimensions:
  1. Financial Intelligence (40% weight)
  2. Market Position (35% weight)
  3. Risk Evaluation (25% weight — inverted, higher = less risk)
"""


def score_deal(profile: dict) -> dict:
    """
    Takes enriched profile data, returns deterministic scores with evidence.
    """
    company = profile.get("company_data", {})
    people = profile.get("people_data", [])
    web = profile.get("web_data", {})
    data_completeness = profile.get("data_completeness", 0)

    financial = _score_financial(company, web)
    market = _score_market(company, web)
    risk = _score_risk(company, people, web)

    composite = int(
        (financial["score"] * 0.40)
        + (market["score"] * 0.35)
        + (risk["score"] * 0.25)
    )

    if composite >= 75:
        tier = "hot"
    elif composite >= 55:
        tier = "warm"
    elif composite >= 35:
        tier = "cool"
    else:
        tier = "pass"

    # Confidence based on data completeness
    if data_completeness >= 70:
        confidence = "high"
    elif data_completeness >= 40:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "financial_score": financial["score"],
        "financial_evidence": financial["evidence"],
        "market_score": market["score"],
        "market_evidence": market["evidence"],
        "risk_score": risk["score"],
        "risk_evidence": risk["evidence"],
        "composite_score": composite,
        "tier": tier,
        "confidence": confidence,
    }


def _score_financial(company: dict, web: dict) -> dict:
    """Financial Intelligence scoring. Max 100."""
    score = 0
    evidence = []

    # Revenue signal
    revenue_str = company.get("estimated_revenue", "")
    if revenue_str:
        score += 20
        evidence.append({
            "signal": "revenue_estimate_exists",
            "value": revenue_str,
            "points": 20,
            "source": "Apollo org enrichment",
        })
        # Bonus for higher revenue brackets
        rev_lower = revenue_str.lower()
        if any(x in rev_lower for x in ["$10m", "$25m", "$50m", "$100m", "$1b"]):
            score += 15
            evidence.append({
                "signal": "revenue_above_10m",
                "value": revenue_str,
                "points": 15,
                "source": "Apollo org enrichment",
            })
        elif any(x in rev_lower for x in ["$1m", "$5m"]):
            score += 10
            evidence.append({
                "signal": "revenue_1m_to_10m",
                "value": revenue_str,
                "points": 10,
                "source": "Apollo org enrichment",
            })

    # Employee count signals
    emp_count = company.get("employee_count", 0) or 0
    if emp_count > 50:
        score += 15
        evidence.append({"signal": "employees_above_50", "value": emp_count, "points": 15, "source": "Apollo"})
    elif emp_count > 10:
        score += 10
        evidence.append({"signal": "employees_10_to_50", "value": emp_count, "points": 10, "source": "Apollo"})
    elif emp_count > 0:
        score += 5
        evidence.append({"signal": "employees_under_10", "value": emp_count, "points": 5, "source": "Apollo"})

    # Funding signals
    funding = company.get("funding_total")
    if funding and funding > 0:
        score += 15
        evidence.append({
            "signal": "has_funding",
            "value": f"${funding:,.0f}" if isinstance(funding, (int, float)) else str(funding),
            "points": 15,
            "source": "Apollo org enrichment",
        })

    latest_round = company.get("latest_funding_round")
    if latest_round:
        score += 5
        evidence.append({
            "signal": "recent_funding_round",
            "value": latest_round,
            "points": 5,
            "source": "Apollo org enrichment",
        })

    # Pricing page (monetization signal)
    if web.get("has_pricing_page"):
        score += 10
        evidence.append({"signal": "pricing_page_exists", "value": True, "points": 10, "source": "Website scrape"})

    # Careers page (growth signal)
    if web.get("has_careers"):
        score += 5
        evidence.append({"signal": "careers_page_exists", "value": True, "points": 5, "source": "Website scrape"})

    return {"score": min(score, 100), "evidence": evidence}


def _score_market(company: dict, web: dict) -> dict:
    """Market Position scoring. Max 100."""
    score = 0
    evidence = []

    # Industry classification exists
    industry = company.get("industry", "")
    if industry:
        score += 15
        evidence.append({"signal": "industry_identified", "value": industry, "points": 15, "source": "Apollo"})

    # Technology stack signals
    tech = company.get("technologies", [])
    if len(tech) >= 5:
        score += 15
        evidence.append({
            "signal": "modern_tech_stack",
            "value": f"{len(tech)} technologies detected",
            "points": 15,
            "source": "Apollo",
        })
    elif len(tech) > 0:
        score += 8
        evidence.append({
            "signal": "some_tech_detected",
            "value": f"{len(tech)} technologies",
            "points": 8,
            "source": "Apollo",
        })

    # Keywords (market positioning signals)
    keywords = company.get("keywords", [])
    if len(keywords) >= 3:
        score += 10
        evidence.append({
            "signal": "clear_market_positioning",
            "value": ", ".join(keywords[:5]),
            "points": 10,
            "source": "Apollo",
        })

    # Blog / content presence
    if web.get("has_blog"):
        score += 10
        evidence.append({"signal": "active_content", "value": True, "points": 10, "source": "Website scrape"})

    # LinkedIn presence
    if company.get("linkedin_url"):
        score += 10
        evidence.append({"signal": "linkedin_presence", "value": company["linkedin_url"], "points": 10, "source": "Apollo"})

    # Twitter presence
    if company.get("twitter_url"):
        score += 5
        evidence.append({"signal": "twitter_presence", "value": company["twitter_url"], "points": 5, "source": "Apollo"})

    # Company description exists (signal of market clarity)
    desc = company.get("description", "")
    if len(desc) > 50:
        score += 15
        evidence.append({"signal": "clear_description", "value": desc[:100], "points": 15, "source": "Apollo"})

    # Founded year (longevity signal)
    founded = company.get("founded_year")
    if founded:
        years = 2026 - int(founded) if founded else 0
        if years >= 5:
            score += 10
            evidence.append({"signal": "established_company", "value": f"Founded {founded} ({years}yr)", "points": 10, "source": "Apollo"})
        elif years >= 2:
            score += 5
            evidence.append({"signal": "growing_company", "value": f"Founded {founded} ({years}yr)", "points": 5, "source": "Apollo"})

    return {"score": min(score, 100), "evidence": evidence}


def _score_risk(company: dict, people: list, web: dict) -> dict:
    """
    Risk scoring. INVERTED: starts at 100, deductions for risk signals.
    Higher score = LESS risk = better.
    """
    score = 100
    evidence = []

    # No website
    if not web or web.get("error"):
        score -= 25
        evidence.append({"signal": "no_website_accessible", "value": True, "points": -25, "source": "Website scrape"})

    # No revenue signal at all
    if not company.get("estimated_revenue"):
        score -= 15
        evidence.append({"signal": "no_revenue_data", "value": True, "points": -15, "source": "Apollo"})

    # Very small team
    emp = company.get("employee_count", 0) or 0
    if emp == 0:
        score -= 20
        evidence.append({"signal": "no_employee_data", "value": True, "points": -20, "source": "Apollo"})
    elif emp < 5:
        score -= 10
        evidence.append({"signal": "very_small_team", "value": emp, "points": -10, "source": "Apollo"})

    # No key people found
    if len(people) == 0:
        score -= 15
        evidence.append({"signal": "no_leadership_found", "value": True, "points": -15, "source": "Apollo people search"})

    # No LinkedIn presence
    if not company.get("linkedin_url"):
        score -= 10
        evidence.append({"signal": "no_linkedin", "value": True, "points": -10, "source": "Apollo"})

    # No funding and no revenue (bootstrapped unknown)
    if not company.get("funding_total") and not company.get("estimated_revenue"):
        score -= 10
        evidence.append({"signal": "no_funding_no_revenue", "value": True, "points": -10, "source": "Apollo"})

    # No industry classification
    if not company.get("industry"):
        score -= 5
        evidence.append({"signal": "no_industry_classification", "value": True, "points": -5, "source": "Apollo"})

    return {"score": max(score, 0), "evidence": evidence}
