"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import ReconciliationResult from "@/components/ReconciliationResult";
import BatchReconciliationResult from "@/components/BatchReconciliationResult";

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const searchParams = useSearchParams();
  const isBatch = searchParams.get("is_batch") === "true";
  const { fetchWithAuth } = useApi();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  
  const [selectedRunIndex, setSelectedRunIndex] = useState<number | null>(null);

  useEffect(() => {
    const endpoint = isBatch ? `/runs/batch/${params.id}` : `/runs/${params.id}`;
    fetchWithAuth(endpoint)
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id, isBatch]);

  const handleExport = async (format: "excel" | "pdf", isBatchExport: boolean, runResult?: any) => {
    const isExcel = format === "excel";
    if (isExcel) setExportingExcel(true); else setExportingPdf(true);
    setExportError(null);

    try {
      const endpoint = isBatchExport
        ? `/export/batch/${isExcel ? "excel" : "pdf"}`
        : `/export/single/${isExcel ? "excel" : "pdf"}`;
      const payload = isBatchExport ? data : (runResult ?? data);

      const blob = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (blob instanceof Blob) {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href    = url;
        const slug = isBatchExport ? "batch" : (runResult?.run_id ?? data?.run_id ?? "report")?.substring(0, 8);
        a.download = `recon_${isBatchExport ? "batch" : "report"}_${slug}.${isExcel ? "xlsx" : "pdf"}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setExportError(err.message || "Failed to generate report. Please try again.");
    } finally {
      if (isExcel) setExportingExcel(false); else setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading history record...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6" />
          <h2 className="text-xl font-bold">Failed to load record</h2>
        </div>
        <p>{error}</p>
        <Link href="/history" className="px-4 py-2 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors">
          Back to History
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/history" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isBatch ? "Batch Details" : "Reconciliation Details"}
        </h1>
      </div>
      
      <div className="rounded-xl border border-border bg-card p-8">
        {!isBatch ? (
          <ReconciliationResult
            runResult={data}
            exportingExcel={exportingExcel}
            exportingPdf={exportingPdf}
            onExport={(format) => handleExport(format, false, data)}
            actions={
              <Link href="/reconcile" className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors">
                Run Another
              </Link>
            }
          />
        ) : (
          <div>
            {selectedRunIndex !== null ? (
              <div>
                <button 
                  onClick={() => setSelectedRunIndex(null)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Batch Overview
                </button>
                {data.runs[selectedRunIndex].status === 'failed' ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-3 text-red-500 mb-2">
                      <AlertCircle className="w-6 h-6" />
                      <h2 className="text-xl font-bold">Reconciliation Failed</h2>
                    </div>
                    <p className="text-foreground font-medium mb-4">
                      {data.runs[selectedRunIndex].source_filename} ↔ {data.runs[selectedRunIndex].target_filename}
                    </p>
                    <div className="bg-background/50 p-4 rounded text-sm font-mono text-red-400">
                      {data.runs[selectedRunIndex].error}
                    </div>
                  </div>
                ) : (
                  <ReconciliationResult
                    runResult={data.runs[selectedRunIndex].result}
                    exportingExcel={exportingExcel}
                    exportingPdf={exportingPdf}
                    onExport={(format) => handleExport(format, false, data.runs[selectedRunIndex].result)}
                  />
                )}
              </div>
            ) : (
              <BatchReconciliationResult
                result={data}
                onRunSelect={setSelectedRunIndex}
                exportingExcel={exportingExcel}
                exportingPdf={exportingPdf}
                onExport={(format) => handleExport(format, true, data)}
                actions={
                  <Link href="/reconcile" className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors">
                    Run Another Batch
                  </Link>
                }
              />
            )}
            
            {exportError && (
              <p className="w-full text-xs text-red-400 mt-4">{exportError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
