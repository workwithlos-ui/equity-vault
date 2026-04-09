"use client";

import { useState } from "react";
import Link from "next/link";
import { batchIntake, type BatchResult } from "@/lib/api";

export default function BatchPage() {
  const [rawInput, setRawInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult | null>(null);
  const [error, setError] = useState("");

  function parseTargets(text: string) {
    // Each line = one company. Format: "Company Name | website | industry | context"
    // Or just "Company Name"
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return {
          company_name: parts[0],
          website_url: parts[1] || undefined,
          industry: parts[2] || undefined,
          context: parts[3] || undefined,
        };
      });
  }

  async function handleSubmit() {
    const targets = parseTargets(rawInput);
    if (targets.length === 0) {
      setError("Paste at least one company name");
      return;
    }
    setError("");
    setProcessing(true);
    setResults(null);

    try {
      const res = await batchIntake(targets);
      setResults(res);
    } catch (e: any) {
      setError(e.message || "Batch processing failed");
    } finally {
      setProcessing(false);
    }
  }

  const tierColor: Record<string, string> = {
    hot: "text-green-400",
    warm: "text-amber-400",
    cool: "text-slate-400",
    pass: "text-red-400",
  };

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Batch Intake</h1>
          <p className="text-white/40 text-sm mt-1">Paste a list of companies. Profile + score all at once.</p>
        </div>
        <Link href="/dashboard" className="text-amber-500 hover:text-amber-400 text-sm">
          ← Back to Pipeline
        </Link>
      </div>

      {/* Input */}
      <div className="glass rounded-xl p-6 mb-6">
        <label className="block text-sm text-white/60 mb-2">
          One company per line. Optional: <code className="text-amber-500/70">Name | Website | Industry | Context</code>
        </label>
        <textarea
          className="w-full h-48 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/20 font-mono text-sm focus:outline-none focus:border-amber-500/50 resize-none"
          placeholder={`Stripe | stripe.com | Fintech | Series H unicorn\nPlaid | plaid.com | Fintech\nFigma\nNotion | notion.so | Productivity | Collaboration tool`}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          disabled={processing}
        />

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-white/30">
            {parseTargets(rawInput).length} target{parseTargets(rawInput).length !== 1 ? "s" : ""} detected
          </p>
          <button
            onClick={handleSubmit}
            disabled={processing || rawInput.trim().length === 0}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span> Processing...
              </span>
            ) : (
              "Process All"
            )}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {/* Processing Indicator */}
      {processing && (
        <div className="glass rounded-xl p-6 mb-6 text-center">
          <div className="animate-pulse">
            <p className="text-amber-500 text-lg mb-2">Processing batch...</p>
            <p className="text-white/40 text-sm">
              Apollo enrichment → Deterministic scoring → AI brief generation for each target
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="glass rounded-xl p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-white">{results.total}</p>
                <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Total</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-400">{results.succeeded}</p>
                <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Succeeded</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-400">{results.failed}</p>
                <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Failed</p>
              </div>
            </div>
          </div>

          {/* Individual Results */}
          <div className="glass rounded-xl divide-y divide-white/5">
            {results.results.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={r.status === "scored" ? "text-green-400" : "text-red-400"}>
                    {r.status === "scored" ? "✓" : "✗"}
                  </span>
                  <div>
                    <p className="text-white font-medium">{r.company}</p>
                    {r.error && <p className="text-red-400/70 text-xs mt-0.5">{r.error}</p>}
                  </div>
                </div>
                {r.status === "scored" && (
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-mono font-bold ${tierColor[r.tier || "cool"]}`}>
                      {r.composite}/100
                    </span>
                    <span className="text-xs uppercase tracking-wider text-white/40">{r.tier}</span>
                    <Link
                      href={`/deals/${r.deal_id}`}
                      className="text-amber-500 hover:text-amber-400 text-xs"
                    >
                      View →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
