/** The ZorHire desktop app (Windows) exposes this when ZorHire runs inside it. */
export interface ZorHireDesktop {
  isDesktop: true;
  version: string;
  platform: string;
  /** Open a website (LinkedIn, Naukri, a job board) as a tab in the desktop app. */
  openTool: (url: string) => void;
}

export const desktop: ZorHireDesktop | undefined =
  typeof window !== "undefined" ? (window as unknown as { zorhireDesktop?: ZorHireDesktop }).zorhireDesktop : undefined;

export const isDesktopApp = !!desktop?.isDesktop;

/** Stable download link for the Windows installer (served from the ZorHire server). */
export const DESKTOP_DOWNLOAD = "https://zorhire.zortechs.in/desktop/ZorHire-Setup.exe";

/** "desktop-1.0.0" → "desktop app v1.0.0", "1.0.0" → "extension v1.0.0". */
export function clientVersionLabel(v?: string | null): string {
  if (!v) return "";
  return v.startsWith("desktop-") ? `desktop app v${v.slice(8)}` : `extension v${v}`;
}
