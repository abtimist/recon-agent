"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-xl">
        <p className="text-gray-400 text-xs mb-2">{data.name}</p>
        <p className="text-white text-sm font-medium">Run ID: {data.runId}</p>
        <p className="text-[#AAFF00] text-sm font-medium mt-1">Match Rate: {data.matchRate}%</p>
        <p className="text-red-400 text-sm font-medium">Exceptions: {data.exceptions}</p>
        <p className="text-gray-300 text-sm font-medium">Volume: {data.volume} rows</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const { fetchWithAuth } = useApi();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRuns: 0,
    avgMatchRate: 0,
    totalExceptions: 0,
    aiResolutions: 0
  });

  useEffect(() => {
    fetchWithAuth("/runs/")
      .then((data: any[]) => {
        if (!data || data.length === 0) return;
        
        const totalRuns = data.length;
        const totalExceptions = data.reduce((acc, run) => acc + (run.exceptions_count || 0), 0);
        const validMatchRates = data.filter(run => run.match_rate !== null).map(run => run.match_rate);
        const avgMatchRate = validMatchRates.length > 0 
          ? validMatchRates.reduce((acc, rate) => acc + rate, 0) / validMatchRates.length 
          : 0;

        setStats({
          totalRuns,
          avgMatchRate: avgMatchRate,
          totalExceptions,
          aiResolutions: 0 // AI matches are not returned in the lightweight /runs response currently
        });

        const formattedChartData = data
          .filter(run => run.status === "completed")
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(run => {
            const d = new Date(run.created_at);
            return {
              name: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + " " + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
              matchRate: typeof run.match_rate === 'number' ? Number(run.match_rate.toFixed(2)) : 0,
              exceptions: run.exceptions_count || 0,
              volume: run.is_batch ? run.total_transactions : run.total_source_rows,
              runId: run.id.substring(0, 8),
            };
          });
          
        setChartData(formattedChartData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Overview</h1>
        <p className="text-gray-400">
          Monitor your reconciliation match rates and pending exceptions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-400">Total Runs (30d)</div>
          <div className="mt-2 text-3xl font-bold text-white">{loading ? "-" : stats.totalRuns}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-400">Avg Match Rate</div>
          <div className="mt-2 text-3xl font-bold text-[#AAFF00]">
            {loading ? "-" : `${stats.avgMatchRate.toFixed(1)}%`}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-400">Total Exceptions</div>
          <div className="mt-2 text-3xl font-bold text-red-500">{loading ? "-" : stats.totalExceptions}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
          <div className="text-sm font-medium text-gray-400">AI Resolutions</div>
          <div className="mt-2 text-3xl font-bold text-blue-400">{loading ? "-" : stats.aiResolutions}</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-8 mt-8 flex h-64 items-center justify-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#b3ff00]" />
        </div>
      ) : stats.totalRuns === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-8 mt-8 flex flex-col items-center justify-center text-center min-h-[300px]">
          <div className="text-[#AAFF00] mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white">No data yet</h3>
          <p className="text-gray-400 mt-2 max-w-sm">
            Start by running your first reconciliation from the Reconcile tab.
          </p>
          <Link 
            href="/reconcile" 
            className="mt-6 px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Start a Run
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Match Rate Trend Chart */}
          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-6">Match Rate Trend (%)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorMatch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#AAFF00" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#AAFF00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#333', opacity: 0.4 }} />
                  <Area type="monotone" dataKey="matchRate" stroke="#AAFF00" strokeWidth={2} fillOpacity={1} fill="url(#colorMatch)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Exceptions Chart */}
          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-6">Exceptions per Run</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#333', opacity: 0.4 }} />
                  <Bar dataKey="exceptions" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
