import React from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { selectCurrentUser } from '../../store/slices/authSlice';
import NotificationBell from '../ui/NotificationBell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const profile = useAppSelector(selectCurrentUser);

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

        <NotificationBell />

        <Link to="/profile" className="flex items-center gap-3 pl-4 border-l border-[#e8d4c2] ml-2 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm border border-white/50 bg-white">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                {(profile?.full_name || profile?.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-black text-[#111111] leading-none">
              {profile?.full_name || "User"}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1 flex items-center gap-1">
               {profile?.role?.replace("_", " ") || "Member"}
              <span className="w-1 h-1 bg-green-400 rounded-full"></span>
              Online
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
