import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LogOut, Menu, X } from "lucide-react";
import ToastContainer from "../ui/ToastContainer";

export interface PortalNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface PortalShellProps {
  /** e.g. "Vendor portal" */
  portalLabel: string;
  /** Company name shown under the logo. */
  orgName?: string;
  orgDetail?: string;
  nav: PortalNavItem[];
  userName?: string;
  userEmail?: string;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * Brand shell shared by the vendor and client portals (they render outside the
 * main app Layout). Navy sidebar from `lg` up; top bar + drawer on phones/tablets.
 */
export default function PortalShell({
  portalLabel,
  orgName,
  orgDetail,
  nav,
  userName,
  userEmail,
  onLogout,
  children,
}: PortalShellProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface lg:flex-row">
      {/* Phone / tablet top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-navy-800 px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/brand/zortech-logo-white.png" alt="ZorTech" className="h-5 w-auto" />
          <span className="truncate text-sm font-medium text-navy-200">{portalLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-lg p-2 text-navy-100 hover:bg-white/10 hover:text-white"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Drawer backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-navy-950/50 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-800 text-navy-100 transition-transform duration-200 lg:static lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <img src="/brand/zortech-logo-white.png" alt="ZorTech" className="h-6 w-auto" />
            <p className="mt-1 text-xs font-medium text-navy-300">{portalLabel}</p>
            <p className="mt-3 truncate text-sm font-semibold text-white">{orgName ?? "Loading…"}</p>
            {orgDetail && <p className="truncate text-xs text-navy-300">{orgDetail}</p>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-navy-200 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Portal" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {nav.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive ? "bg-white/10 font-semibold text-white" : "text-navy-100/80 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-brand-500" aria-hidden="true" />}
                      <Icon size={18} strokeWidth={isActive ? 2.25 : 1.9} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-white/10 px-3 py-3">
          <div className="px-3 pb-2">
            <p className="truncate text-sm text-white">{userName}</p>
            <p className="truncate text-xs text-navy-300">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-navy-100/80 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto outline-none">
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
