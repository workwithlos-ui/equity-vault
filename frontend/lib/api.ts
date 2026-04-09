const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ── Types ──────────────────────────────────────────────

export interface Deal {
  id: string;
  company_name: string;
  website_url: string | null;
  industry: string | null;
  context: string | null;
  stage: string;
  created_at: string;
  updated_at: string;
  profile?: {
    company_data: Record<string, any>;
    people_data: any[];
    web_data: Record<string, any>;
    news_data: Record<string, any>;
    data_completeness: number;
    raw_sources: any[];
  };
  score?: {
    financial_score: number;
    market_score: number;
    risk_score: number;
    composite_score: number;
    confidence: string;
    tier: string;
    brief_md: string;
    brief_evidence: any[];
    financial_evidence: any[];
    market_evidence: any[];
    risk_evidence: any[];
    operator_decision: string | null;
    operator_notes: string | null;
    decision_at: string | null;
  };
}

export interface PipelineStats {
  total_deals: number;
  stage_counts: Record<string, number>;
  tier_counts: Record<string, number>;
  decision_counts: Record<string, number>;
  conversion_rate: number;
  avg_composite: number;
  avg_financial: number;
  avg_market: number;
  avg_risk: number;
  score_distribution: { range: string; count: number }[];
  recent_activity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  deal_id: string;
  action_type: string;
  actor: string;
  summary: string;
  metadata?: Record<string, any>;
  created_at: string | null;
}

export interface DealNote {
  id: string;
  content: string;
  note_type: string;
  author: string;
  created_at: string | null;
}

export interface WatchListItem {
  deal_id: string;
  company_name: string;
  reason: string;
  reeval_interval_days: string;
  next_reeval_at: string | null;
  overdue: boolean;
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  results: {
    company: string;
    deal_id?: string;
    status: string;
    composite?: number;
    tier?: string;
    error?: string;
  }[];
}

export interface ScoringConfig {
  financial_weight: number;
  market_weight: number;
  risk_weight: number;
  hot_threshold: number;
  warm_threshold: number;
  cool_threshold: number;
}

export interface OutreachResult {
  outreach_md: string;
  target_contacts: any[];
}

export interface CompareResult {
  deals: {
    id: string;
    company_name: string;
    industry: string;
    stage: string;
    composite_score: number;
    financial_score: number;
    market_score: number;
    risk_score: number;
    tier: string;
    confidence: string;
    employee_count: number | null;
    revenue: string | null;
    decision: string | null;
  }[];
  count: number;
}

// ── Core Deal CRUD ─────────────────────────────────────

export async function listDeals(): Promise<Deal[]> {
  const res = await fetch(`${API_URL}/api/deals`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch deals");
  return res.json();
}

export async function getDeal(id: string): Promise<Deal> {
  const res = await fetch(`${API_URL}/api/deals/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch deal");
  return res.json();
}

export async function createDeal(data: {
  company_name: string;
  website_url?: string;
  industry?: string;
  context?: string;
}): Promise<Deal> {
  const res = await fetch(`${API_URL}/api/deals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create deal");
  return res.json();
}

export async function profileDeal(id: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/deals/${id}/profile`, { method: "POST" });
  if (!res.ok) throw new Error("Profiling failed");
  return res.json();
}

export async function scoreDeal(id: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/deals/${id}/score`, { method: "POST" });
  if (!res.ok) throw new Error("Scoring failed");
  return res.json();
}

export async function decideDeal(
  id: string,
  decision: "advance" | "pass",
  notes?: string
): Promise<any> {
  const res = await fetch(`${API_URL}/api/deals/${id}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, notes }),
  });
  if (!res.ok) throw new Error("Decision failed");
  return res.json();
}

// ── Batch Intake ───────────────────────────────────────

export async function batchIntake(
  targets: { company_name: string; website_url?: string; industry?: string; context?: string }[]
): Promise<BatchResult> {
  const res = await fetch(`${API_URL}/api/batch/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targets }),
  });
  if (!res.ok) throw new Error("Batch intake failed");
  return res.json();
}

// ── Notes ──────────────────────────────────────────────

export async function addNote(
  dealId: string,
  content: string,
  noteType: string = "general",
  author: string = "King"
): Promise<any> {
  const res = await fetch(`${API_URL}/api/deals/${dealId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, note_type: noteType, author }),
  });
  if (!res.ok) throw new Error("Failed to add note");
  return res.json();
}

export async function getNotes(dealId: string): Promise<DealNote[]> {
  const res = await fetch(`${API_URL}/api/deals/${dealId}/notes`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

// ── Outreach ───────────────────────────────────────────

export async function generateOutreach(dealId: string): Promise<OutreachResult> {
  const res = await fetch(`${API_URL}/api/deals/${dealId}/outreach`, { method: "POST" });
  if (!res.ok) throw new Error("Outreach generation failed");
  return res.json();
}

// ── Watch List ─────────────────────────────────────────

export async function addToWatch(
  dealId: string,
  reason: string,
  reevalDays: number = 30
): Promise<any> {
  const res = await fetch(`${API_URL}/api/deals/${dealId}/watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, reeval_days: reevalDays }),
  });
  if (!res.ok) throw new Error("Failed to add to watch list");
  return res.json();
}

export async function getWatchList(): Promise<WatchListItem[]> {
  const res = await fetch(`${API_URL}/api/watch`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch watch list");
  return res.json();
}

// ── Comparison ─────────────────────────────────────────

export async function compareDeals(dealIds: string[]): Promise<CompareResult> {
  const res = await fetch(`${API_URL}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deal_ids: dealIds }),
  });
  if (!res.ok) throw new Error("Comparison failed");
  return res.json();
}

// ── Analytics ──────────────────────────────────────────

export async function getAnalytics(): Promise<PipelineStats> {
  const res = await fetch(`${API_URL}/api/analytics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function getDealTimeline(dealId: string): Promise<ActivityItem[]> {
  const res = await fetch(`${API_URL}/api/deals/${dealId}/timeline`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

// ── Export ──────────────────────────────────────────────

export async function exportPipelineCSV(): Promise<string> {
  const res = await fetch(`${API_URL}/api/export/pipeline`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to export pipeline");
  return res.text();
}

export async function exportDealJSON(dealId: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/export/deals/${dealId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to export deal");
  return res.json();
}

// ── Settings ───────────────────────────────────────────

export async function getScoringConfig(): Promise<ScoringConfig> {
  const res = await fetch(`${API_URL}/api/settings/scoring`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch scoring config");
  return res.json();
}

export async function updateScoringConfig(config: ScoringConfig): Promise<any> {
  const res = await fetch(`${API_URL}/api/settings/scoring`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update scoring config");
  return res.json();
}
