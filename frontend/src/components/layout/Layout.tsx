import { useState } from "react";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#1d170f] overflow-hidden p-2">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="flex-1 flex flex-col min-w-0 bg-[#f9efe1] rounded-[40px] shadow-2xl overflow-hidden ml-2 text-slate-900">
        {children}
      </main>
    </div>
  );
}
