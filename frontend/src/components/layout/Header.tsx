import type { ReactNode } from "react";
import PageHeader from "../ui/PageHeader";
import type { Crumb } from "../ui/PageHeader";

interface HeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}

/**
 * Kept for the pages that already use <Header>. Notifications and the profile
 * link now live in the app-wide TopBar, so this is just the page title row.
 * New code should use <PageHeader> from components/ui.
 */
export default function Header({ title, subtitle, actions, breadcrumbs }: HeaderProps) {
  return <PageHeader title={title} subtitle={subtitle} actions={actions} breadcrumbs={breadcrumbs} />;
}
