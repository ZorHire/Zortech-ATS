import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  text: string;
  className?: string;
}

export default function CopyButton({ text, className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        "flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
      }
    >
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
