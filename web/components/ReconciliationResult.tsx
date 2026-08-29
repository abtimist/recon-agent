"use client";

import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import CFOExplanation from "./CFOExplanation";

export default function ReconciliationResult({
  runResult,
  exportingExcel = false,
  exportingPdf = false,
  onExport,
  actions,
}: {
  runResult: any;
  exportingExcel?: boolean;
  exportingPdf?: boolean;
  onExport?: (format: "excel" | "pdf") => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-8">
        <CFOExplanation type="single" result={runResult} />
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Reconciliation Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-muted p-5 rounded-xl border border-border">
              <div className="text-muted-foreground text-sm font-medium mb-1">Transactions</div>
              <div className="text-2xl font-bold text-foreground">{runResult.total_source_rows.toLocaleString()}</div>
            </div>
            <div className="bg-muted p-5 rounded-xl border border-border">
              <div className="text-muted-foreground text-sm font-medium mb-1">Match Rate</div>
              <div className="text-2xl font-bold text-accent">{runResult.match_rate}%</div>
            </div>
            <div className="bg-muted p-5 rounded-xl border border-border">
              <div className="text-muted-foreground text-sm font-medium mb-1">Matched</div>
              <div className="text-2xl font-bold text-foreground">
                ₹{runResult.summary?.matched_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
              </div>
            </div>
            <div className="bg-muted p-5 rounded-xl border border-border">
              <div className="text-muted-foreground text-sm font-medium mb-1">Total Amount</div>
              <div className="text-2xl font-bold text-foreground">
                ₹{runResult.summary?.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
              </div>
            </div>
            <div className="bg-muted p-5 rounded-xl border border-red-500/30">
              <div className="text-red-400 text-sm font-medium mb-1">Exceptions</div>
              <div className="text-2xl font-bold text-foreground">{runResult.exceptions_count}</div>
            </div>
            <div className="bg-muted p-5 rounded-xl border border-red-500/30">
              <div className="text-red-400 text-sm font-medium mb-1">Unmatched Amount</div>
              <div className="text-2xl font-bold text-foreground">
                ₹{runResult.summary?.unmatched_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Match Outcome</h3>
          <div className="h-4 w-full flex rounded-full overflow-hidden">
            {runResult.total_source_rows > 0 ? (
              <>
                {runResult.exact_matches > 0 && (
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${(runResult.exact_matches / runResult.total_source_rows) * 100}%` }}
                    title={`Exact: ${runResult.exact_matches}`}
                  />
                )}
                {(runResult.fuzzy_matches + runResult.ai_matches) > 0 && (
                  <div
                    className="bg-[#b3ff00] h-full"
                    style={{ width: `${((runResult.fuzzy_matches + runResult.ai_matches) / runResult.total_source_rows) * 100}%` }}
                    title={`Fuzzy/AI: ${runResult.fuzzy_matches + runResult.ai_matches}`}
                  />
                )}
                {(runResult.total_source_rows - runResult.exact_matches - runResult.fuzzy_matches - runResult.ai_matches) > 0 && (
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${((runResult.total_source_rows - runResult.exact_matches - runResult.fuzzy_matches - runResult.ai_matches) / runResult.total_source_rows) * 100}%` }}
                    title={`Exceptions: ${runResult.total_source_rows - runResult.exact_matches - runResult.fuzzy_matches - runResult.ai_matches}`}
                  />
                )}
              </>
            ) : (
              <div className="bg-muted h-full w-full" />
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>Exact</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#b3ff00]"></div>Fuzzy/AI</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>Exceptions</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Top Merchants by Exceptions</h3>
            {runResult.summary?.top_exception_merchants && runResult.summary.top_exception_merchants.length > 0 ? (
              <div className="space-y-2">
                {runResult.summary.top_exception_merchants.map((m: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-muted/50 p-3 rounded-lg border border-border">
                    <span className="font-medium text-sm truncate max-w-[200px]">{m.party}</span>
                    <span className="text-red-400 font-bold">{m.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic bg-muted/30 p-4 rounded-lg">No merchants have reconciliation exceptions.</div>
            )}
          </div>

          {runResult.summary?.exceptions_by_date && runResult.summary.exceptions_by_date.length > 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Exceptions by Date</h3>
              <div>
                <div className="flex items-end h-32 gap-1 border-b border-border pb-2">
                  {runResult.summary.exceptions_by_date.map((d: any, i: number) => {
                    const maxCount = Math.max(...runResult.summary.exceptions_by_date.map((x: any) => x.count));
                    const heightPct = (d.count / maxCount) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end group h-full">
                        <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                          {d.count}
                        </div>
                        <div
                          className="w-full bg-red-500/80 hover:bg-red-400 rounded-t-sm transition-colors"
                          style={{ height: `${heightPct}%`, minHeight: '4px' }}
                          title={`${d.date.split(' ')[0]}: ${d.count}`}
                        ></div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1 pt-2">
                  {runResult.summary.exceptions_by_date.map((d: any, i: number) => {
                    const dateStr = d.date.split(' ')[0];
                    const shortDate = dateStr.split('-').slice(1).join('/');
                    return (
                      <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground truncate" title={dateStr}>
                        {shortDate}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exceptions Table */}
      {runResult.exception_report && runResult.exception_report.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border mt-8">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Exception Detail</h3>
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Transaction ID</th>
                    <th className="p-3 font-semibold">Party / Merchant</th>
                    <th className="p-3 font-semibold text-right">Amount</th>
                    <th className="p-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {runResult.exception_report.map((exc: any, i: number) => (
                    <tr
                      key={i}
                      className={`hover:bg-muted/30 transition-colors ${
                        exc.type === 'missing_target_record' ? 'bg-red-500/5' :
                        exc.type === 'stray_target_record' ? 'bg-blue-500/5' :
                        'bg-orange-500/5'
                      }`}
                      title={exc.reason}
                    >
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          exc.type === 'missing_target_record' ? 'bg-red-500/10 text-red-500' :
                          exc.type === 'stray_target_record' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-orange-500/10 text-orange-500'
                        }`}>
                          {exc.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-foreground truncate max-w-[150px]">{exc.id}</td>
                      <td className="p-3 text-muted-foreground truncate max-w-[200px]">{exc.party}</td>
                      <td className="p-3 font-mono text-right text-foreground">₹{exc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-muted-foreground">{exc.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Matching Rules Info */}
      <div className="p-4 rounded-xl border border-border bg-muted/30 mt-8">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">Matching Rules Used</h3>
        <div className="flex gap-8 text-sm text-muted-foreground">
          <div>Amount tolerance: <span className="font-mono text-foreground">₹{runResult.amount_tolerance}</span></div>
          <div>Date window: <span className="font-mono text-foreground">{runResult.date_window_days}</span> days</div>
        </div>
      </div>

      {/* Duplicate Detection */}
      {runResult.duplicates && (runResult.duplicates.source_count > 0 || runResult.duplicates.target_count > 0) && (
        <div className="space-y-6 pt-4 mt-8 border-t border-border">
          <h2 className="text-xl font-bold text-foreground">Data Quality: Potential Duplicates</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#fff3cd]/10 border border-[#ffeeba]/20 p-4 rounded-xl">
              <h3 className="text-orange-400 font-bold mb-1">Source File</h3>
              <p className="text-muted-foreground text-sm">{runResult.duplicates.source_count} duplicate group(s)</p>
            </div>
            <div className="bg-[#fff3cd]/10 border border-[#ffeeba]/20 p-4 rounded-xl">
              <h3 className="text-orange-400 font-bold mb-1">Target File</h3>
              <p className="text-muted-foreground text-sm">{runResult.duplicates.target_count} duplicate group(s)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Source File Details</h3>
              {runResult.duplicates.source.map((dup: any, i: number) => (
                <div key={i} className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
                  <div className="font-bold text-orange-400 text-sm">Potential Duplicate</div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-foreground">
                    <div>Merchant: {dup.party}</div>
                    <div>Amount: ₹{dup.amount}</div>
                    <div>Date: {dup.date}</div>
                    <div>Occurrences: {dup.occurrences}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                    Rows: {dup.row_ids.join(', ')}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Target File Details</h3>
              {runResult.duplicates.target.map((dup: any, i: number) => (
                <div key={i} className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
                  <div className="font-bold text-orange-400 text-sm">Potential Duplicate</div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-foreground">
                    <div>Merchant: {dup.party}</div>
                    <div>Amount: ₹{dup.amount}</div>
                    <div>Date: {dup.date}</div>
                    <div>Occurrences: {dup.occurrences}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                    Rows: {dup.row_ids.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                Export Excel
              </button>
              <button
                onClick={() => onExport("pdf")}
                disabled={exportingExcel || exportingPdf}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export PDF
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
