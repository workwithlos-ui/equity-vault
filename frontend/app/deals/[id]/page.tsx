"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  getDeal,
  decideDeal,
  getNotes,
  addNote,
  getDealTimeline,
  generateOutreach,
  exportDealJSON,
  addToWatch,
  type Deal,
  type DealNote,
  type ActivityItem,
  type OutreachResult,
} from "@/lib/api";

const tierColors: Record<string, string> = {
  hot: "text-green-400",
  warm: "text-amber-400",
  cool: "text-slate-400",
  pass: "text-red-400",
};

const tierBg: Record<string, string> = {
  hot: "bg-green-500/10 border-green-500/20",
  warm: "bg-amber-500/10 border-amber-500/20",
  cool: "bg-slate-500/10 border-slate-500/20",
  pass: "bg-red-500/10 border-red-500/20",
};

type Tab = "brief" | "notes" | "timeline" | "outreach";

export default function DealDetail() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>("brief");

  // Notes
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [addingNote, setAddingNote] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<ActivityItem[]>([]);

  // Outreach
  const [outreach, setOutreach] = useState<OutreachResult | null>(null);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);

  // Watch
  const [watchReason, setWatchReason] = useState("");
  const [watchDays, setWatchDays] = useState(30);
  const [showWatchModal, setShowWatchModal] = useState(false);

  useEffect(() => {
    if (dealId) {
      getDeal(dealId)
        .then(setDeal)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [dealId]);

  // Load tab data on switch
  useEffect(() => {
    if (!dealId) return;
    if (activeTab === "notes") {
      getNotes(dealId).then(setNotes).catch(console.error);
    } else if (activeTab === "timeline") {
      getDealTimeline(dealId).then(setTimeline).catch(console.error);
    }
  }, [activeTab, dealId]);

  const handleDecision = async (decision: "advance" | "pass") => {
    if (!deal) return;
    setDeciding(true);
    try {
      await decideDeal(deal.id, decision, decisionNotes || undefined);
      const updated = await getDeal(deal.id);
      setDeal(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setDeciding(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await addNote(dealId, newNote, noteType);
      setNewNote("");
      const updated = await getNotes(dealId);
      setNotes(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingNote(false);
    }
  };

  const handleOutreach = async () => {
    setGeneratingOutreach(true);
    try {
      const res = await generateOutreach(dealId);
      setOutreach(res);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportDealJSON(dealId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deal?.company_name || "deal"}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleWatch = async () => {
    if (!watchReason.trim()) return;
    try {
      await addToWatch(dealId, watchReason, watchDays);
      const updated = await getDeal(dealId);
      setDeal(updated);
      setShowWatchModal(false);
      setWatchReason("");
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="text-center text-white/30 py-20">Loading deal...</div>;
  if (!deal) return <div className="text-center text-white/30 py-20">Deal not found.</div>;

  const score = deal.score;
  const tier = score?.tier || "cool";
  const decided = score?.operator_decision != null;

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard")}
        className="text-xs text-white/30 hover:text-white/60 mb-6 transition-colors"
      >
        ← Back to pipeline
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{deal.company_name}</h1>
          <div className="flex items-center gap-3 mt-2">
            {deal.industry && (
              <span className="text-xs text-white/40 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {deal.industry}
              </span>
            )}
            {deal.website_url && (
              <a href={deal.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500/70 hover:text-amber-500">
                {deal.website_url}
              </a>
            )}
            <span className="text-xs text-white/20 font-mono">{deal.stage}</span>
          </div>
          {deal.context && <p className="text-sm text-white/40 mt-2 italic">&ldquo;{deal.context}&rdquo;</p>}
        </div>

        {/* Big score */}
        {score && (
          <div className={`text-center px-6 py-4 rounded-xl border ${tierBg[tier]}`}>
            <div className={`text-5xl font-bold font-mono ${tierColors[tier]}`}>{score.composite_score}</div>
            <div className={`text-sm font-semibold uppercase mt-1 ${tierColors[tier]}`}>{tier}</div>
            <div className={`text-xs mt-1 font-mono ${score.confidence === "high" ? "text-green-400/70" : score.confidence === "medium" ? "text-amber-400/70" : "text-red-400/70"}`}>
              {score.confidence} confidence
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button onClick={handleExport} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white hover:border-white/20 transition-all">
          Export JSON
        </button>
        {score && !decided && (
          <button onClick={() => setShowWatchModal(true)} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white hover:border-white/20 transition-all">
            Add to Watch
          </button>
        )}
      </div>

      {/* Watch Modal */}
      {showWatchModal && (
        <div className="glass rounded-xl p-5 mb-6 border border-amber-500/20">
          <h3 className="text-sm font-semibold text-white mb-3">Add to Watch List</h3>
          <input
            type="text"
            value={watchReason}
            onChange={(e) => setWatchReason(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 mb-3"
            placeholder="Why are you watching this deal?"
          />
          <div className="flex items-center gap-3">
            <label className="text-xs text-white/40">Re-evaluate in</label>
            <input
              type="number"
              value={watchDays}
              onChange={(e) => setWatchDays(parseInt(e.target.value) || 30)}
              className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none"
            />
            <span className="text-xs text-white/40">days</span>
            <div className="flex-1" />
            <button onClick={() => setShowWatchModal(false)} className="text-xs text-white/40 hover:text-white/60">Cancel</button>
            <button onClick={handleWatch} className="px-4 py-1.5 bg-amber-500 text-black text-xs font-semibold rounded-lg">Watch</button>
          </div>
        </div>
      )}

      {/* Scorecard */}
      {score && (
        <div className="glass p-6 mb-6">
          <h2 className="text-sm font-semibold text-white/60 mb-4">Score Breakdown</h2>
          <div className="grid grid-cols-3 gap-6">
            <ScoreDimension label="Financial" score={score.financial_score} evidence={score.financial_evidence} />
            <ScoreDimension label="Market" score={score.market_score} evidence={score.market_evidence} />
            <ScoreDimension label="Risk" score={score.risk_score} evidence={score.risk_evidence} inverted />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/5 pb-px">
        {(["brief", "notes", "timeline", "outreach"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-all ${
              activeTab === tab
                ? "bg-white/5 text-amber-500 border-b-2 border-amber-500"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass p-6 mb-6">
        {/* BRIEF TAB */}
        {activeTab === "brief" && score?.brief_md && (
          <div className="brief-content">
            <ReactMarkdown>{score.brief_md}</ReactMarkdown>
          </div>
        )}
        {activeTab === "brief" && !score?.brief_md && (
          <p className="text-white/30 text-sm">No brief generated yet. Score the deal first.</p>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div>
            {/* Add Note */}
            <div className="mb-5">
              <div className="flex gap-2 mb-2">
                {["general", "risk_flag", "action_item", "insight"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setNoteType(t)}
                    className={`px-2 py-1 text-xs rounded-md transition-all ${
                      noteType === t ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-white/40 bg-white/5"
                    }`}
                  >
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  placeholder="Add a note..."
                />
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-lg disabled:opacity-40"
                >
                  {addingNote ? "..." : "Add"}
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {notes.length === 0 && <p className="text-white/30 text-sm">No notes yet</p>}
              {notes.map((n) => {
                const typeColors: Record<string, string> = {
                  general: "border-white/10",
                  risk_flag: "border-red-500/30 bg-red-500/5",
                  action_item: "border-amber-500/30 bg-amber-500/5",
                  insight: "border-blue-500/30 bg-blue-500/5",
                };
                return (
                  <div key={n.id} className={`rounded-lg border p-3 ${typeColors[n.note_type] || typeColors.general}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/40">
                        {n.author} · {n.note_type.replace("_", " ")}
                      </span>
                      <span className="text-xs text-white/20 font-mono">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-sm text-white/80">{n.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-3">
            {timeline.length === 0 && <p className="text-white/30 text-sm">No activity yet</p>}
            {timeline.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500/60 mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white/80">{a.summary}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/30">{a.action_type}</span>
                    <span className="text-xs text-white/20">·</span>
                    <span className="text-xs text-white/20 font-mono">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OUTREACH TAB */}
        {activeTab === "outreach" && (
          <div>
            {!outreach && !generatingOutreach && (
              <div className="text-center py-8">
                <p className="text-white/40 text-sm mb-4">
                  Generate personalized outreach materials based on the deal profile and scoring.
                </p>
                <button
                  onClick={handleOutreach}
                  disabled={!score}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-all disabled:opacity-40"
                >
                  Generate Outreach Brief
                </button>
              </div>
            )}
            {generatingOutreach && (
              <div className="text-center py-8 animate-pulse">
                <p className="text-amber-500">Generating outreach materials...</p>
                <p className="text-white/30 text-xs mt-2">Analyzing profile, scores, and brief to create targeted outreach</p>
              </div>
            )}
            {outreach && (
              <div>
                <div className="brief-content mb-4">
                  <ReactMarkdown>{outreach.outreach_md}</ReactMarkdown>
                </div>
                {outreach.target_contacts.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/40 mb-2">Target Contacts</p>
                    {outreach.target_contacts.map((c: any, i: number) => (
                      <div key={i} className="text-sm text-white/70 mb-1">
                        {c.name} — {c.title} ({c.email || "no email"})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decision panel */}
      {score && !decided && deal.stage !== "watching" && (
        <div className="glass p-6 sticky bottom-6">
          <h2 className="text-sm font-semibold text-white/60 mb-3">Your Decision</h2>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs text-white/40 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="Why are you advancing or passing?"
              />
            </div>
            <button
              onClick={() => handleDecision("advance")}
              disabled={deciding}
              className="px-6 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 font-semibold text-sm rounded-lg transition-colors disabled:opacity-30"
            >
              {deciding ? "..." : "Advance"}
            </button>
            <button
              onClick={() => handleDecision("pass")}
              disabled={deciding}
              className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold text-sm rounded-lg transition-colors disabled:opacity-30"
            >
              {deciding ? "..." : "Pass"}
            </button>
          </div>
        </div>
      )}

      {/* Decision made */}
      {decided && (
        <div className={`glass p-6 border ${score?.operator_decision === "advance" ? "border-green-500/20" : "border-red-500/20"}`}>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold uppercase ${score?.operator_decision === "advance" ? "text-green-400" : "text-red-400"}`}>
              {score?.operator_decision === "advance" ? "Advanced" : "Passed"}
            </span>
            {score?.decision_at && (
              <span className="text-xs text-white/30 font-mono">{new Date(score.decision_at).toLocaleDateString()}</span>
            )}
          </div>
          {score?.operator_notes && <p className="text-sm text-white/50 mt-2">{score.operator_notes}</p>}
        </div>
      )}

      {/* Watching indicator */}
      {deal.stage === "watching" && (
        <div className="glass p-6 border border-amber-500/20 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm font-semibold">On Watch List</span>
          </div>
          <p className="text-white/40 text-xs mt-1">This deal is being monitored for re-evaluation.</p>
        </div>
      )}

      {/* People from profile */}
      {deal.profile?.people_data && deal.profile.people_data.length > 0 && (
        <div className="glass p-6 mt-6">
          <h2 className="text-sm font-semibold text-white/60 mb-3">Key People</h2>
          <div className="space-y-2">
            {deal.profile.people_data.map((person: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-sm text-white">{person.name || "Unknown"}</span>
                  <span className="text-xs text-white/40 ml-2">{person.title || ""}</span>
                </div>
                {person.linkedin_url && (
                  <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500/60 hover:text-amber-500">
                    LinkedIn →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreDimension({ label, score, evidence, inverted = false }: { label: string; score: number; evidence: any[]; inverted?: boolean }) {
  const color = score >= 70 ? "text-green-400" : score >= 45 ? "text-amber-400" : "text-red-400";
  const barColor = score >= 70 ? "bg-green-500" : score >= 45 ? "bg-amber-500" : "bg-red-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50 font-medium">{label}</span>
        <span className={`text-lg font-bold font-mono ${color}`}>{score}</span>
      </div>
      <div className="score-bar mb-3">
        <div className={`score-bar-fill ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      {inverted && <p className="text-[10px] text-white/30 mb-2">Higher = less risk</p>}
      <div className="space-y-1">
        {(evidence || []).slice(0, 4).map((e: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="text-white/40 truncate max-w-[150px]">{e.signal?.replace(/_/g, " ")}</span>
            <span className={`font-mono ${(e.points || 0) > 0 ? "text-green-400/60" : "text-red-400/60"}`}>
              {(e.points || 0) > 0 ? "+" : ""}{e.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
