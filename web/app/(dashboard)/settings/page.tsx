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

type ApiToken = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  scopes: string[];
};

export default function SettingsPage() {
  const { fetchWithAuth } = useApi();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Form states for AI
  const [provider, setProvider] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [modelOverride, setModelOverride] = useState("");
  const [baseUrlOverride, setBaseUrlOverride] = useState("");

  // States for API Tokens
  const [newTokenName, setNewTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/settings/ai"),
      fetchWithAuth("/api-tokens")
    ])
      .then(([aiData, tokenData]) => {
        setConfig(aiData);
        setProvider(aiData.provider);
        setModelOverride(aiData.model_override || "");
        setBaseUrlOverride(aiData.base_url_override || "");
        setTokens(tokenData || []);
      })
      .catch((err) => {
        if (err.message.includes("403") || err.message.toLowerCase().includes("admin role required")) {
          setPermissionDenied(true);
        } else {
          setMessage({ text: err.message, type: "error" });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    setCreatingToken(true);
    setRawToken(null);
    try {
      const data = await fetchWithAuth("/api-tokens", {
        method: "POST",
        body: JSON.stringify({ name: newTokenName }),
      });
      setRawToken(data.raw_token);
      setNewTokenName("");
      // Refresh token list
      const tokenList = await fetchWithAuth("/api-tokens");
      setTokens(tokenList || []);
    } catch (err: any) {
      alert("Error creating token: " + err.message);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this token? Any script using it will immediately fail.")) return;
    try {
      await fetchWithAuth(`/api-tokens/${id}`, { method: "DELETE" });
      const tokenList = await fetchWithAuth("/api-tokens");
      setTokens(tokenList || []);
    } catch (err: any) {
      alert("Error revoking token: " + err.message);
    }
  };

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

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <span className="text-red-500 text-2xl">🔒</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400 text-center max-w-md">
          You need the <strong className="text-white">Admin</strong> role to manage AI settings and API tokens for this organization.
        </p>
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

      <div className="flex flex-col gap-2 pt-8">
        <h2 className="text-2xl font-bold tracking-tight text-white">Personal Access Tokens</h2>
        <p className="text-gray-400">
          Generate API tokens for the CLI or programmatic access. Tokens act on behalf of your organization.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0f0f0f] overflow-hidden max-w-4xl">
        <div className="p-8 space-y-6">
          <form onSubmit={handleCreateToken} className="flex gap-4 items-end border-b border-white/10 pb-8">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-white">New Token Name</label>
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="e.g. CLI Production"
                className="w-full bg-[#1a1a1a] border border-white/10 text-white rounded-lg p-3 outline-none focus:border-[#AAFF00] transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creatingToken || !newTokenName}
              className="bg-[#1a1a1a] hover:bg-[#333] border border-white/10 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 h-12"
            >
              {creatingToken && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Token
            </button>
          </form>

          {rawToken && (
            <div className="p-6 bg-[#AAFF00]/10 border border-[#AAFF00]/20 rounded-lg space-y-3">
              <h4 className="text-lg font-bold text-[#AAFF00]">Save your new token</h4>
              <p className="text-sm text-gray-300">
                This is the only time the token will be displayed. Please copy it now.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/50 border border-white/10 p-3 rounded text-[#AAFF00] select-all font-mono">
                  {rawToken}
                </code>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Active Tokens</h3>
            {tokens.length === 0 ? (
              <p className="text-sm text-gray-500">No active API tokens found.</p>
            ) : (
              <div className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden">
                {tokens.map((t) => (
                  <div key={t.id} className={`p-4 flex items-center justify-between ${t.revoked_at ? 'opacity-50' : ''}`}>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white">{t.name}</span>
                        {t.revoked_at ? (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Revoked</span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#AAFF00]/20 text-[#AAFF00]">Active</span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-gray-500 mt-1">
                        {t.token_prefix}...
                      </div>
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        <div>Created: {new Date(t.created_at).toLocaleDateString()}</div>
                        {t.last_used_at && <div>Last used: {new Date(t.last_used_at).toLocaleDateString()}</div>}
                      </div>
                    </div>
                    {!t.revoked_at && (
                      <button
                        onClick={() => handleRevokeToken(t.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold px-4 py-2 rounded border border-red-500/20 hover:bg-red-500/10 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
