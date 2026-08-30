"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { Loader2, Download, AlertCircle, CheckCircle2, ChevronRight, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

type RunSummary = {
  id: string;
  is_batch: boolean;
  status: string;
  source_filename: string | null;
  target_filename: string | null;
  total_source_rows: number | null;
  total_matched: number | null;
  match_rate: number | null;
  exceptions_count: number | null;
  ai_provider: string | null;
  created_at: string;
  completed_at: string | null;
  completed_runs?: number;
  failed_runs?: number;
  total_transactions?: number;
};

export default function HistoryPage() {
  const { fetchWithAuth } = useApi();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = () => {
    setLoading(true);
    fetchWithAuth("/runs/?limit=100")
      .then((data) => setRuns(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  // Exception download logic moved to detail view for better UX

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
    }).format(d);
  };

  if (loading && runs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#b3ff00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-white">History</h1>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                if (window.confirm("Are you sure you want to delete all history? This cannot be undone.")) {
                  setLoading(true);
                  try {
                    await fetchWithAuth("/runs/", { method: "DELETE" });
                    fetchRuns();
                  } catch (err: any) {
                    setError(err.message);
                    setLoading(false);
                  }
                }
              }} 
              disabled={loading} 
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20 text-sm font-medium disabled:opacity-50"
            >
              Clear History
            </button>
            <button 
              onClick={fetchRuns} 
              disabled={loading} 
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>
        <p className="text-gray-400">
          View past reconciliation runs and download exception reports.
        </p>
      </div>
      
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0f0f0f] overflow-hidden mt-8">
        {runs.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
              <CheckCircle2 className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No runs yet</h3>
            <p className="text-gray-400 mb-6">You haven't run any reconciliations.</p>
            <Link 
              href="/reconcile" 
              className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              Start a Run
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Files</th>
                  <th className="px-6 py-4 font-medium">Match Rate</th>
                  <th className="px-6 py-4 font-medium">Exceptions</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-foreground">{formatDate(run.created_at)}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{run.id.substring(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {run.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                        </span>
                      ) : run.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium border border-blue-500/20">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {run.status}
                        </span>
                      )}
                      {run.is_batch && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                          Batch
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {run.is_batch ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-foreground font-medium">{(run.completed_runs || 0) + (run.failed_runs || 0)} File Pairs</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          <span className="truncate text-foreground" title={run.source_filename || "N/A"}>{run.source_filename || "—"}</span>
                          <span className="truncate text-muted-foreground text-xs" title={run.target_filename || "N/A"}>{run.target_filename || "—"}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(run.is_batch ? run.total_transactions !== undefined : (run.total_source_rows !== null && run.total_matched !== null)) ? (
                        <div className="flex flex-col">
                          <span className={`font-medium ${run.match_rate && run.match_rate >= 99.0 ? 'text-accent' : 'text-foreground'}`}>
                            {run.match_rate ? run.match_rate.toFixed(1) : 0}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {run.is_batch ? `${run.total_matched} / ${run.total_transactions}` : `${run.total_matched} / ${run.total_source_rows}`} matched
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {run.exceptions_count !== null && run.exceptions_count !== undefined ? (
                        <span className={`font-medium ${run.exceptions_count > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {run.exceptions_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/history/${run.id}?is_batch=${run.is_batch}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 text-foreground text-sm font-medium hover:bg-muted transition-colors"
                      >
                        View <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
