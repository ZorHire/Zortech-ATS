import { NavLink, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser, clearCredentials } from "../../store/slices/authSlice";
import { useLogoutMutation } from "../../store/api/authApi";
import { useGetVendorProfileQuery } from "../../store/api/vendorPortalApi";

interface Props {
  children: React.ReactNode;
}

const NAV = [
  {
    to: "/vendor-portal/jobs",
    label: "Assigned Jobs",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
      </svg>
    ),
  },
  {
    to: "/vendor-portal/submissions",
    label: "My Submissions",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function VendorPortalLayout({ children }: Props) {
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  const { data: vendorProfile } = useGetVendorProfileQuery();

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
      <aside className="w-64 bg-teal-900 flex flex-col flex-shrink-0">
        {/* Logo / Company */}
        <div className="p-5 border-b border-teal-800">
          <p className="text-xs font-medium text-teal-400 uppercase tracking-wider mb-1">Vendor Portal</p>
          <h1 className="text-white font-bold text-base truncate">
            {vendorProfile?.company_name ?? "Loading…"}
          </h1>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium
            ${vendorProfile?.tier === "preferred" ? "bg-amber-400/20 text-amber-300" : "bg-teal-700 text-teal-200"}`}>
            {vendorProfile?.tier ?? "standard"}
          </span>
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
                   ? "bg-teal-700 text-white"
                   : "text-teal-200 hover:bg-teal-800 hover:text-white"}`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-teal-800">
          <p className="text-teal-300 text-xs truncate">{user?.full_name}</p>
          <p className="text-teal-500 text-xs truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full text-left text-xs text-teal-400 hover:text-white transition-colors"
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
