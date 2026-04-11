import { X } from "lucide-react";
import { useEffect } from "react";

interface DashboardModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function DashboardModal({
  title,
  subtitle,
  onClose,
  children,
}: DashboardModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-[#111111] tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-[#111111]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 sm:px-8 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
