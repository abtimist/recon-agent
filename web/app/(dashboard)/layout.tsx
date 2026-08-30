"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import {
  LayoutDashboard,
  ArrowLeftRight,
  History,
  Settings,
  Database,
  Crown,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useAuthStatus } from "@/hooks/useAuthStatus";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: authStatus } = useAuthStatus();

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Reconcile", href: "/reconcile", icon: ArrowLeftRight },
    { name: "History", href: "/history", icon: History },
    { name: "Mappings", href: "/mappings", icon: Database },
    { name: "AI Settings", href: "/settings", icon: Settings },
    { name: "Developer", href: "/developer", icon: Terminal },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-accent/20">
            <span className="text-accent font-bold text-sm">R</span>
          </div>
          <span className="font-bold tracking-tight">Recon Agent</span>
        </div>
        
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col gap-3">
          <div className="w-full">
            <OrganizationSwitcher 
              hidePersonal
              appearance={{
                elements: {
                  organizationSwitcherTrigger: "w-full py-1 hover:bg-muted/50 rounded-md transition-colors",
                  organizationPreviewAvatarContainer: "w-7 h-7",
                }
              }}
            />
          </div>
          {authStatus && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 shadow-[0_0_10px_rgba(179,255,0,0.1)]">
                <Crown className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-accent tracking-wide uppercase">{authStatus.plan}</span>
              </div>
              {authStatus.org_role && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-blue-400 tracking-wide uppercase">{authStatus.org_role}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-accent/10 text-accent" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-accent" : "text-muted-foreground"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-9 h-9 border border-border"
                }
              }}
            />
            <div className="text-sm font-medium text-muted-foreground">Account</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
