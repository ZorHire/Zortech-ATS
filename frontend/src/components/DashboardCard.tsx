import type { ElementType } from "react";
import { StatCard } from "./ui";

interface DashboardCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  description?: string;
  /** Kept for backwards compatibility; colours now come from the design system. */
  color?: string;
  /** Kept for backwards compatibility; colours now come from the design system. */
  bgColor?: string;
  onClick?: () => void;
}

/** Thin wrapper over the design-system StatCard. Prefer StatCard in new code. */
export default function DashboardCard({ icon: Icon, label, value, description, onClick }: DashboardCardProps) {
  return <StatCard label={label} value={value} hint={description} icon={<Icon size={18} aria-hidden="true" />} onClick={onClick} />;
}
