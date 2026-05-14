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
      className={`w-full text-left ${bgColor} rounded-[20px] sm:rounded-[28px] lg:rounded-[32px] p-3 sm:p-4 lg:p-6 flex flex-col justify-between min-h-[120px] sm:min-h-[140px] lg:min-h-[160px] transition-all duration-200 ${
        isInteractive
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-xl"
          : ""
      }`}
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 sm:space-y-2 min-w-0">
          <p className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
            {value}
          </p>
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-500">
            {label}
          </p>
        </div>
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-[12px] sm:rounded-[14px] lg:rounded-[18px] bg-white shadow-sm flex items-center justify-center flex-shrink-0 ${color}`}
        >
          <Icon size={16} />
        </div>
      </div>

      {description ? (
        <p className="text-[10px] sm:text-[11px] text-slate-500 mt-2 sm:mt-4 leading-snug">
          {description}
        </p>
      ) : null}
    </button>
  );
}
