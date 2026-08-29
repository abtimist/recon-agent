"use client";

import React, { useState } from "react";
import { Loader2, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/api";

type ExplanationType = "single" | "batch";

interface CFOExplanationProps {
  type: ExplanationType;
  result: any;
}

export default function CFOExplanation({ type, result }: CFOExplanationProps) {
  const { fetchWithAuth } = useApi();
  const [explanation, setExplanation] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/explain/", {
        method: "POST",
        body: JSON.stringify({
          type,
          result,
        }),
      });

      if (response.status === "queued" || response.status === "processing") {
        let isDone = false;
        let currentStatus = response;
        while (!isDone) {
          await new Promise(r => setTimeout(r, 2000));
          currentStatus = await fetchWithAuth(`/explain/${response.job_id}/status`);
          if (currentStatus.status === "completed" || currentStatus.status === "failed") {
            isDone = true;
            if (currentStatus.status === "failed") {
              throw new Error(currentStatus.error_message || "Explanation failed.");
            }
          }
        }
        setExplanation(currentStatus.response_data);
      } else {
        setExplanation(response);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while generating the explanation.");
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-red-500 font-bold">
          <AlertCircle className="w-5 h-5" />
          Explanation Failed
        </div>
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-muted/30 border border-border p-8 rounded-xl flex flex-col items-center justify-center space-y-4 animate-in fade-in">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <div className="text-sm font-medium text-muted-foreground animate-pulse">
          Generating CFO Explanation...
        </div>
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="bg-muted/20 border border-border p-6 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">AI CFO Explanation</h3>
          <p className="text-sm text-muted-foreground">Generate a high-level executive summary of this reconciliation.</p>
        </div>
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Explain Results
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-muted/50 to-muted/20 border border-accent/30 p-6 rounded-xl space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500 shadow-sm relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Sparkles className="w-32 h-32" />
      </div>

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            AI Executive Summary
          </div>
          <h2 className="text-xl font-extrabold text-foreground">{explanation.headline}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
            explanation.overall_status?.toLowerCase().includes('healthy') 
              ? 'bg-green-500/20 text-green-400' 
              : explanation.overall_status?.toLowerCase().includes('critical')
              ? 'bg-red-500/20 text-red-400'
              : 'bg-orange-500/20 text-orange-400'
          }`}>
            Status: {explanation.overall_status}
          </div>
          <button 
            onClick={handleGenerate}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Regenerate Explanation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="text-sm text-foreground leading-relaxed relative z-10 font-medium">
        {explanation.summary}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {explanation.key_findings && explanation.key_findings.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Key Findings</h3>
            <ul className="space-y-2">
              {explanation.key_findings.map((item: string, i: number) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-accent font-bold mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {explanation.attention_items && explanation.attention_items.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">Needs Attention</h3>
            <ul className="space-y-2">
              {explanation.attention_items.map((item: string, i: number) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50 relative z-10">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Financial Impact</h3>
          <div className="text-sm text-foreground font-medium bg-muted/40 p-3 rounded-lg border border-border/50">
            {explanation.financial_impact}
          </div>
        </div>

        {explanation.recommended_actions && explanation.recommended_actions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recommended Actions</h3>
            <div className="text-sm text-foreground bg-muted/40 p-3 rounded-lg border border-border/50">
              <ol className="list-decimal list-inside space-y-1">
                {explanation.recommended_actions.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
