import { Link, useLocation } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser, clearCredentials } from "../../store/slices/authSlice";
import { selectSubscription } from "../../store/slices/subscriptionSlice";
import { activePath, visibleGroups } from "./navConfig";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Phone/tablet: the sidebar is an off-canvas drawer. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectCurrentUser);
  const subscription = useAppSelector(selectSubscription);

  const groups = visibleGroups(profile?.role, !!subscription?.isPlatformOwner);
  const active = activePath(location.pathname, groups);
  // The drawer is always full width; "collapsed" only applies on desktop.
  const narrow = collapsed && !mobileOpen;

  return (
    <>
      {/* Phone backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-navy-950/50 transition-opacity lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden="true"
        onClick={onMobileClose}
      />
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-navy-800 text-navy-100 transition-[transform,width] duration-200
          lg:static lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          ${narrow ? "lg:w-[72px]" : "w-64"}`}
      >
        {/* Brand */}
        <div className={`flex h-16 shrink-0 items-center border-b border-white/10 ${narrow ? "justify-center px-2" : "justify-between px-5"}`}>
          <Link to="/" aria-label="ZorHire home" className="flex min-w-0 flex-col" onClick={onMobileClose}>
            {narrow ? (
              <img src="/brand/zortech-icon.svg" alt="ZorTech" className="h-9 w-9" />
            ) : (
              <>
                <img src="/brand/zortech-logo-white.png" alt="ZorTech" className="h-6 w-auto self-start" />
                <span className="mt-1 text-[11px] font-medium tracking-wide text-navy-300">ZorHire · Recruitment</span>
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-navy-200 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation: scrolls on short screens so Sign out stays visible */}
        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              {narrow ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden="true" />
              ) : (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-navy-300/80">{group.label}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map(({ icon: Icon, label, path }) => {
                  const isActive = active === path;
                  return (
                    <li key={path}>
                      <Link
                        to={path}
                        onClick={onMobileClose}
                        title={narrow ? label : undefined}
                        aria-label={narrow ? label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                          ${narrow ? "justify-center" : ""}
                          ${isActive ? "bg-white/10 font-semibold text-white" : "text-navy-100/80 hover:bg-white/5 hover:text-white"}`}
                      >
                        {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-brand-500" aria-hidden="true" />}
                        <Icon size={18} strokeWidth={isActive ? 2.25 : 1.9} className="shrink-0" aria-hidden="true" />
                        {!narrow && <span className="truncate">{label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 space-y-0.5 border-t border-white/10 px-3 py-3">
          <button
            type="button"
            onClick={() => dispatch(clearCredentials())}
            title={narrow ? "Sign out" : undefined}
            aria-label="Sign out"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-navy-100/80 hover:bg-white/5 hover:text-white ${narrow ? "justify-center" : ""}`}
          >
            <LogOut size={18} aria-hidden="true" />
            {!narrow && <span>Sign out</span>}
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-navy-300 hover:bg-white/5 hover:text-white lg:flex ${narrow ? "justify-center" : ""}`}
          >
            {collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
            {!narrow && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
