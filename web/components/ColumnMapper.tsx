"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Save } from "lucide-react";
import { useApi } from "@/lib/api";
interface ColumnMapperProps {
  sourceHeaders: string[];
  targetHeaders: string[];
  onComplete: (mappings: any, sourceMode: string, targetMode: string) => void;
  onCancel: () => void;
}

export function ColumnMapper({
  sourceHeaders,
  targetHeaders,
  onComplete,
  onCancel,
}: ColumnMapperProps) {
  const { fetchWithAuth } = useApi();

  const [sourceAmountMode, setSourceAmountMode] = useState<"single" | "debit_credit">("single");
  const [targetAmountMode, setTargetAmountMode] = useState<"single" | "debit_credit">("single");

  // Standard fields we need for reconciliation
  const REQUIRED_FIELDS = [
    { key: "id", label: "Transaction ID / Reference", desc: "Unique identifier for exact matching" },
    { key: "amount", label: "Amount", desc: "Numerical value for amount matching" },
    { key: "date", label: "Date", desc: "Transaction date" },
    { key: "party", label: "Counterparty / Name", desc: "Name of the merchant or sender" },
    { key: "description", label: "Description / Narration", desc: "Additional text for fuzzy matching" },
  ];

  // Store selections as: { "id": { source: "col_a", target: "col_x" }, ... }
  const [selections, setSelections] = useState<Record<string, { source: string; target: string }>>({});

  interface MappingTemplate {
    id: string;
    name: string;
    source_type: "source" | "target";
    mappings: Record<string, string>;
    amount_mode: "single" | "debit_credit";
  }
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);

  useEffect(() => {
    fetchWithAuth("/mappings/")
      .then(data => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(err => console.error("Failed to load templates:", err));
  }, []);

  const applyTemplate = (templateId: string, side: "source" | "target") => {
    if (!templateId) return;
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;

    if (side === "source") setSourceAmountMode(tpl.amount_mode);
    else setTargetAmountMode(tpl.amount_mode);

    setSelections(prev => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(tpl.mappings)) {
        if (!next[key]) next[key] = { source: "", target: "" };
        next[key][side] = val;
      }
      return next;
    });
  };

  // Auto-map headers on load
  useEffect(() => {
    const autoSelections: Record<string, { source: string; target: string }> = {};

    const findMatch = (headers: string[], keywords: string[]) => {
      const lowerHeaders = headers.map(h => h.toLowerCase());
      for (const kw of keywords) {
        const idx = lowerHeaders.findIndex(h => h.includes(kw));
        if (idx !== -1) return headers[idx];
      }
      return "";
    };

    REQUIRED_FIELDS.forEach(field => {
      let keywords: string[] = [];
      if (field.key === "id") keywords = ["id", "ref", "txn", "transaction"];
      if (field.key === "amount") keywords = ["amount", "amt", "value", "total"];
      if (field.key === "date") keywords = ["date", "time", "created", "txn_date"];
      if (field.key === "party") keywords = ["party", "name", "merchant", "counterparty", "sender"];
      if (field.key === "description") keywords = ["desc", "note", "narration", "memo", "notes"];

      autoSelections[field.key] = {
        source: findMatch(sourceHeaders, keywords),
        target: findMatch(targetHeaders, keywords),
      };
    });

    setSelections(autoSelections);
  }, [sourceHeaders, targetHeaders]);

  const handleSelect = (fieldKey: string, side: "source" | "target", value: string) => {
    setSelections((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev[fieldKey] || { source: "", target: "" }),
        [side]: value,
      },
    }));
  };

  const isRequired = (key: string) => key === "id" || key === "amount";

  const handleSave = () => {
    // Validate that at least ID and Amount are mapped for both sides
    const idMapped = selections["id"]?.source && selections["id"]?.target;
    
    const sourceAmountMapped = sourceAmountMode === "single"
      ? selections["amount"]?.source
      : (selections["debit_col"]?.source && selections["credit_col"]?.source);
      
    const targetAmountMapped = targetAmountMode === "single"
      ? selections["amount"]?.target
      : (selections["debit_col"]?.target && selections["credit_col"]?.target);
      
    if (!idMapped || !sourceAmountMapped || !targetAmountMapped) {
      alert("Please map at least the Transaction ID and Amount fields for both source and target.");
      return;
    }

    onComplete(selections, sourceAmountMode, targetAmountMode);
  };
  const [saveModal, setSaveModal] = useState<{isOpen: boolean, side: "source" | "target" | null}>({isOpen: false, side: null});
  const [templateName, setTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !saveModal.side) return;
    setIsSaving(true);
    
    const side = saveModal.side;

    // Extract just the mappings for this side
    const sideMappings: Record<string, string> = {};
    for (const [key, mapping] of Object.entries(selections)) {
      const col = mapping[side as keyof typeof mapping];
      if (col) {
        sideMappings[key] = col;
      }
    }

    if (Object.keys(sideMappings).length === 0) {
      alert(`No columns mapped for ${side} yet!`);
      setIsSaving(false);
      return;
    }

    try {
      await fetchWithAuth("/mappings/", {
        method: "POST",
        body: JSON.stringify({
          name: templateName,
          source_type: side,
          mappings: sideMappings,
          amount_mode: side === "source" ? sourceAmountMode : targetAmountMode
        })
      });
      // Close modal on success
      setSaveModal({ isOpen: false, side: null });
      setTemplateName("");
    } catch (err: any) {
      alert(`Failed to save template: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold text-foreground">Map Columns</h2>
          <p className="text-sm text-muted-foreground mt-1">Match your source and target columns to our standard format.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 gap-4 mb-4 text-sm font-semibold text-muted-foreground border-b border-border pb-2 items-end">
            <div className="col-span-3 pb-2">Standard Fields</div>
            <div className="col-span-2">
              <div className="mb-2">Source Columns</div>
              <select
                className="w-full bg-muted border border-border text-foreground rounded-lg p-1.5 text-xs outline-none focus:border-accent transition-colors"
                onChange={(e) => {
                  applyTemplate(e.target.value, "source");
                }}
                defaultValue=""
              >
                <option value="" disabled>Load Template...</option>
                {templates.filter(t => t.source_type === "source").map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1"></div>
            <div className="col-span-2">
              <div className="mb-2">Target Columns</div>
              <select
                className="w-full bg-muted border border-border text-foreground rounded-lg p-1.5 text-xs outline-none focus:border-accent transition-colors"
                onChange={(e) => {
                  applyTemplate(e.target.value, "target");
                }}
                defaultValue=""
              >
                <option value="" disabled>Load Template...</option>
                {templates.filter(t => t.source_type === "target").map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {REQUIRED_FIELDS.map((field) => (
            <div key={field.key} className="grid grid-cols-8 gap-4 items-center mb-4 pb-4 border-b border-border/50 last:border-0 last:mb-0 last:pb-0">
              {/* Standard Field Info */}
              <div className="col-span-3 flex flex-col">
                <span className="font-medium text-sm text-foreground">
                  {field.label}
                  {isRequired(field.key) ? (
                    <span className="text-red-500 ml-1" title="Required">*</span>
                  ) : (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">(Optional)</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">{field.desc}</span>
              </div>
              
              {/* Source Dropdown */}
              <div className="col-span-2">
                {field.key === "amount" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mode</span>
                      <select 
                        value={sourceAmountMode} 
                        onChange={(e) => setSourceAmountMode(e.target.value as "single" | "debit_credit")}
                        className="bg-transparent text-xs text-accent outline-none cursor-pointer"
                      >
                        <option value="single" className="text-background">Single Column</option>
                        <option value="debit_credit" className="text-background">Debit / Credit</option>
                      </select>
                    </div>
                    {sourceAmountMode === "single" ? (
                      <select
                        value={selections[field.key]?.source || ""}
                        onChange={(e) => handleSelect(field.key, "source", e.target.value)}
                        className={`w-full bg-muted border ${selections[field.key]?.source ? 'border-border' : isRequired(field.key) ? 'border-red-500/50' : 'border-border'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                      >
                        <option value="">Select amount column...</option>
                        {sourceHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <select
                          value={selections["debit_col"]?.source || ""}
                          onChange={(e) => handleSelect("debit_col", "source", e.target.value)}
                          className={`w-full bg-muted border ${selections["debit_col"]?.source ? 'border-border' : 'border-red-500/50'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                        >
                          <option value="">Select Debit column...</option>
                          {sourceHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select
                          value={selections["credit_col"]?.source || ""}
                          onChange={(e) => handleSelect("credit_col", "source", e.target.value)}
                          className={`w-full bg-muted border ${selections["credit_col"]?.source ? 'border-border' : 'border-red-500/50'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                        >
                          <option value="">Select Credit column...</option>
                          {sourceHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    value={selections[field.key]?.source || ""}
                    onChange={(e) => handleSelect(field.key, "source", e.target.value)}
                    className={`w-full bg-muted border ${selections[field.key]?.source ? 'border-border' : isRequired(field.key) ? 'border-red-500/50' : 'border-border'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                  >
                    <option value="">Select column...</option>
                    {sourceHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Match Icon */}
              <div className="col-span-1 flex justify-center text-[#b3ff00]/50">
                <ArrowRight size={16} />
              </div>

              {/* Target Dropdown */}
              <div className="col-span-2">
                {field.key === "amount" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mode</span>
                      <select 
                        value={targetAmountMode} 
                        onChange={(e) => setTargetAmountMode(e.target.value as "single" | "debit_credit")}
                        className="bg-transparent text-xs text-accent outline-none cursor-pointer"
                      >
                        <option value="single" className="text-background">Single Column</option>
                        <option value="debit_credit" className="text-background">Debit / Credit</option>
                      </select>
                    </div>
                    {targetAmountMode === "single" ? (
                      <select
                        value={selections[field.key]?.target || ""}
                        onChange={(e) => handleSelect(field.key, "target", e.target.value)}
                        className={`w-full bg-muted border ${selections[field.key]?.target ? 'border-border' : isRequired(field.key) ? 'border-red-500/50' : 'border-border'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                      >
                        <option value="">Select amount column...</option>
                        {targetHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <select
                          value={selections["debit_col"]?.target || ""}
                          onChange={(e) => handleSelect("debit_col", "target", e.target.value)}
                          className={`w-full bg-muted border ${selections["debit_col"]?.target ? 'border-border' : 'border-red-500/50'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                        >
                          <option value="">Select Debit column...</option>
                          {targetHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <select
                          value={selections["credit_col"]?.target || ""}
                          onChange={(e) => handleSelect("credit_col", "target", e.target.value)}
                          className={`w-full bg-muted border ${selections["credit_col"]?.target ? 'border-border' : 'border-red-500/50'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                        >
                          <option value="">Select Credit column...</option>
                          {targetHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    value={selections[field.key]?.target || ""}
                    onChange={(e) => handleSelect(field.key, "target", e.target.value)}
                    className={`w-full bg-muted border ${selections[field.key]?.target ? 'border-border' : isRequired(field.key) ? 'border-red-500/50' : 'border-border'} text-foreground rounded-lg p-2 text-sm outline-none focus:border-accent transition-colors`}
                  >
                    <option value="">Select column...</option>
                    {targetHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
        <div className="flex gap-2">
          <button
            onClick={() => setSaveModal({ isOpen: true, side: "source" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground border border-border transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Source Template
          </button>
          <button
            onClick={() => setSaveModal({ isOpen: true, side: "target" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground border border-border transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Target Template
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-accent hover:bg-accent-hover text-black px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-[0_0_15px_rgba(179,255,0,0.2)] hover:shadow-[0_0_20px_rgba(179,255,0,0.4)]"
          >
            Confirm Mappings
          </button>
        </div>
      </div>

      {saveModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-foreground mb-1">Save {saveModal.side === "source" ? "Source" : "Target"} Template</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Name this mapping template so you can quickly apply it to similar {saveModal.side} files in the future.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Template Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g., Stripe Export, Chase Bank..."
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTemplate();
                    if (e.key === "Escape") {
                      setSaveModal({ isOpen: false, side: null });
                      setTemplateName("");
                    }
                  }}
                  className="w-full bg-muted border border-border text-foreground rounded-lg p-3 text-sm outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setSaveModal({ isOpen: false, side: null });
                    setTemplateName("");
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || isSaving}
                  className="bg-[#b3ff00] hover:bg-[#99cc00] text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
