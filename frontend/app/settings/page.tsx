"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getScoringConfig, updateScoringConfig, type ScoringConfig } from "@/lib/api";

export default function SettingsPage() {
  const [config, setConfig] = useState<ScoringConfig>({
    financial_weight: 0.4,
    market_weight: 0.35,
    risk_weight: 0.25,
    hot_threshold: 75,
    warm_threshold: 55,
    cool_threshold: 35,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getScoringConfig()
      .then((c) => { setConfig(c); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const weightSum = config.financial_weight + config.market_weight + config.risk_weight;
  const weightsValid = Math.abs(weightSum - 1.0) < 0.011;

  async function handleSave() {
    if (!weightsValid) {
      setError("Weights must sum to 1.0");
      return;
    }
    setError("");
    setSaving(true);
    setSaved(false);
    try {
      await updateScoringConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function WeightSlider({
    label,
    value,
    onChange,
    color,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    color: string;
  }) {
    return (
      <div className="mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/60">{label}</span>
          <span className="text-white font-mono">{(value * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value * 100}
          onChange={(e) => onChange(parseInt(e.target.value) / 100)}
          className={`w-full h-2 rounded-full appearance-none cursor-pointer ${color}`}
          style={{
            background: `linear-gradient(to right, ${color === "accent-green-500" ? "#22c55e" : color === "accent-blue-500" ? "#3b82f6" : "#ef4444"} ${value * 100}%, rgba(255,255,255,0.05) ${value * 100}%)`,
          }}
        />
      </div>
    );
  }

  function ThresholdInput({
    label,
    value,
    onChange,
    color,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    color: string;
  }) {
    return (
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-white/60 text-sm w-16">{label}</span>
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-center font-mono text-sm focus:outline-none focus:border-amber-500/50"
        />
        <span className="text-white/30 text-xs">and above</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-amber-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Scoring Settings</h1>
          <p className="text-white/40 text-sm mt-1">Configure weights and tier thresholds</p>
        </div>
        <Link href="/dashboard" className="text-amber-500 hover:text-amber-400 text-sm">
          ← Back to Pipeline
        </Link>
      </div>

      {/* Weights */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Score Weights</h2>
        <p className="text-white/40 text-xs mb-6">Must sum to 100%</p>

        <WeightSlider
          label="Financial Weight"
          value={config.financial_weight}
          onChange={(v) => setConfig({ ...config, financial_weight: v })}
          color="accent-green-500"
        />
        <WeightSlider
          label="Market Weight"
          value={config.market_weight}
          onChange={(v) => setConfig({ ...config, market_weight: v })}
          color="accent-blue-500"
        />
        <WeightSlider
          label="Risk Weight"
          value={config.risk_weight}
          onChange={(v) => setConfig({ ...config, risk_weight: v })}
          color="accent-red-500"
        />

        <div className={`text-sm font-mono mt-2 ${weightsValid ? "text-green-400" : "text-red-400"}`}>
          Total: {(weightSum * 100).toFixed(0)}% {weightsValid ? "✓" : "— must equal 100%"}
        </div>
      </div>

      {/* Tier Thresholds */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Tier Thresholds</h2>
        <p className="text-white/40 text-xs mb-6">Composite score cutoffs for tier assignment</p>

        <div className="space-y-4">
          <ThresholdInput
            label="Hot"
            value={config.hot_threshold}
            onChange={(v) => setConfig({ ...config, hot_threshold: v })}
            color="bg-green-500"
          />
          <ThresholdInput
            label="Warm"
            value={config.warm_threshold}
            onChange={(v) => setConfig({ ...config, warm_threshold: v })}
            color="bg-amber-500"
          />
          <ThresholdInput
            label="Cool"
            value={config.cool_threshold}
            onChange={(v) => setConfig({ ...config, cool_threshold: v })}
            color="bg-slate-500"
          />
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-white/60 text-sm w-16">Pass</span>
            <span className="text-white/30 text-xs">Below {config.cool_threshold}</span>
          </div>
        </div>

        {/* Visual Preview */}
        <div className="mt-6 h-4 rounded-full overflow-hidden flex">
          <div className="bg-red-500/60" style={{ width: `${config.cool_threshold}%` }} />
          <div className="bg-slate-500/60" style={{ width: `${config.warm_threshold - config.cool_threshold}%` }} />
          <div className="bg-amber-500/60" style={{ width: `${config.hot_threshold - config.warm_threshold}%` }} />
          <div className="bg-green-500/60" style={{ width: `${100 - config.hot_threshold}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-white/30 mt-1">
          <span>0</span>
          <span>{config.cool_threshold}</span>
          <span>{config.warm_threshold}</span>
          <span>{config.hot_threshold}</span>
          <span>100</span>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !weightsValid}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
        {saved && <span className="text-green-400 text-sm">Saved successfully</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
    </main>
  );
}
