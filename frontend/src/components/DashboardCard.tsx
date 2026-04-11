import type React from "react";

interface DashboardCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  description?: string;
  color?: string;
  bgColor?: string;
  onClick?: () => void;
}

export default function DashboardCard({
  icon: Icon,
  label,
  value,
  description,
  color = "text-slate-900",
  bgColor = "bg-white",
  onClick,
}: DashboardCardProps) {
  const isInteractive = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left ${bgColor} rounded-[32px] p-6 flex flex-col justify-between min-h-[160px] transition-all duration-200 ${
        isInteractive
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-xl"
          : ""
      }`}
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-lg font-black text-slate-900 tracking-tight">
            {value}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
        </div>
        <div
          className={`w-10 h-10 rounded-[18px] bg-white shadow-sm flex items-center justify-center ${color}`}
        >
          <Icon size={18} />
        </div>
      </div>

      {description ? (
        <p className="text-[11px] text-slate-500 mt-4 leading-snug">
          {description}
        </p>
      ) : null}
    </button>
  );
}
