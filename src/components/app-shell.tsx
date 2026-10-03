"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Radar,
  Search,
  Send,
  Settings,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/format";
import type { Workspace } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/research", label: "Research", icon: Search },
  { href: "/clusters", label: "Clusters", icon: Network },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" || pathname.startsWith("/accounts") : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150",
              active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}

function WorkspaceBadge({ ws, collapsed }: { ws: Workspace; collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-4", collapsed && "justify-center px-0")}>
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
        <Radar size={16} />
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{ws.orgName}</div>
          <div className="text-[12px] text-muted capitalize">{ws.role}</div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("sidebar", next ? "collapsed" : "open");
    } catch {}
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-150 md:flex",
          collapsed ? "w-[60px]" : "w-[220px]",
        )}
      >
        <WorkspaceBadge ws={workspace} collapsed={collapsed} />
        <NavLinks collapsed={collapsed} />
        <div className="mt-auto p-2">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-muted hover:bg-surface-2 hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="animate-slide-in absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between pr-2">
              <WorkspaceBadge ws={workspace} />
              <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="p-2 text-muted">
                <X size={18} />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 md:hidden"
          >
            <Menu size={18} />
          </button>
          <Link
            href="/research"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg hover:opacity-90"
          >
            <Search size={14} />
            <span className="hidden sm:inline">Research a LinkedIn URL</span>
            <span className="sm:hidden">Research</span>
          </Link>
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="rounded-full"
            >
              <Avatar name={workspace.fullName ?? workspace.email} size={30} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="animate-slide-in absolute right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lg"
                >
                  <div className="px-2.5 py-2">
                    <div className="truncate text-[13px] font-medium">{workspace.fullName ?? "Signed in"}</div>
                    <div className="truncate text-[12px] text-muted">{workspace.email}</div>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] hover:bg-surface-2"
                  >
                    <Settings size={14} /> Settings
                  </Link>
                  <button
                    role="menuitem"
                    onClick={signOut}
                    className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] hover:bg-surface-2"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
