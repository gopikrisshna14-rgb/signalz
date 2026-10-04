"use client";

import { Check, ChevronsUpDown, Crosshair, LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Search, Settings, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { logout } from "@/app/(auth)/actions";
import { BetaBadge, BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/pills";
import { cn } from "@/lib/utils";
import { CommandPalette, openResearchDialog } from "./command-palette";
import { NAV } from "./nav";

export interface ShellProps {
  user: { name: string; email: string; image: string | null };
  org: { id: string; name: string };
  orgs: { id: string; name: string; role: string }[];
  role: string;
  demoMode: boolean;
  children: React.ReactNode;
}

function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" || pathname.startsWith("/accounts") : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? n.label : undefined}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-hover hover:text-fg",
              active && "bg-hover text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            <n.icon size={16} aria-hidden />
            {collapsed ? <span className="sr-only">{n.label}</span> : n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function OrgSwitcher({ org, orgs, collapsed }: { org: ShellProps["org"]; orgs: ShellProps["orgs"]; collapsed?: boolean }) {
  const router = useRouter();
  async function switchTo(id: string) {
    const res = await fetch("/api/orgs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ orgId: id }) });
    if (res.ok) router.refresh();
    else toast.error("Could not switch workspace");
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover", collapsed && "justify-center px-0")} aria-label={`Workspace: ${org.name}. Switch workspace`}>
          <BrandMark size={22} />
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{org.name}</span>
              <ChevronsUpDown size={14} className="text-muted" aria-hidden />
            </>
          )}
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-60">
        <MenuLabel>Workspaces</MenuLabel>
        {orgs.map((o) => (
          <MenuItem key={o.id} onSelect={() => o.id !== org.id && switchTo(o.id)}>
            <span className="min-w-0 flex-1 truncate">{o.name}</span>
            {o.id === org.id ? <Check size={14} className="text-accent" /> : <span className="text-[12px] text-muted">{o.role}</span>}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => router.push("/onboarding?step=new")}>Create or join a workspace</MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function AppShell({ user, org, orgs, demoMode, children }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-[70] rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface p-2 transition-[width] duration-150 md:flex", collapsed ? "w-14" : "w-56")}>
        <OrgSwitcher org={org} orgs={orgs} collapsed={collapsed} />
        <div className="mt-3 flex-1">
          <NavLinks collapsed={collapsed} />
        </div>
        <button
          onClick={toggleCollapsed}
          className={cn("flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted hover:bg-hover hover:text-fg", collapsed && "justify-center px-0")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {collapsed ? null : "Collapse"}
        </button>
      </aside>

      {/* Mobile sidebar */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent title="Navigation" side="left" hideTitle className="bg-surface p-2">
          <OrgSwitcher org={org} orgs={orgs} />
          <div className="mt-3">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Dialog>

      <div className={cn("transition-[padding] duration-150", collapsed ? "md:pl-14" : "md:pl-56")}>
        {demoMode ? (
          <div role="status" className="flex items-center justify-center gap-2 bg-warm-bg px-4 py-1.5 text-center text-[12px] font-medium text-warm-fg">
            <TriangleAlert size={14} aria-hidden /> Demo data, not saved. Add Upstash Redis in Vercel → Storage to keep your data.
          </div>
        ) : null}
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-13 max-w-[1440px] items-center gap-2 px-4 sm:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <MenuIcon size={18} />
            </Button>
            <span className="md:hidden">
              <BrandMark size={22} />
            </span>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-muted hover:bg-hover sm:max-w-80"
              aria-label="Search accounts and commands"
            >
              <Search size={14} aria-hidden />
              <span className="truncate">Search accounts, commands…</span>
              <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[11px] sm:inline">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="primary" size="sm" onClick={() => openResearchDialog()} className="hidden sm:inline-flex">
                <Crosshair size={14} /> Research a LinkedIn URL
              </Button>
              <Button variant="primary" size="icon" onClick={() => openResearchDialog()} className="sm:hidden" aria-label="Research a LinkedIn URL">
                <Crosshair size={16} />
              </Button>
              <BetaBadge />
              <ThemeToggle />
              <Menu>
                <MenuTrigger asChild>
                  <button className="rounded-full" aria-label={`Account menu for ${user.name}`}>
                    <Avatar name={user.name} src={user.image} size={28} />
                  </button>
                </MenuTrigger>
                <MenuContent className="w-60">
                  <div className="px-2.5 py-2">
                    <div className="truncate text-[13px] font-semibold">{user.name}</div>
                    <div className="truncate text-[12px] text-muted">{user.email}</div>
                  </div>
                  <MenuSeparator />
                  <MenuItem asChild>
                    <Link href="/settings">
                      <Settings size={14} /> Settings
                    </Link>
                  </MenuItem>
                  <MenuItem onSelect={() => void logout()}>
                    <LogOut size={14} /> Sign out
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
