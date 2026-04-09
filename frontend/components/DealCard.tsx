"use client";

import Link from "next/link";
import type { Deal } from "@/lib/api";

const tierColors: Record<string, string> = {
  hot: "tier-hot",
  warm: "tier-warm",
  cool: "tier-cool",
  pass: "tier-pass",
};

const stageLabels: Record<string, string> = {
  intake: "New",
  profiling: "Profiling...",
  scored: "Scored",
  reviewed: "Reviewed",
  advanced: "Advanced",
  passed: "Passed",
  watching: "Watching",
};

export default function DealCard({ deal }: { deal: Deal }) {
  const score = deal.score;
  const tier = score?.tier || "cool";
  const composite = score?.composite_score || 0;
  const confidence = score?.confidence || "—";
  const daysSince = Math.floor(
    (Date.now() - new Date(deal.created_at).getTime()) / 86400000
  );

  // Decision indicator
  const decision = score?.operator_decision;
  const isWatching = deal.stage === "watching";

  // Employee count from profile
  const employees = deal.profile?.company_data?.employee_count;

  return (
    <Link href={`/deals/${deal.id}`}>
      <div className={`glass glass-hover p-4 cursor-pointer transition-all duration-200 ${
        decision === "advance" ? "border-l-2 border-l-green-500/50" :
        decision === "pass" ? "border-l-2 border-l-red-500/50" :
        isWatching ? "border-l-2 border-l-amber-500/50" : ""
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">
              {deal.company_name}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              {deal.industry || "Unknown industry"}
              {employees ? ` · ${employees.toLocaleString()} emp` : ""}
            </p>
          </div>
          {score && (
            <div className="text-right ml-2">
              <span className={`text-2xl font-bold font-mono ${tierColors[tier]}`}>
                {composite}
              </span>
              <p className={`text-xs font-semibold uppercase ${tierColors[tier]}`}>
                {tier}
              </p>
            </div>
          )}
        </div>

        {/* Score bars */}
        {score && (
          <div className="space-y-1.5 mb-3">
            <ScoreRow label="FIN" value={score.financial_score} />
            <ScoreRow label="MKT" value={score.market_score} />
            <ScoreRow label="RSK" value={score.risk_score} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-white/30">
          <span className={`px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${
            isWatching ? "text-amber-400/60 border-amber-500/20" : ""
          }`}>
            {stageLabels[deal.stage] || deal.stage}
          </span>
          <div className="flex items-center gap-2">
            {decision && (
              <span className={`text-[10px] font-semibold uppercase ${
                decision === "advance" ? "text-green-400/70" : "text-red-400/70"
              }`}>
                {decision === "advance" ? "ADV" : "PASS"}
              </span>
            )}
            {score && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  confidence === "high"
                    ? "bg-green-500/10 text-green-400"
                    : confidence === "medium"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {confidence}
              </span>
            )}
            <span>{daysSince}d</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? "bg-green-500" : value >= 45 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-white/40 w-6">{label}</span>
      <div className="score-bar flex-1">
        <div className={`score-bar-fill ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-mono text-white/50 w-6 text-right">{value}</span>
    </div>
  );
}
