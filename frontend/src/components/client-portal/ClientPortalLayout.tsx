import { useNavigate } from "react-router-dom";
import { Briefcase, LifeBuoy } from "lucide-react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser, clearCredentials } from "../../store/slices/authSlice";
import { useLogoutMutation } from "../../store/api/authApi";
import { useGetClientProfileQuery } from "../../store/api/clientPortalApi";
import PortalShell from "../vendor-portal/PortalShell";
import type { PortalNavItem } from "../vendor-portal/PortalShell";

interface Props {
  children: React.ReactNode;
}

const NAV: PortalNavItem[] = [
  { to: "/client-portal/jobs", label: "Open positions", icon: Briefcase },
  { to: "/help", label: "Help", icon: LifeBuoy },
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
    <PortalShell
      portalLabel="Client portal"
      orgName={clientProfile?.name}
      orgDetail={clientProfile?.industry ?? undefined}
      nav={NAV}
      userName={user?.full_name}
      userEmail={user?.email}
      onLogout={handleLogout}
    >
      {children}
    </PortalShell>
  );
}
