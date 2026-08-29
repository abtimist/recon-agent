"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

type AIConfig = {
  provider: string;
  model_override: string | null;
  base_url_override: string | null;
  has_api_key: boolean;
};

export default function SettingsPage() {
  const { fetchWithAuth } = useApi();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form states
  const [provider, setProvider] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [modelOverride, setModelOverride] = useState("");
  const [baseUrlOverride, setBaseUrlOverride] = useState("");

  useEffect(() => {
    fetchWithAuth("/settings/ai")
      .then((data: AIConfig) => {
        setConfig(data);
        setProvider(data.provider);
        setModelOverride(data.model_override || "");
        setBaseUrlOverride(data.base_url_override || "");
      })
      .catch((err) => setMessage({ text: err.message, type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updated = await fetchWithAuth("/settings/ai", {
        method: "PUT",
        body: JSON.stringify({
          provider,
          api_key: apiKey || null, // send null if they didn't type a new one
          model_override: modelOverride || null,
          base_url_override: baseUrlOverride || null,
        }),
      });
      setConfig(updated);
      setApiKey(""); // clear the input field for security
      setMessage({ text: "Settings saved successfully.", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#AAFF00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Settings</h1>
        <p className="text-gray-400">
          Configure the AI provider used for resolving ambiguous reconciliation cases.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0f0f0f] overflow-hidden max-w-2xl">
        <form onSubmit={handleSave} className="p-8 space-y-6">
          
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">AI Provider</label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setApiKey(""); // clear typed key when switching providers
              }}
              className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded-lg p-3 outline-none focus:border-[#AAFF00] transition-colors"
            >
              <option value="groq">Groq (Llama-3 - Recommended)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="none">Disabled (Flag all ambiguous as exceptions)</option>
            </select>
          </div>

          {/* Helper Text for No-Key Providers */}
          {provider === "ollama" && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="text-sm font-bold text-blue-400 mb-1">How Ollama Works</h4>
              <p className="text-xs text-gray-300">
                Ollama runs AI completely locally on your machine. <strong className="text-white">No API key is required.</strong> Ensure the Ollama app is running in the background and the <code className="bg-black/30 px-1 py-0.5 rounded text-blue-300">qwen2.5:3b</code> model is pulled. The system will automatically connect to it via <code className="bg-black/30 px-1 py-0.5 rounded text-blue-300">http://localhost:11434</code>.
              </p>
            </div>
          )}

          {provider === "none" && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <h4 className="text-sm font-bold text-orange-400 mb-1">AI Disabled</h4>
              <p className="text-xs text-gray-300">
                <strong className="text-white">No API key is required.</strong> AI Reconciliation and CFO Explanation features will be skipped. Any transactions that cannot be matched by deterministic exact or fuzzy logic will simply be flagged as Exceptions for manual review.
              </p>
            </div>
          )}

          {/* API Key */}
          {provider !== "none" && provider !== "ollama" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex justify-between">
                <span>API Key</span>
                {config?.has_api_key && config?.provider === provider && (
                  <span className="text-xs text-[#AAFF00] bg-[#AAFF00]/10 px-2 py-0.5 rounded-full">
                    Key is securely stored
                  </span>
                )}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.has_api_key && config?.provider === provider ? "•••••••••••••••• (Leave blank to keep existing)" : "Paste your API key here"}
                className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded-lg p-3 outline-none focus:border-[#AAFF00] transition-colors"
              />
              <p className="text-xs text-gray-500">
                Your key is AES-256 encrypted before being stored in the database.
              </p>
            </div>
          )}

          {/* Advanced / Overrides */}
          <div className="pt-4 mt-6 border-t border-white/10 space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Advanced Settings (Optional)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Model Override</label>
                <input
                  type="text"
                  value={modelOverride}
                  onChange={(e) => setModelOverride(e.target.value)}
                  placeholder="e.g. gpt-4-turbo"
                  className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded-lg p-2.5 text-sm outline-none focus:border-[#AAFF00]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Base URL Override</label>
                <input
                  type="text"
                  value={baseUrlOverride}
                  onChange={(e) => setBaseUrlOverride(e.target.value)}
                  placeholder="e.g. http://localhost:11434/v1"
                  className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded-lg p-2.5 text-sm outline-none focus:border-[#AAFF00]"
                />
              </div>
            </div>
          </div>

          {/* Alerts & Submission */}
          {message && (
            <div className={`p-3 rounded-lg text-sm border ${
              message.type === "success" 
                ? "bg-[#AAFF00]/10 border-[#AAFF00]/20 text-[#AAFF00]" 
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              {message.text}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#AAFF00] hover:bg-[#ccff33] text-black font-semibold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Settings
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
