import { NavLink, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser, clearCredentials } from "../../store/slices/authSlice";
import { useLogoutMutation } from "../../store/api/authApi";
import { useGetClientProfileQuery } from "../../store/api/clientPortalApi";

interface Props {
  children: React.ReactNode;
}

const NAV = [
  {
    to: "/client-portal/jobs",
    label: "Open Positions",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
      </svg>
    ),
  },
];

export default function ClientPortalLayout({ children }: Props) {
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  const { data: clientProfile } = useGetClientProfileQuery();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // ignore
    }
    localStorage.removeItem("jwt");
    dispatch(clearCredentials());
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 flex flex-col flex-shrink-0">
        {/* Logo / Company */}
        <div className="p-5 border-b border-indigo-800">
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-1">Client Portal</p>
          <h1 className="text-white font-bold text-base truncate">
            {clientProfile?.name ?? "Loading…"}
          </h1>
          {clientProfile?.industry && (
            <p className="text-indigo-300 text-xs mt-0.5 truncate">{clientProfile.industry}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? "bg-indigo-700 text-white"
                   : "text-indigo-200 hover:bg-indigo-800 hover:text-white"}`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-indigo-800">
          <p className="text-indigo-300 text-xs truncate">{user?.full_name}</p>
          <p className="text-indigo-500 text-xs truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full text-left text-xs text-indigo-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
