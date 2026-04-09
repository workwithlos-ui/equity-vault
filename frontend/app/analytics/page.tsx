"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnalytics, type PipelineStats, type ActivityItem } from "@/lib/api";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass rounded-xl p-5">
      <p className="text-xs uppercase tracking-wider text-white/40 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/50 mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data, label }: { data: { range: string; count: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="glass rounded-xl p-5">
      <p className="text-sm font-medium text-white/70 mb-4">{label}</p>
      <div className="flex items-end gap-1 h-32">
        {data.map((d) => (
          <div key={d.range} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-amber-500/80 rounded-t transition-all"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
            />
            <span className="text-[9px] text-white/40 rotate-[-45deg] origin-top-left whitespace-nowrap">
              {d.range}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierBadge({ tier, count }: { tier: string; count: number }) {
  const colors: Record<string, string> = {
    hot: "bg-green-500/20 text-green-400 border-green-500/30",
    warm: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    cool: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    pass: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${colors[tier] || colors.cool}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs uppercase tracking-wider mt-1">{tier}</p>
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const icons: Record<string, string> = {
    batch_imported: "📥",
    profiled: "🔍",
    scored: "📊",
    decision_advance: "✅",
    decision_pass: "❌",
    decision_watch: "👁",
    note_added: "📝",
    outreach_generated: "📧",
  };

  return (
    <div className="glass rounded-xl p-5">
      <p className="text-sm font-medium text-white/70 mb-4">Recent Activity</p>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {items.length === 0 && <p className="text-white/30 text-sm">No activity yet</p>}
        {items.map((a) => (
          <div key={a.id} className="flex items-start gap-3 text-sm">
            <span className="text-base">{icons[a.action_type] || "•"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 truncate">{a.summary}</p>
              <p className="text-white/30 text-xs mt-0.5">
                {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-amber-500 text-lg">Loading analytics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/50">Failed to load analytics</p>
      </div>
    );
  }

  const tiers = ["hot", "warm", "cool", "pass"];

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline Analytics</h1>
          <p className="text-white/40 text-sm mt-1">Real-time deal intelligence metrics</p>
        </div>
        <Link href="/dashboard" className="text-amber-500 hover:text-amber-400 text-sm">
          ← Back to Pipeline
        </Link>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Deals" value={stats.total_deals} />
        <StatCard label="Avg Composite" value={stats.avg_composite} sub="/100" />
        <StatCard label="Conversion Rate" value={`${stats.conversion_rate}%`} sub="advance vs pass" />
        <StatCard
          label="Decided"
          value={(stats.decision_counts.advance || 0) + (stats.decision_counts.pass || 0)}
          sub={`${stats.decision_counts.advance || 0} advanced / ${stats.decision_counts.pass || 0} passed`}
        />
      </div>

      {/* Tier Breakdown */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Tier Distribution</p>
        <div className="grid grid-cols-4 gap-3">
          {tiers.map((t) => (
            <TierBadge key={t} tier={t} count={stats.tier_counts[t] || 0} />
          ))}
        </div>
      </div>

      {/* Stage Pipeline */}
      <div className="glass rounded-xl p-5 mb-6">
        <p className="text-sm font-medium text-white/70 mb-4">Pipeline Stages</p>
        <div className="flex gap-2">
          {["intake", "profiling", "scored", "reviewed", "advanced", "passed", "watching"].map((stage) => {
            const count = stats.stage_counts[stage] || 0;
            const total = stats.total_deals || 1;
            return (
              <div key={stage} className="flex-1 text-center">
                <div className="h-16 bg-white/5 rounded-lg relative overflow-hidden mb-2">
                  <div
                    className="absolute bottom-0 w-full bg-amber-500/40 rounded-lg transition-all"
                    style={{ height: `${(count / total) * 100}%`, minHeight: count > 0 ? "8px" : "0" }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                    {count}
                  </span>
                </div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{stage}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Averages + Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Avg Score Bars */}
        <div className="glass rounded-xl p-5">
          <p className="text-sm font-medium text-white/70 mb-4">Average Scores</p>
          {[
            { label: "Financial", value: stats.avg_financial, color: "bg-green-500" },
            { label: "Market", value: stats.avg_market, color: "bg-blue-500" },
            { label: "Risk", value: stats.avg_risk, color: "bg-red-500" },
            { label: "Composite", value: stats.avg_composite, color: "bg-amber-500" },
          ].map((s) => (
            <div key={s.label} className="mb-3">
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>{s.label}</span>
                <span>{s.value}/100</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${s.value}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Score Distribution Histogram */}
        <BarChart data={stats.score_distribution} label="Score Distribution" />
      </div>

      {/* Activity Feed */}
      <ActivityFeed items={stats.recent_activity} />
    </main>
  );
}
