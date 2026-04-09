"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDeals, compareDeals, type Deal, type CompareResult } from "@/lib/api";

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

export default function ComparePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listDeals().then(setDeals).catch(console.error);
  }, []);

  const scoredDeals = deals.filter((d) => d.score);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setResult(null);
  }

  async function handleCompare() {
    if (selected.length < 2) return;
    setLoading(true);
    try {
      const res = await compareDeals(selected);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const tierColor: Record<string, string> = {
    hot: "text-green-400",
    warm: "text-amber-400",
    cool: "text-slate-400",
    pass: "text-red-400",
  };

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Deal Comparison</h1>
          <p className="text-white/40 text-sm mt-1">Select 2–5 scored deals to compare side-by-side</p>
        </div>
        <Link href="/dashboard" className="text-amber-500 hover:text-amber-400 text-sm">
          ← Back to Pipeline
        </Link>
      </div>

      {/* Selector */}
      <div className="glass rounded-xl p-5 mb-6">
        <p className="text-sm text-white/60 mb-3">
          Select deals ({selected.length}/5):
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {scoredDeals.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleSelect(d.id)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                selected.includes(d.id)
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
              }`}
            >
              {d.company_name}
              {d.score && (
                <span className={`ml-2 font-mono text-xs ${tierColor[d.score.tier]}`}>
                  {d.score.composite_score}
                </span>
              )}
            </button>
          ))}
          {scoredDeals.length === 0 && (
            <p className="text-white/30 text-sm">No scored deals yet. Process some deals first.</p>
          )}
        </div>
        <button
          onClick={handleCompare}
          disabled={selected.length < 2 || loading}
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          {loading ? "Comparing..." : `Compare ${selected.length} Deals`}
        </button>
      </div>

      {/* Comparison Table */}
      {result && result.deals.length > 0 && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-white/40 font-medium">Metric</th>
                  {result.deals.map((d) => (
                    <th key={d.id} className="text-center p-4 text-white font-medium min-w-[160px]">
                      <Link href={`/deals/${d.id}`} className="hover:text-amber-400 transition-colors">
                        {d.company_name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {/* Tier */}
                <tr>
                  <td className="p-4 text-white/50">Tier</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4 text-center">
                      <span className={`font-bold uppercase ${tierColor[d.tier]}`}>{d.tier}</span>
                    </td>
                  ))}
                </tr>

                {/* Composite */}
                <tr>
                  <td className="p-4 text-white/50">Composite Score</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4 text-center">
                      <span className="text-white font-bold text-lg">{d.composite_score}</span>
                      <span className="text-white/30">/100</span>
                    </td>
                  ))}
                </tr>

                {/* Financial */}
                <tr>
                  <td className="p-4 text-white/50">Financial</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4">
                      <div className="text-center mb-1 text-white/80">{d.financial_score}</div>
                      <ScoreBar value={d.financial_score} color="bg-green-500" />
                    </td>
                  ))}
                </tr>

                {/* Market */}
                <tr>
                  <td className="p-4 text-white/50">Market</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4">
                      <div className="text-center mb-1 text-white/80">{d.market_score}</div>
                      <ScoreBar value={d.market_score} color="bg-blue-500" />
                    </td>
                  ))}
                </tr>

                {/* Risk */}
                <tr>
                  <td className="p-4 text-white/50">Risk</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4">
                      <div className="text-center mb-1 text-white/80">{d.risk_score}</div>
                      <ScoreBar value={d.risk_score} color="bg-red-500" />
                    </td>
                  ))}
                </tr>

                {/* Confidence */}
                <tr>
                  <td className="p-4 text-white/50">Confidence</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4 text-center text-white/70 capitalize">{d.confidence}</td>
                  ))}
                </tr>

                {/* Industry */}
                <tr>
                  <td className="p-4 text-white/50">Industry</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4 text-center text-white/70">{d.industry || "—"}</td>
                  ))}
                </tr>

                {/* Employees */}
                <tr>
                  <td className="p-4 text-white/50">Employees</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4 text-center text-white/70">
                      {d.employee_count ? d.employee_count.toLocaleString() : "—"}
                    </td>
                  ))}
                </tr>

                {/* Revenue */}
                <tr>
                  <td className="p-4 text-white/50">Revenue</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4 text-center text-white/70">{d.revenue || "—"}</td>
                  ))}
                </tr>

                {/* Decision */}
                <tr>
                  <td className="p-4 text-white/50">Decision</td>
                  {result.deals.map((d) => (
                    <td key={d.id} className="p-4 text-center">
                      {d.decision ? (
                        <span className={d.decision === "advance" ? "text-green-400" : "text-red-400"}>
                          {d.decision.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-white/30">Pending</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
