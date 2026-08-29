"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { Loader2, AlertCircle, Database, Trash2, Link as LinkIcon, FileJson } from "lucide-react";
import Link from "next/link";

type MappingTemplate = {
  id: string;
  name: string;
  source_type: string;
  created_at: string;
  mappings: Record<string, string>;
};

export default function MappingsPage() {
  const { fetchWithAuth } = useApi();
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = () => {
    setLoading(true);
    fetchWithAuth("/mappings/")
      .then((data) => setTemplates(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mapping template?")) return;
    
    setDeletingId(id);
    try {
      await fetchWithAuth(`/mappings/${id}`, { method: "DELETE" });
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err: any) {
      alert("Failed to delete template: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }).format(d);
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#b3ff00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Saved Mappings</h1>
        <p className="text-gray-400">
          Manage column mapping templates for your frequently used data sources.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 mt-4">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-8 mt-8 text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4 border border-white/10">
            <Database className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No templates saved</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            You can save mapping templates during the reconciliation flow to reuse them later for Stripe, PayPal, or specific bank formats.
          </p>
          <Link 
            href="/reconcile" 
            className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Go to Reconcile
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {templates.map((template) => (
            <div key={template.id} className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group flex flex-col">
              <div className="p-6 border-b border-white/5 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-white mb-1">{template.name}</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-400 border border-white/10 uppercase tracking-wider">
                      {template.source_type}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(template.id)}
                    disabled={deletingId === template.id}
                    className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Delete template"
                  >
                    {deletingId === template.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    <LinkIcon className="w-3 h-3" /> Configured Columns
                  </div>
                  <div className="bg-[#141414] rounded-lg p-3 border border-white/5 font-mono text-xs text-gray-400 h-32 overflow-y-auto">
                    {Object.entries(template.mappings).map(([standardField, sourceColumn]) => (
                      <div key={standardField} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                        <span className="text-gray-300">{standardField}</span>
                        <span className="text-[#b3ff00]/80 truncate ml-4 text-right">{sourceColumn}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-[#141414] px-6 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-white/5">
                <span className="flex items-center gap-1.5"><FileJson className="w-3.5 h-3.5" /> {Object.keys(template.mappings).length} fields</span>
                <span>Created {formatDate(template.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
