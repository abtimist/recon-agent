"use client";

import Link from "next/link";
import { Terminal, Book, Key, Code, ArrowRight } from "lucide-react";

export default function DeveloperHub() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.recon-agent.com";
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <Terminal className="w-8 h-8 text-accent" />
          Developer Hub
        </h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Connect your own applications and scripts directly to the Recon Agent backend.
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
            Our backend runs on FastAPI, providing a fully interactive Swagger UI for you to explore all available endpoints, required parameters, and response schemas.
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

      {/* CLI Quickstart */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Code className="w-5 h-5 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Recon CLI Quickstart</h2>
        </div>
        
        <p className="text-muted-foreground mb-6">
          The fastest way to run heavy reconciliation tasks locally or in CI/CD pipelines is using our official Python CLI.
        </p>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs">1</span>
              Install the Package
            </h4>
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm border border-border/50 text-foreground">
              pip install git+https://github.com/abtimist/recon-agent.git
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              * Requires Python 3.10 or higher.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs">2</span>
              Configure Environment & Authenticate
            </h4>
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm border border-border/50 text-foreground space-y-2">
              <div><span className="text-muted-foreground"># Point the CLI to your production backend</span></div>
              <div>export RECON_API_URL="{apiUrl}"</div>
              <div className="pt-2"><span className="text-muted-foreground"># Log in using a Personal Access Token</span></div>
              <div>recon login --token "ra_live_..."</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs">3</span>
              Run Reconciliation
            </h4>
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm border border-border/50 text-foreground space-y-2">
              <div>recon reconcile my_system.csv bank_statement.csv --amount-col "amount" --date-col "date"</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
