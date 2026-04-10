import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Building2, 
  Mail, 
  BarChart3, 
  Settings, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Bell, 
  LogOut, 
  Wallet,
  LayoutGrid,
  Box,
  CircleUser
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { icon: LayoutGrid, label: 'Dashboard', path: '/', roles: ['super_admin','ats_admin','senior_recruiter','recruiter','sourcing_specialist'] },
  { icon: Briefcase, label: 'Jobs', path: '/jobs', roles: ['super_admin','ats_admin','senior_recruiter','recruiter','sourcing_specialist'] },
  { icon: Users, label: 'Candidates', path: '/candidates', roles: ['super_admin','ats_admin','senior_recruiter','recruiter','sourcing_specialist'] },
  { icon: Search, label: 'Resume Search', path: '/search', roles: ['super_admin','ats_admin','senior_recruiter','recruiter','sourcing_specialist'] },
  { icon: Building2, label: 'Vendors', path: '/vendors', roles: ['super_admin','ats_admin','senior_recruiter'] },
  { icon: Mail, label: 'Email Campaigns', path: '/campaigns', roles: ['super_admin','ats_admin','senior_recruiter','recruiter'] },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', roles: ['super_admin','ats_admin','senior_recruiter'] },
  { icon: Settings, label: 'Admin', path: '/admin', roles: ['super_admin','ats_admin'] },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const visibleItems = navItems.filter(item =>
    !profile?.role || item.roles.includes(profile.role)
  );

  return (
    <aside className={`flex flex-col bg-[#111111] text-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'} h-full py-6`}>
      {/* Logo */}
      <div className={`flex items-center mb-10 ${collapsed ? 'justify-center' : 'px-6 gap-3'}`}>
        <div className="flex-shrink-0 w-12 h-12 bg-[#F3F0E2] rounded-[18px] flex items-center justify-center shadow-lg">
          <Box size={24} className="text-[#111111]" fill="#111111" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-xl font-black text-white tracking-tight leading-none">ZorHire</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Recruitment</p>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-4 px-4">
        {visibleItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative
                ${active
                  ? 'text-white'
                  : 'text-gray-500 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`}
            >
              {active && (
                <div className="absolute left-[-16px] w-1.5 h-8 bg-white rounded-r-full" />
              )}
              <Icon 
                size={22} 
                className={`flex-shrink-0 transition-all ${active ? 'scale-110' : 'group-hover:scale-110'}`} 
                strokeWidth={active ? 2.5 : 2}
              />
              {!collapsed && <span className={`text-sm font-bold tracking-tight ${active ? 'text-white' : ''}`}>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="mt-auto px-4 space-y-4">
        <button
          onClick={signOut}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-gray-500 hover:text-red-400 hover:bg-red-950/20 transition-all ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={22} strokeWidth={2} />
          {!collapsed && <span className="text-sm font-bold tracking-tight">Logout</span>}
        </button>
        
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-gray-400 transition-all ${collapsed ? 'justify-center' : 'justify-end'}`}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
