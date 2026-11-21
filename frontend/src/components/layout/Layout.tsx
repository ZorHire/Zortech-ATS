import { Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ResumeDropZone from "./ResumeDropZone";
import CommandPalette, { useCommandPaletteShortcut } from "./CommandPalette";
import ToastContainer from "../ui/ToastContainer";
import ErrorBoundary from "../ErrorBoundary";
import { PageSkeleton } from "../ui/Skeleton";
import { ServerUnreachableBanner } from "./AppStatusScreens";
import RenewalReminder from "../subscription/RenewalReminder";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectSidebarCollapsed, setSidebarCollapsed } from "../../store/slices/uiSlice";
import HelpPanel from "../help/HelpPanel";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  // Desktop collapse is persisted in the ui slice; the phone drawer is not.
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Command palette: Ctrl+K / Cmd+K anywhere, "/" outside text fields.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(paletteOpen, setPaletteOpen);

  // Close the phone drawer on navigation and with Esc.
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
      >
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => dispatch(setSidebarCollapsed(!collapsed))}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <ServerUnreachableBanner />
        <RenewalReminder />
        {/* The page area scrolls; pages without their own scroll wrapper used to be clipped. */}
        <main id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none">
          {/* A crash or slow chunk on one screen no longer takes the sidebar with it. */}
          <ErrorBoundary variant="page" resetKey={location.pathname}>
            <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ResumeDropZone />
      <HelpPanel />
      <ToastContainer />
    </div>
  );
}
