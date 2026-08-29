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
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Reconcile", href: "/reconcile", icon: ArrowLeftRight },
    { name: "History", href: "/history", icon: History },
    { name: "Mappings", href: "/mappings", icon: Database },
    { name: "AI Settings", href: "/settings", icon: Settings },
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
        
        <div className="p-4 border-b border-border bg-muted/30">
          <OrganizationSwitcher 
            hidePersonal
            appearance={{
              elements: {
                organizationSwitcherTrigger: "text-foreground hover:text-foreground transition-colors w-full flex justify-between",
                organizationPreviewMainIdentifier: "text-foreground font-medium",
                organizationPreviewAvatarContainer: "border border-border rounded-md",
              }
            }}
          />
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
