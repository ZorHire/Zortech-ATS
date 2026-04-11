import { Bell, Search } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const { profile } = useAuth();

  return (
    <header className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#fff5ec] border-b border-[#e8d4c2]">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#1d1410] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm font-bold text-[#79614f] mt-1 uppercase tracking-widest">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex w-full lg:w-auto flex-wrap items-center gap-3 sm:gap-4">
        {actions}
        <div className="flex items-center gap-4 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          <button className="p-2.5 text-gray-400 hover:text-[#111111] hover:bg-white hover:shadow-sm rounded-xl transition-all">
            <Search size={20} strokeWidth={2.5} />
          </button>
          <button className="relative p-2.5 text-gray-400 hover:text-[#111111] hover:bg-white hover:shadow-sm rounded-xl transition-all">
            <Bell size={20} strokeWidth={2.5} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 pl-2 pr-4 py-1.5 rounded-2xl border border-gray-100 hover:shadow-sm transition-all cursor-pointer group">
          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm transition-transform group-hover:scale-105">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold">
                {(profile?.full_name || profile?.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-black text-[#111111] leading-none">
              {profile?.full_name || "User"}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1 flex items-center gap-1">
              {profile?.role?.replace("_", " ") || "Member"}
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              Online
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
