"use client";

import Link from "next/link";
import { Terminal, Book, Key, Code, ArrowRight, Package, Shield, LayoutList, History, Cpu, FileOutput } from "lucide-react";

export default function DeveloperHub() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.recon-agent.com";
  
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <Terminal className="w-8 h-8 text-accent" />
          Developer Documentation
        </h1>
        <p className="mt-2 text-muted-foreground text-lg max-w-3xl">
          Integrate the Recon Agent engine directly into your CI/CD pipelines, cron jobs, and custom applications using our official Python CLI or REST API.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API Docs Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col hover:border-accent/50 transition-colors">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
            <Book className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Interactive API Docs</h3>
          <p className="text-muted-foreground flex-1">
            Our backend provides a fully interactive Swagger UI for you to explore all available endpoints, required parameters, and response schemas.
          </p>
          <div className="mt-6">
            <a 
              href={`${apiUrl}/docs`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              Open API Reference
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* API Tokens Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col hover:border-accent/50 transition-colors">
          <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
            <Key className="w-6 h-6 text-accent" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Generate API Tokens</h3>
          <p className="text-muted-foreground flex-1">
            You need a Personal Access Token (PAT) to authenticate API requests or use the CLI. Tokens inherit your tier limits and organizational roles.
          </p>
          <div className="mt-6">
            <Link 
              href="/settings" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              Go to Token Settings
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* CLI Section */}
      <div className="space-y-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Code className="w-5 h-5 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Recon Agent CLI Reference</h2>
        </div>
        
        {/* Step 1: Install */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-muted-foreground" />
            1. Installation
          </h3>
          <p className="text-muted-foreground mb-4">
            The CLI is published on the Python Package Index (PyPI). You can install it globally using standard Python tools. Requirements: Python &ge; 3.10.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Using standard Pip</div>
              <code className="font-mono text-sm text-foreground">pip install recon-agent</code>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Using UV (Recommended)</div>
              <code className="font-mono text-sm text-foreground">uv tool install recon-agent</code>
            </div>
          </div>
        </div>

        {/* Step 2: Authenticate */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-muted-foreground" />
            2. Authentication
          </h3>
          <p className="text-muted-foreground mb-4">
            Before running commands, you must authenticate the CLI with your backend environment using a Personal Access Token. 
          </p>
          <div className="bg-[#1E1E1E] text-green-400 p-4 rounded-lg font-mono text-sm shadow-inner overflow-x-auto">
            <div className="text-gray-400 mb-1"># Interactive Login</div>
            <div>$ recon login</div>
            <div className="text-gray-300 mt-2">API Base URL (https://recon-agent-i8mo.onrender.com): [ENTER]</div>
            <div className="text-gray-300">Personal Access Token (ra_live_...): <span className="text-white">ra_live_xxxxx...</span></div>
            <div className="text-green-500 mt-1">✓ Token saved securely in OS keychain.</div>
          </div>
        </div>

        {/* Step 3: Core Commands */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-foreground">Core Commands</h3>
          
          {/* Reconcile */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h4 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <LayoutList className="w-5 h-5 text-blue-500" />
              recon reconcile
            </h4>
            <p className="text-sm text-muted-foreground mb-4">Executes a reconciliation job between two files and immediately begins processing in the cloud.</p>
            
            <div className="bg-[#1E1E1E] text-gray-300 p-4 rounded-lg font-mono text-sm mb-4 overflow-x-auto">
              $ recon reconcile source.csv target.csv <span className="text-blue-400">--tolerance</span> 0.05 <span className="text-blue-400">--provider</span> openai <span className="text-blue-400">--mapping</span> my_preset
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4 text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="pb-2 font-medium">Flag</th>
                    <th className="pb-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr>
                    <td className="py-2 font-mono text-xs text-foreground">--tolerance, -t</td>
                    <td className="py-2 text-muted-foreground">Allowable float difference in amounts (default: 0.0)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs text-foreground">--date-window, -d</td>
                    <td className="py-2 text-muted-foreground">Allowable integer difference in days (default: 0)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs text-foreground">--provider</td>
                    <td className="py-2 text-muted-foreground">AI provider for fuzzy matching: <code className="bg-muted px-1 rounded text-xs">groq</code>, <code className="bg-muted px-1 rounded text-xs">openai</code>, <code className="bg-muted px-1 rounded text-xs">none</code></td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-xs text-foreground">--mapping, -m</td>
                    <td className="py-2 text-muted-foreground">ID of the Saved Mapping Preset to use for column extraction</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* History */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h4 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <History className="w-5 h-5 text-orange-500" />
              recon history
            </h4>
            <p className="text-sm text-muted-foreground mb-4">List your recent reconciliation runs, or fetch the detailed exceptions of a specific run.</p>
            
            <div className="bg-[#1E1E1E] text-gray-300 p-4 rounded-lg font-mono text-sm space-y-3 overflow-x-auto">
              <div>
                <div className="text-gray-500 text-xs mb-1"># List the 5 most recent runs</div>
                $ recon history <span className="text-blue-400">--limit</span> 5
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1"># Fetch specific run details</div>
                $ recon history RUN_ID_12345
              </div>
            </div>
          </div>

          {/* Explain */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h4 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-500" />
              recon explain
            </h4>
            <p className="text-sm text-muted-foreground mb-4">Triggers the AI CFO engine to analyze the exceptions of a completed run and generate a human-readable executive summary.</p>
            
            <div className="bg-[#1E1E1E] text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              $ recon explain RUN_ID_12345
            </div>
          </div>

          {/* Export */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h4 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <FileOutput className="w-5 h-5 text-green-500" />
              recon export
            </h4>
            <p className="text-sm text-muted-foreground mb-4">Downloads the detailed results of a reconciliation run to your local machine.</p>
            
            <div className="bg-[#1E1E1E] text-gray-300 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              $ recon export RUN_ID_12345 <span className="text-blue-400">--format</span> csv
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
