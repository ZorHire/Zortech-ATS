import { Link, useLocation } from "react-router-dom";
import {
  Briefcase,
  Users,
  Building2,
  Building,
  Mail,
  BarChart3,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutGrid,
  Send,
  CreditCard,
  Rocket,
  Network,
  ClipboardList,
  CalendarDays,
  TrendingUp,
  FileBarChart2,
} from "lucide-react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser, clearCredentials } from "../../store/slices/authSlice";
import { selectSubscription } from "../../store/slices/subscriptionSlice";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    icon: LayoutGrid,
    label: "Dashboard",
    path: "/",
    roles: [
      "super_admin",
      "accounts_manager",
      "vendor_manager",
      "recruiter",
    ],
  },
  {
    icon: Briefcase,
    label: "Jobs",
    path: "/jobs",
    roles: [
      "super_admin",
      "accounts_manager",
      "vendor_manager",
      "recruiter",
      "vendor_user",
    ],
  },
  {
    icon: Users,
    label: "Candidates",
    path: "/candidates",
    roles: [
      "super_admin",
      "accounts_manager",
      "vendor_manager",
      "recruiter",
    ],
  },
  {
    icon: Search,
    label: "Resume Search",
    path: "/search",
    roles: [
      "super_admin",
      "accounts_manager",
      "vendor_manager",
      "recruiter",
    ],
  },
  {
    icon: Building2,
    label: "Vendors",
    path: "/vendors",
    roles: ["super_admin", "accounts_manager", "vendor_manager"],
  },
  {
    icon: Building,
    label: "Clients",
    path: "/clients",
    roles: ["super_admin", "accounts_manager", "vendor_manager", "recruiter"],
  },
  {
    icon: ClipboardList,
    label: "JD Assignments",
    path: "/assigned-jds",
    roles: ["super_admin", "accounts_manager", "vendor_manager"],
  },
  {
    icon: CalendarDays,
    label: "Interviews",
    path: "/interviews",
    roles: ["super_admin", "accounts_manager", "recruiter"],
  },
  {
    icon: TrendingUp,
    label: "Offers",
    path: "/offers",
    roles: ["super_admin", "accounts_manager", "recruiter"],
  },
  {
    icon: BarChart3,
    label: "Analytics",
    path: "/analytics",
    roles: ["super_admin", "accounts_manager", "vendor_manager"],
  },
  {
    icon: FileBarChart2,
    label: "Reports",
    path: "/reports",
    roles: ["super_admin", "accounts_manager"],
  },
  {
    icon: Settings,
    label: "Admin",
    path: "/admin",
    roles: ["super_admin", "accounts_manager"],
  },
  {
    icon: Send,
    label: "Campaigns",
    path: "/campaigns",
    roles: ["super_admin", "accounts_manager", "recruiter"],
  },
  {
    icon: Mail,
    label: "Email Settings",
    path: "/settings/email",
    roles: [
      "super_admin",
      "accounts_manager",
      "recruiter",
    ],
  },
  {
    icon: CreditCard,
    label: "Subscription",
    path: "/subscription",
    roles: ["super_admin", "accounts_manager"],
  },
  {
    icon: Network,
    label: "Companies",
    path: "/companies",
    roles: ["super_admin"],
    platformOwnerOnly: true,
  },
  {
    icon: Rocket,
    label: "Onboarding",
    path: "/onboarding",
    roles: ["super_admin"],
    hidePlatformOwner: true,
  },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectCurrentUser);
  const subscription = useAppSelector(selectSubscription);

  const isPlatformOwner = !!subscription?.isPlatformOwner;
  const visibleItems = navItems.filter((item) => {
    if (profile?.role && !item.roles.includes(profile.role)) return false;
    if ((item as any).platformOwnerOnly && !isPlatformOwner) return false;
    if ((item as any).hidePlatformOwner && isPlatformOwner) return false;
    return true;
  });

  return (
    <aside
      className={`flex flex-col bg-[#24180f] text-white transition-all duration-300 ${collapsed ? "w-20" : "w-64"} h-full py-5`}
    >
      {/* Logo */}
      <Link
        to="/"
        aria-label="ZorHire home"
        className={`flex flex-col mb-6 ${collapsed ? "items-center" : "px-6"}`}
      >
        {collapsed ? (
          <img src="/brand/zortech-icon.svg" alt="ZorTech" className="w-10 h-10 object-contain" />
        ) : (
          <>
            <img src="/brand/zortech-logo-white.png" alt="ZorTech" className="w-40 h-auto object-contain" />
            <p className="mt-2 text-[11px] font-semibold text-amber-200/80 tracking-wide">
              ZorHire · Recruitment
            </p>
          </>
        )}
      </Link>

      {/* Nav Items: scrolls on short screens so Logout and the collapse toggle stay visible */}
      <nav aria-label="Main" className="flex-1 min-h-0 overflow-y-auto space-y-0.5 px-3">
        {visibleItems.map(({ icon: Icon, label, path }) => {
          const active =
            location.pathname === path ||
            (path !== "/" && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                ${
                  active
                    ? "text-amber-100 bg-[#f7e6cd]/20"
                    : "text-amber-200/70 hover:text-white hover:bg-[#f7e6cd]/10"
                } ${collapsed ? "justify-center" : ""}`}
            >
              {active && (
                <div className="absolute left-[-12px] w-1.5 h-8 bg-amber-200 rounded-r-full" />
              )}
              <Icon
                size={18}
                className={`flex-shrink-0 transition-all ${active ? "scale-110" : "group-hover:scale-110"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              {!collapsed && (
                <span
                  className={`text-[13px] font-bold tracking-tight ${active ? "text-white" : ""}`}
                >
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="pt-3 px-3 space-y-1 border-t border-white/10">
        <button
          type="button"
          onClick={() => dispatch(clearCredentials())}
          aria-label="Sign out"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#d7c1a5] hover:text-[#ffcda2] hover:bg-[#7f5a30]/15 transition-all ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut size={18} strokeWidth={2} />
          {!collapsed && (
            <span className="text-[13px] font-bold tracking-tight">Sign out</span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-amber-300 hover:text-amber-100 transition-all ${collapsed ? "justify-center" : "justify-end"}`}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
