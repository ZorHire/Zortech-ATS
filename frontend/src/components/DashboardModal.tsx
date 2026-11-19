import type { ReactNode } from "react";
import { Modal } from "./ui";

interface DashboardModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Read-only drill-down dialog for dashboard stat cards (closes on Esc or backdrop). */
export default function DashboardModal({ title, subtitle, onClose, children }: DashboardModalProps) {
  return (
    <Modal open onClose={onClose} title={title} description={subtitle} size="lg" closeOnBackdrop>
      {children}
    </Modal>
  );
}
