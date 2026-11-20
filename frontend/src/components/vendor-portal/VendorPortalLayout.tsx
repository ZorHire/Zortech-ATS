import { useNavigate } from "react-router-dom";
import { Briefcase, Users } from "lucide-react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser, clearCredentials } from "../../store/slices/authSlice";
import { useLogoutMutation } from "../../store/api/authApi";
import { useGetVendorProfileQuery } from "../../store/api/vendorPortalApi";
import PortalShell from "./PortalShell";
import type { PortalNavItem } from "./PortalShell";

interface Props {
  children: React.ReactNode;
}

const NAV: PortalNavItem[] = [
  { to: "/vendor-portal/jobs", label: "Assigned jobs", icon: Briefcase },
  { to: "/vendor-portal/submissions", label: "My submissions", icon: Users },
];

export default function VendorPortalLayout({ children }: Props) {
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();
  // Only the company name is shown; the internal vendor tier is not vendor-facing.
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
    <PortalShell
      portalLabel="Vendor portal"
      orgName={vendorProfile?.company_name}
      nav={NAV}
      userName={user?.full_name}
      userEmail={user?.email}
      onLogout={handleLogout}
    >
      {children}
    </PortalShell>
  );
}
