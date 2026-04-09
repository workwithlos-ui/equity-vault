"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWatchList, type WatchListItem } from "@/lib/api";

export default function WatchListPage() {
  const [items, setItems] = useState<WatchListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWatchList()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => !i.overdue);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-amber-500">Loading watch list...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Watch List</h1>
          <p className="text-white/40 text-sm mt-1">
            Deals on hold with scheduled re-evaluation
          </p>
        </div>
        <Link href="/dashboard" className="text-amber-500 hover:text-amber-400 text-sm">
          ← Back to Pipeline
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{items.length}</p>
          <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Watching</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{overdue.length}</p>
          <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Overdue</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{upcoming.length}</p>
          <p className="text-xs text-white/40 uppercase tracking-wider mt-1">On Schedule</p>
        </div>
      </div>

      {items.length === 0 && (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-white/40 text-lg mb-2">No deals on watch</p>
          <p className="text-white/20 text-sm">
            When you put a deal on watch from its detail page, it will appear here with re-evaluation tracking.
          </p>
        </div>
      )}

      {/* Overdue Section */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Overdue for Re-evaluation
          </p>
          <div className="space-y-2">
            {overdue.map((item) => (
              <WatchCard key={item.deal_id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Section */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Scheduled</p>
          <div className="space-y-2">
            {upcoming.map((item) => (
              <WatchCard key={item.deal_id} item={item} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function WatchCard({ item }: { item: WatchListItem }) {
  const daysUntil = item.next_reeval_at
    ? Math.ceil((new Date(item.next_reeval_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`glass rounded-xl px-5 py-4 flex items-center justify-between ${item.overdue ? "border border-red-500/30" : ""}`}>
      <div className="flex-1">
        <Link
          href={`/deals/${item.deal_id}`}
          className="text-white font-medium hover:text-amber-400 transition-colors"
        >
          {item.company_name}
        </Link>
        <p className="text-white/40 text-sm mt-1">{item.reason}</p>
      </div>
      <div className="text-right ml-4">
        {item.overdue ? (
          <p className="text-red-400 text-sm font-medium">
            Overdue by {daysUntil ? Math.abs(daysUntil) : "?"} days
          </p>
        ) : (
          <p className="text-white/50 text-sm">
            Re-eval in {daysUntil} day{daysUntil !== 1 ? "s" : ""}
          </p>
        )}
        <p className="text-white/20 text-xs mt-0.5">
          Every {item.reeval_interval_days} days
        </p>
      </div>
    </div>
  );
}
