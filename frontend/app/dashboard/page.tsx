"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DealCard from "@/components/DealCard";
import { listDeals, createDeal, profileDeal, scoreDeal, exportPipelineCSV, type Deal } from "@/lib/api";

const COLUMNS = [
  { key: "new", label: "New", stages: ["intake", "profiling"] },
  { key: "scored", label: "Scored", stages: ["scored"] },
  { key: "reviewed", label: "Reviewed", stages: ["reviewed"] },
  { key: "decided", label: "Decided", stages: ["advanced", "passed", "watching"] },
];

const tierColors: Record<string, string> = {
  hot: "text-green-400",
  warm: "text-amber-400",
  cool: "text-slate-400",
  pass: "text-red-400",
};

type ViewMode = "kanban" | "table";

export default function Dashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [context, setContext] = useState("");

  const fetchDeals = useCallback(async () => {
    try {
      const data = await listDeals();
      setDeals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
    const interval = setInterval(fetchDeals, 5000);
    return () => clearInterval(interval);
  }, [fetchDeals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setProcessing(true);
    try {
      const deal = await createDeal({
        company_name: companyName.trim(),
        website_url: websiteUrl.trim() || undefined,
        industry: industry.trim() || undefined,
        context: context.trim() || undefined,
      });
      await profileDeal(deal.id);
      await scoreDeal(deal.id);
      await fetchDeals();
      setCompanyName("");
      setWebsiteUrl("");
      setIndustry("");
      setContext("");
      setShowForm(false);
    } catch (e) {
      console.error(e);
      alert("Failed to process deal. Check API connection.");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await exportPipelineCSV();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "equity_vault_pipeline.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const getColumnDeals = (stages: string[]) => deals.filter((d) => stages.includes(d.stage));

  const hotCount = deals.filter((d) => d.score?.tier === "hot").length;
  const scoredCount = deals.filter((d) => d.score).length;

  return (
    <div>
      {/* Nav Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { href: "/analytics", label: "Analytics" },
          { href: "/batch", label: "Batch Intake" },
          { href: "/compare", label: "Compare" },
          { href: "/watchlist", label: "Watch List" },
          { href: "/settings", label: "Settings" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white hover:border-white/20 transition-all"
          >
            {link.label}
          </Link>
        ))}
        <button
          onClick={handleExportCSV}
          className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white hover:border-white/20 transition-all"
        >
          Export CSV
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Deal Pipeline</h1>
          <p className="text-white/40 text-sm mt-1">
            {deals.length} targets &middot; {hotCount} hot &middot; {scoredCount} scored
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === "kanban" ? "bg-amber-500/20 text-amber-400" : "text-white/40"}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === "table" ? "bg-amber-500/20 text-amber-400" : "text-white/40"}`}
            >
              Table
            </button>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            + New Target
          </button>
        </div>
      </div>

      {/* New deal form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-6 mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1 font-medium">Company Name *</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="Acme Corp" required />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1 font-medium">Website URL</label>
              <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="https://acme.com" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1 font-medium">Industry</label>
              <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="SaaS, Fintech, Healthcare..." />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1 font-medium">Context</label>
              <input type="text" value={context} onChange={(e) => setContext(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="Why are we looking at this?" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={processing}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/30 text-black font-semibold text-sm rounded-lg transition-colors">
              {processing ? "Processing..." : "Analyze Target"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-white/40 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            {processing && (
              <span className="text-xs text-amber-500/70 animate-pulse">
                Enriching via Apollo → Scoring → Generating brief...
              </span>
            )}
          </div>
        </form>
      )}

      {/* Loading */}
      {loading && <div className="text-center text-white/30 py-20">Loading pipeline...</div>}

      {/* KANBAN VIEW */}
      {!loading && viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {COLUMNS.map((col) => {
            const colDeals = getColumnDeals(col.stages);
            return (
              <div key={col.key}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white/60">{col.label}</h2>
                  <span className="text-xs text-white/30 font-mono">{colDeals.length}</span>
                </div>
                <div className="space-y-3">
                  {colDeals.length === 0 ? (
                    <div className="glass p-4 text-center text-white/20 text-xs">No deals</div>
                  ) : (
                    colDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {!loading && viewMode === "table" && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-white/40 font-medium">Company</th>
                  <th className="text-left p-3 text-white/40 font-medium">Industry</th>
                  <th className="text-center p-3 text-white/40 font-medium">Stage</th>
                  <th className="text-center p-3 text-white/40 font-medium">Score</th>
                  <th className="text-center p-3 text-white/40 font-medium">FIN</th>
                  <th className="text-center p-3 text-white/40 font-medium">MKT</th>
                  <th className="text-center p-3 text-white/40 font-medium">RSK</th>
                  <th className="text-center p-3 text-white/40 font-medium">Tier</th>
                  <th className="text-center p-3 text-white/40 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deals.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <Link href={`/deals/${d.id}`} className="text-white hover:text-amber-400 transition-colors font-medium">
                        {d.company_name}
                      </Link>
                    </td>
                    <td className="p-3 text-white/50">{d.industry || "—"}</td>
                    <td className="p-3 text-center">
                      <span className="text-xs text-white/40 px-2 py-0.5 bg-white/5 rounded">{d.stage}</span>
                    </td>
                    <td className="p-3 text-center">
                      {d.score ? (
                        <span className={`font-mono font-bold ${tierColors[d.score.tier]}`}>
                          {d.score.composite_score}
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-white/60 font-mono">{d.score?.financial_score ?? "—"}</td>
                    <td className="p-3 text-center text-white/60 font-mono">{d.score?.market_score ?? "—"}</td>
                    <td className="p-3 text-center text-white/60 font-mono">{d.score?.risk_score ?? "—"}</td>
                    <td className="p-3 text-center">
                      {d.score?.tier ? (
                        <span className={`text-xs font-semibold uppercase ${tierColors[d.score.tier]}`}>
                          {d.score.tier}
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {d.score?.operator_decision ? (
                        <span className={d.score.operator_decision === "advance" ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
                          {d.score.operator_decision}
                        </span>
                      ) : d.stage === "watching" ? (
                        <span className="text-amber-400 text-xs">watching</span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {deals.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-white/30">No deals yet. Add a target to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
