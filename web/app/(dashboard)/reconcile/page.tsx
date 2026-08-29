"use client";

import { useState } from "react";
import Papa from "papaparse";
import { FileUploader } from "@/components/FileUploader";
import { MultiFileUploader } from "@/components/MultiFileUploader";
import { ColumnMapper } from "@/components/ColumnMapper";
import { useApi } from "@/lib/api";
import { Loader2, CheckCircle2, AlertCircle, ChevronLeft, Download } from "lucide-react";
import ReconciliationResult from "@/components/ReconciliationResult";
import BatchReconciliationResult from "@/components/BatchReconciliationResult";
import Link from "next/link";

export default function ReconcilePage() {
  const { fetchWithAuth } = useApi();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [targetFiles, setTargetFiles] = useState<File[]>([]);
  
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [targetHeaders, setTargetHeaders] = useState<string[]>([]);
  
  const [amountTolerance, setAmountTolerance] = useState<number>(20);
  const [dateWindow, setDateWindow] = useState<number>(5);
  
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Map, 3: Processing/Result
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [selectedRunIndex, setSelectedRunIndex] = useState<number | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const extractHeaders = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        preview: 1,
        complete: (results) => {
          if (results.meta && results.meta.fields) {
            resolve(results.meta.fields);
          } else {
            reject(new Error("No headers found in file."));
          }
        },
        error: (err) => reject(err),
      });
    });
  };

  const handleProceedToMap = async () => {
    if (sourceFiles.length === 0 || targetFiles.length === 0) return;
    if (mode === "batch" && sourceFiles.length !== targetFiles.length) {
      setError(`Mismatched files: ${sourceFiles.length} source files and ${targetFiles.length} target files. Every source file needs a corresponding target file.`);
      return;
    }
    if (mode === "batch" && sourceFiles.length > 20) {
      setError("Maximum 20 pairs allowed per batch.");
      return;
    }
    if (amountTolerance < 0 || dateWindow < 0 || dateWindow > 60) {
      setError("Please enter valid matching rules. Amount must be >= 0, Date window must be 0-60 days.");
      return;
    }
    setError(null);
    setLoading(true);
    
    try {
      const [sHeaders, tHeaders] = await Promise.all([
        extractHeaders(sourceFiles[0]),
        extractHeaders(targetFiles[0])
      ]);
      setSourceHeaders(sHeaders);
      setTargetHeaders(tHeaders);
      setStep(2);
    } catch (err: any) {
      setError("Failed to read headers from files. Ensure they are valid CSVs.");
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (mappings: any, sourceMode: string, targetMode: string) => {
    setStep(3);
    setLoading(true);
    setError(null);
    setSelectedRunIndex(null);

    try {
      const formData = new FormData();
      if (mode === "single") {
        formData.append("source_file", sourceFiles[0]);
        formData.append("target_file", targetFiles[0]);
      } else {
        sourceFiles.forEach(f => formData.append("source_files", f));
        targetFiles.forEach(f => formData.append("target_files", f));
      }
      
      const source_mappings: Record<string, string> = {};
      const target_mappings: Record<string, string> = {};
      
      for (const [standardKey, mapObj] of Object.entries(mappings)) {
        const m = mapObj as {source: string, target: string};
        if (m.source) source_mappings[standardKey] = m.source;
        if (m.target) target_mappings[standardKey] = m.target;
      }

      formData.append("source_mapping_json", JSON.stringify(source_mappings));
      formData.append("target_mapping_json", JSON.stringify(target_mappings));
      formData.append("source_amount_mode", sourceMode);
      formData.append("target_amount_mode", targetMode);
      formData.append("amount_tolerance", amountTolerance.toString());
      formData.append("date_window_days", dateWindow.toString());

      const endpoint = mode === "single" ? "/reconcile" : "/reconcile/batch";
      const data = await fetchWithAuth(endpoint, {
        method: "POST",
        body: formData,
      });

      if (data.status === "queued" || data.status === "processing") {
        let isDone = false;
        const currentId = mode === "single" ? data.run_id : data.batch_id;
        
        while (!isDone) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const statusEndpoint = mode === "single" ? `/runs/${currentId}/status` : `/runs/batch/${currentId}/status`;
          const statusCheck = await fetchWithAuth(statusEndpoint);
          
          if (statusCheck.status === "completed" || statusCheck.status === "failed") {
            isDone = true;
            if (statusCheck.status === "failed" && mode === "single") {
              throw new Error(statusCheck.error_message || "Reconciliation failed.");
            }
          }
        }
        
        // Fetch full result once completed
        const finalEndpoint = mode === "single" ? `/runs/${currentId}` : `/runs/batch/${currentId}`;
        const finalResult = await fetchWithAuth(finalEndpoint);
        setResult(finalResult);
      } else {
        setResult(data);
      }

    } catch (err: any) {
      let msg = err.message;
      if (typeof msg !== 'string') {
        try { msg = JSON.stringify(msg); } catch { msg = "Unknown error occurred"; }
      }
      setError(msg || "An error occurred during reconciliation.");
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSourceFiles([]);
    setTargetFiles([]);
    setSourceHeaders([]);
    setTargetHeaders([]);
    setResult(null);
    setError(null);
    setStep(1);
    setSelectedRunIndex(null);
  };

  const handleResetSettings = () => {
    setAmountTolerance(20);
    setDateWindow(5);
  };

  // Export handler — posts the result payload to the appropriate /export endpoint
  const handleExport = async (format: "excel" | "pdf", isBatch: boolean, runResult?: any) => {
    const isExcel = format === "excel";
    if (isExcel) setExportingExcel(true); else setExportingPdf(true);
    setExportError(null);

    try {
      const endpoint = isBatch
        ? `/export/batch/${isExcel ? "excel" : "pdf"}`
        : `/export/single/${isExcel ? "excel" : "pdf"}`;
      const payload = isBatch ? result : (runResult ?? result);

      const blob = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (blob instanceof Blob) {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href    = url;
        const slug = isBatch ? "batch" : (runResult?.run_id ?? result?.run_id ?? "report")?.substring(0, 8);
        a.download = `recon_${isBatch ? "batch" : "report"}_${slug}.${isExcel ? "xlsx" : "pdf"}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setExportError(err.message || "Failed to generate report. Please try again.");
    } finally {
      if (isExcel) setExportingExcel(false); else setExportingPdf(false);
    }
  };

  // Replaced renderDetailedResult with components/ReconciliationResult

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reconcile</h1>
        <p className="text-muted-foreground">
          Upload your source and target files to run the reconciliation pipeline.
        </p>
      </div>
      
      <div className="rounded-xl border border-border bg-card p-8 mt-8">
        
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex gap-6 mb-2 border-b border-border">
              <button 
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${mode === 'single' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setMode('single'); setSourceFiles([]); setTargetFiles([]); }}
              >
                Single Reconciliation
              </button>
              <button 
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${mode === 'batch' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => { setMode('batch'); setSourceFiles([]); setTargetFiles([]); }}
              >
                Batch Reconciliation
              </button>
            </div>

            {mode === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FileUploader 
                  label="1. Upload Source System Data (e.g., Stripe, Shopify)" 
                  onFileSelect={(f) => setSourceFiles(f ? [f] : [])} 
                  selectedFile={sourceFiles[0] || null} 
                />
                <FileUploader 
                  label="2. Upload Target System Data (e.g., Bank Statement)" 
                  onFileSelect={(f) => setTargetFiles(f ? [f] : [])} 
                  selectedFile={targetFiles[0] || null} 
                />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <MultiFileUploader
                    label="1. Upload Source Files"
                    onFilesSelect={setSourceFiles}
                    selectedFiles={sourceFiles}
                  />
                  <MultiFileUploader
                    label="2. Upload Target Files"
                    onFilesSelect={setTargetFiles}
                    selectedFiles={targetFiles}
                  />
                </div>
                
                {sourceFiles.length > 0 && targetFiles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">File Pairs</h3>
                      <span className={`text-sm font-medium ${sourceFiles.length === targetFiles.length ? 'text-green-500' : 'text-orange-400'}`}>
                        {Math.min(sourceFiles.length, targetFiles.length)} valid pairs
                      </span>
                    </div>
                    <div className="border border-border rounded-xl overflow-hidden bg-muted/20">
                      <div className="grid grid-cols-[3rem_1fr_2rem_1fr] p-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                        <div>#</div>
                        <div>Source</div>
                        <div className="text-center">↔</div>
                        <div>Target</div>
                      </div>
                      <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                        {Array.from({ length: Math.max(sourceFiles.length, targetFiles.length) }).map((_, i) => (
                          <div key={i} className={`grid grid-cols-[3rem_1fr_2rem_1fr] p-3 items-center text-sm ${!sourceFiles[i] || !targetFiles[i] ? 'bg-red-500/10' : ''}`}>
                            <div className="text-muted-foreground font-mono">{String(i + 1).padStart(2, '0')}</div>
                            <div className={`truncate pr-2 ${!sourceFiles[i] ? 'text-red-400 italic' : 'text-foreground'}`}>
                              {sourceFiles[i]?.name || "Missing Source"}
                            </div>
                            <div className="text-center text-muted-foreground">↔</div>
                            <div className={`truncate pl-2 ${!targetFiles[i] ? 'text-red-400 italic' : 'text-foreground'}`}>
                              {targetFiles[i]?.name || "Missing Target"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {sourceFiles.length !== targetFiles.length && (
                      <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-400/10 p-3 rounded-lg border border-orange-400/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Mismatched file counts! Every source file must have a corresponding target file to proceed.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-4 pt-6 border-t border-border">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Matching Rules</h3>
              <p className="text-sm text-muted-foreground max-w-2xl mb-4">
                These settings configure the boundaries for fuzzy logic and AI matching.
                {mode === 'batch' && <span className="block mt-1 text-accent font-medium">These rules will be applied to all files in this batch.</span>}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium">Amount Tolerance</label>
                    <span className="text-sm font-mono text-muted-foreground">₹{amountTolerance}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="200" step="1" 
                    value={amountTolerance} 
                    onChange={(e) => setAmountTolerance(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <p className="text-xs text-muted-foreground">Maximum absolute difference to consider a match (₹0 = exact only)</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium">Date Window</label>
                    <span className="text-sm font-mono text-muted-foreground">{dateWindow} days</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="60" step="1" 
                    value={dateWindow} 
                    onChange={(e) => setDateWindow(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <p className="text-xs text-muted-foreground">Maximum days apart to consider a match (0 = exact only)</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleResetSettings} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Reset to Defaults
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-border">
              <button
                className="px-6 py-3 bg-accent text-accent-foreground font-semibold rounded-xl hover:bg-accent/90 transition-all shadow-lg hover:shadow-accent/25 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={sourceFiles.length === 0 || targetFiles.length === 0 || (mode === 'batch' && sourceFiles.length !== targetFiles.length)}
                onClick={handleProceedToMap}
              >
                Proceed to Mapping
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-3 text-muted-foreground mb-4">
              <button onClick={() => setStep(1)} className="hover:text-foreground flex items-center gap-1 text-sm font-medium">
                <ChevronLeft className="w-4 h-4" /> Back to Upload
              </button>
            </div>
            
            {mode === 'batch' && (
              <div className="bg-accent/10 border border-accent/20 p-4 rounded-lg mb-4 text-sm text-accent">
                <strong>Batch Mode:</strong> You are mapping columns for the first pair of files ({sourceFiles[0].name} ↔ {targetFiles[0].name}). 
                This mapping schema will be applied to all {sourceFiles.length} pairs in the batch.
              </div>
            )}

            <ColumnMapper
              sourceHeaders={sourceHeaders}
              targetHeaders={targetHeaders}
              onComplete={handleReconcile}
              onCancel={() => setStep(1)}
            />

            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3 mt-4">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Loading / Result */}
        {step === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
                <p className="text-muted-foreground font-medium animate-pulse">Running reconciliation pipeline...</p>
                {mode === 'batch' && <p className="text-xs text-muted-foreground">Processing {sourceFiles.length} file pairs</p>}
              </div>
            ) : result ? (
              <div>
                {/* Single Mode Result or Specific Batch Run Result */}
                {(mode === 'single' || selectedRunIndex !== null) ? (
                  <div>
                    {mode === 'batch' && (
                      <button 
                        onClick={() => setSelectedRunIndex(null)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back to Batch Overview
                      </button>
                    )}
                    {mode === 'batch' && result.runs[selectedRunIndex!].status === 'failed' ? (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-3 text-red-500 mb-2">
                          <AlertCircle className="w-6 h-6" />
                          <h2 className="text-xl font-bold">Reconciliation Failed</h2>
                        </div>
                        <p className="text-foreground font-medium mb-4">
                          {result.runs[selectedRunIndex!].source_filename} ↔ {result.runs[selectedRunIndex!].target_filename}
                        </p>
                        <div className="bg-background/50 p-4 rounded text-sm font-mono text-red-400">
                          {result.runs[selectedRunIndex!].error}
                        </div>
                      </div>
                    ) : (
                      <ReconciliationResult
                        runResult={mode === 'batch' ? result.runs[selectedRunIndex!].result : result}
                        exportingExcel={exportingExcel}
                        exportingPdf={exportingPdf}
                        onExport={(format) => handleExport(format, false, mode === 'batch' ? result.runs[selectedRunIndex!].result : result)}
                        actions={
                          <>
                            <button
                              onClick={handleReset}
                              className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors"
                            >
                              Run Another
                            </button>
                            <Link href={`/history/${mode === 'batch' ? result.runs[selectedRunIndex!].result.run_id : result.run_id}`} className="px-5 py-2 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors">
                              View History
                            </Link>
                          </>
                        }
                      />
                    )}
                  </div>
                ) : (
                  /* Batch Overview */
                  <BatchReconciliationResult
                    result={result}
                    onRunSelect={setSelectedRunIndex}
                    exportingExcel={exportingExcel}
                    exportingPdf={exportingPdf}
                    onExport={(format) => handleExport(format, true)}
                    actions={
                      <button
                        onClick={handleReset}
                        className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors"
                      >
                        Run Another Batch
                      </button>
                    }
                  />
                )}
                {exportError && (
                  <p className="w-full text-xs text-red-400 mt-4">{exportError}</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
