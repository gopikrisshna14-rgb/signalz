import { Crosshair, LayoutDashboard, Network, Send, Settings } from "lucide-react";

export const NAV = [
  { href: "/", label: "Today", icon: LayoutDashboard, key: "g t" },
  { href: "/research", label: "Research", icon: Crosshair, key: "g r" },
  { href: "/clusters", label: "Clusters", icon: Network, key: "g c" },
  { href: "/outreach", label: "Outreach", icon: Send, key: "g o" },
  { href: "/settings", label: "Settings", icon: Settings, key: "g s" },
] as const;
