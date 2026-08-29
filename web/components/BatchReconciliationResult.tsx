"use client";

import { CheckCircle2, ChevronLeft, Download, Loader2 } from "lucide-react";
import React from "react";
import CFOExplanation from "./CFOExplanation";

export default function BatchReconciliationResult({
  result,
  onRunSelect,
  exportingExcel = false,
  exportingPdf = false,
  onExport,
  actions,
}: {
  result: any;
  onRunSelect?: (index: number) => void;
  exportingExcel?: boolean;
  exportingPdf?: boolean;
  onExport?: (format: "excel" | "pdf") => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Batch Complete</h2>
        </div>
        <p className="text-muted-foreground">
          Processed {result.runs.length} file pairs. {result.summary.completed_runs} completed, {result.summary.failed_runs} failed.
        </p>

        <div className="mt-6 mb-6">
          <CFOExplanation type="batch" result={result} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-muted p-5 rounded-xl border border-border">
            <div className="text-muted-foreground text-sm font-medium mb-1">Transactions</div>
            <div className="text-2xl font-bold text-foreground">{result.summary.total_transactions?.toLocaleString() || 0}</div>
          </div>
          <div className="bg-muted p-5 rounded-xl border border-border">
            <div className="text-muted-foreground text-sm font-medium mb-1">Match Rate</div>
            <div className="text-2xl font-bold text-accent">{result.summary.overall_match_rate || 0}%</div>
          </div>
          <div className="bg-muted p-5 rounded-xl border border-border">
            <div className="text-muted-foreground text-sm font-medium mb-1">Matched Amount</div>
            <div className="text-2xl font-bold text-foreground">
              ₹{result.summary.total_matched_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
            </div>
          </div>
          <div className="bg-muted p-5 rounded-xl border border-border">
            <div className="text-muted-foreground text-sm font-medium mb-1">Total Amount</div>
            <div className="text-2xl font-bold text-foreground">
              ₹{result.summary.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
            </div>
          </div>
          <div className="bg-muted p-5 rounded-xl border border-red-500/30">
            <div className="text-red-400 text-sm font-medium mb-1">Exceptions</div>
            <div className="text-2xl font-bold text-foreground">{result.summary.total_exceptions?.toLocaleString() || 0}</div>
          </div>
          <div className="bg-muted p-5 rounded-xl border border-red-500/30">
            <div className="text-red-400 text-sm font-medium mb-1">Unmatched Amount</div>
            <div className="text-2xl font-bold text-foreground">
              ₹{result.summary.total_unmatched_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
            </div>
          </div>
        </div>

        {/* Batch Duplicates Summary */}
        {(result.summary.duplicate_source_groups > 0 || result.summary.duplicate_target_groups > 0) && (
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Data Quality: Potential Duplicates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#fff3cd]/10 border border-[#ffeeba]/20 p-4 rounded-xl">
                <h3 className="text-orange-400 font-bold mb-1">Source Files (Aggregated)</h3>
                <p className="text-muted-foreground text-sm">{result.summary.duplicate_source_groups} duplicate group(s) across batch</p>
              </div>
              <div className="bg-[#fff3cd]/10 border border-[#ffeeba]/20 p-4 rounded-xl">
                <h3 className="text-orange-400 font-bold mb-1">Target Files (Aggregated)</h3>
                <p className="text-muted-foreground text-sm">{result.summary.duplicate_target_groups} duplicate group(s) across batch</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Click into individual reconciliation runs below to view exact duplicate rows and details.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Reconciliation Runs</h3>
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-[1fr_1fr_6rem_8rem] p-4 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
            <div>Source File</div>
            <div>Target File</div>
            <div>Status</div>
            <div className="text-right">Match Rate</div>
          </div>
          <div className="divide-y divide-border/50">
            {result.runs.map((run: any, idx: number) => (
              <div
                key={idx}
                className={`grid grid-cols-[1fr_1fr_6rem_8rem] p-4 items-center text-sm transition-colors ${onRunSelect ? 'cursor-pointer hover:bg-muted/50' : ''} ${run.status === 'failed' ? 'bg-red-500/5 hover:bg-red-500/10' : ''}`}
                onClick={() => onRunSelect && onRunSelect(idx)}
              >
                <div className="truncate pr-4 font-medium">{run.source_filename || 'Unknown'}</div>
                <div className="truncate pr-4 font-medium text-muted-foreground">{run.target_filename || 'Unknown'}</div>
                <div>
                  {run.status === 'completed' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">
                      Complete
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">
                      Failed
                    </span>
                  )}
                </div>
                <div className="text-right font-bold">
                  {run.status === 'completed' && run.result ? `${run.result.match_rate}%` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap gap-3 pt-4 border-t border-border mt-8">
          {actions}
          {onExport && (
            <>
              <button
                onClick={() => onExport("excel")}
                disabled={exportingExcel || exportingPdf}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export Batch Excel
              </button>
              <button
                onClick={() => onExport("pdf")}
                disabled={exportingExcel || exportingPdf}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export Batch PDF
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
