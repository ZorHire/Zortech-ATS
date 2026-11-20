import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  Globe,
  LayoutGrid,
  Mail,
  Network,
  Rocket,
  Search,
  Send,
  Settings,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: string[];
  /** Only for the ZorTech platform-owner tenant. */
  platformOwnerOnly?: boolean;
  /** Hidden for the platform owner (e.g. tenant onboarding). */
  hidePlatformOwner?: boolean;
  /** Paths that should also highlight this item. */
  match?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ADMINS = ["super_admin", "accounts_manager"];
const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];

/** Sidebar structure: daily work first, settings last. Role lists match the previous flat menu. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Work",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutGrid, roles: STAFF },
      { label: "Jobs", path: "/jobs", icon: Briefcase, roles: [...STAFF, "vendor_user"], match: ["/pipeline"] },
      { label: "Interviews", path: "/interviews", icon: CalendarDays, roles: ["super_admin", "accounts_manager", "recruiter"] },
      { label: "Offers", path: "/offers", icon: TrendingUp, roles: ["super_admin", "accounts_manager", "recruiter"] },
      { label: "Campaigns", path: "/campaigns", icon: Send, roles: ["super_admin", "accounts_manager", "recruiter"] },
    ],
  },
  {
    label: "Talent",
    items: [
      { label: "Candidates", path: "/candidates", icon: Users, roles: STAFF },
      { label: "Resume search", path: "/search", icon: Search, roles: STAFF },
    ],
  },
  {
    label: "Partners",
    items: [
      { label: "Clients", path: "/clients", icon: Building, roles: STAFF },
      { label: "Vendors", path: "/vendors", icon: Building2, roles: ["super_admin", "accounts_manager", "vendor_manager"] },
      { label: "Vendor leaderboard", path: "/vendors/leaderboard", icon: Trophy, roles: ["super_admin", "accounts_manager", "vendor_manager"] },
      { label: "JD assignments", path: "/assigned-jds", icon: ClipboardList, roles: ["super_admin", "accounts_manager", "vendor_manager"] },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", path: "/analytics", icon: BarChart3, roles: ["super_admin", "accounts_manager", "vendor_manager"] },
      { label: "Reports", path: "/reports", icon: FileBarChart2, roles: ADMINS },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Admin", path: "/admin", icon: Settings, roles: ADMINS },
      { label: "Email settings", path: "/settings/email", icon: Mail, roles: ["super_admin", "accounts_manager", "recruiter"] },
      { label: "Job boards", path: "/settings/job-boards", icon: Globe, roles: ADMINS },
      { label: "Subscription", path: "/subscription", icon: CreditCard, roles: ADMINS },
      { label: "Companies", path: "/companies", icon: Network, roles: ["super_admin"], platformOwnerOnly: true },
      { label: "Onboarding", path: "/onboarding", icon: Rocket, roles: ["super_admin"], hidePlatformOwner: true },
    ],
  },
];

export function visibleGroups(role: string | undefined, isPlatformOwner: boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (role && !item.roles.includes(role)) return false;
      if (item.platformOwnerOnly && !isPlatformOwner) return false;
      if (item.hidePlatformOwner && isPlatformOwner) return false;
      return true;
    }),
  })).filter((g) => g.items.length > 0);
}

/** Flat list of the pages this user can open (used by the command palette). */
export function visibleNavItems(role: string | undefined, isPlatformOwner: boolean): (NavItem & { group: string })[] {
  return visibleGroups(role, isPlatformOwner).flatMap((g) => g.items.map((item) => ({ ...item, group: g.label })));
}

/** Longest matching path wins, so /vendors/leaderboard doesn't also light up /vendors. */
export function activePath(pathname: string, groups: NavGroup[]): string | null {
  let best: string | null = null;
  for (const g of groups) {
    for (const item of g.items) {
      const candidates = [item.path, ...(item.match ?? [])];
      for (const p of candidates) {
        const hit = p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/");
        if (hit && (!best || p.length > best.length)) best = item.path;
      }
    }
  }
  return best;
}
