import { Link } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser } from "../../store/slices/authSlice";
import NotificationBell from "../ui/NotificationBell";
import { PALETTE_SHORTCUT_LABEL } from "./CommandPalette";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin",
  accounts_manager: "Accounts manager",
  vendor_manager: "Vendor manager",
  recruiter: "Recruiter",
  vendor_user: "Vendor",
  client_user: "Client",
};

/**
 * App-wide bar above every page: menu button on phones, notifications and the
 * profile link. Previously each page header rendered these itself, so they
 * disappeared on the 8 pages with a custom header.
 */
export default function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch?: () => void }) {
  const profile = useAppSelector(selectCurrentUser);
  const name = profile?.full_name || profile?.email || "User";

  return (
    <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="rounded-lg p-2 text-ink-soft hover:bg-surface-sunken lg:hidden"
      >
        <Menu size={20} />
      </button>
      <img src="/brand/zortech-icon.svg" alt="" className="h-7 w-7 lg:hidden" />

      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search"
          aria-keyshortcuts="Control+K Meta+K /"
          className="ml-auto flex h-9 items-center gap-2 rounded-lg p-2 text-ink-soft hover:bg-surface-sunken sm:ml-0 sm:w-64 sm:border sm:border-line sm:bg-surface sm:px-3 sm:text-muted sm:hover:border-line-strong md:w-80"
        >
          <Search size={18} aria-hidden="true" className="shrink-0 sm:h-4 sm:w-4" />
          <span className="hidden flex-1 text-left text-sm sm:inline">Search…</span>
          <kbd className="hidden rounded border border-line bg-white px-1.5 py-0.5 font-sans text-xs text-muted sm:inline">
            {PALETTE_SHORTCUT_LABEL}
          </kbd>
        </button>
      )}

      <div className={`${onSearch ? "sm:ml-auto" : "ml-auto"} flex items-center gap-1 sm:gap-3`}>
        <NotificationBell />
        <Link
          to="/profile"
          className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-surface-sunken"
          aria-label={`Your profile: ${name}`}
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-navy-600 text-sm font-semibold text-white">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[160px] truncate text-sm font-medium text-ink">{name}</span>
            <span className="block text-xs text-muted">{ROLE_LABELS[profile?.role ?? ""] ?? "Member"}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
