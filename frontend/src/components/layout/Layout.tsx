import Sidebar from "./Sidebar";
import ToastContainer from "../ui/ToastContainer";
import { ServerUnreachableBanner } from "./AppStatusScreens";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectSidebarCollapsed, setSidebarCollapsed } from "../../store/slices/uiSlice";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const dispatch = useAppDispatch();
  // Persisted in the ui slice, so the choice survives reloads.
  const collapsed = useAppSelector(selectSidebarCollapsed);

  return (
    <div className="flex h-screen bg-[#1d170f] overflow-hidden p-2">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => dispatch(setSidebarCollapsed(!collapsed))}
      />
      <main className="flex-1 flex flex-col min-w-0 bg-[#f9efe1] rounded-[40px] shadow-2xl overflow-hidden ml-2 text-slate-900">
        <ServerUnreachableBanner />
        {/* The page area scrolls; previously pages without their own scroll wrapper were clipped. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">{children}</div>
      </main>
      <ToastContainer />
    </div>
  );
}
