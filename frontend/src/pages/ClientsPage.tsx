import { useState } from "react";
import {
  Plus,
  Search,
  Building,
  Mail,
  Phone,
  Globe,
  Star,
  Users,
  Trash2,
  Eye,
} from "lucide-react";
import ClientInfoModal from "../components/clients/ClientInfoModal";
import ClientDetailModal from "../components/clients/ClientDetailModal";
import {
  Badge,
  Button,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  StatCard,
  useConfirm,
} from "../components/ui";
import { useNotify } from "../hooks/useNotify";
import { useGetClientsQuery, useDeleteClientMutation } from "../store/api/jobApi";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";

const INDUSTRY_OPTIONS = [
  "All Industries",
  "Technology",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Education",
  "Media",
  "Consulting",
  "Other",
];

const TIER_OPTIONS = [
  { value: "all", label: "All Tiers" },
  { value: "priority", label: "Priority" },
  { value: "standard", label: "Standard" },
];

export default function ClientsPage() {
  const user = useAppSelector(selectCurrentUser);
  const canManage = user?.role === "super_admin" || user?.role === "accounts_manager";
  const notify = useNotify();
  const confirm = useConfirm();

  const { data: clients = [], isLoading, isError, error, isFetching, refetch } = useGetClientsQuery();
  const [deleteClient] = useDeleteClientMutation();

  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("All Industries");
  const [tierFilter, setTierFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [detailClient, setDetailClient] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = clients.filter((c: any) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (c.name || c.client_name || "").toLowerCase().includes(q) ||
      (c.industry || "").toLowerCase().includes(q) ||
      (c.primary_contact_name || c.contact_name || "").toLowerCase().includes(q);
    const matchIndustry =
      industryFilter === "All Industries" || c.industry === industryFilter;
    const matchTier = tierFilter === "all" || c.tier === tierFilter;
    return matchSearch && matchIndustry && matchTier;
  });

  const stats = {
    total: clients.length,
    active: clients.filter((c: any) => c.is_active !== false).length,
    priority: clients.filter((c: any) => c.tier === "priority").length,
    industries: new Set(clients.map((c: any) => c.industry).filter(Boolean)).size,
  };

  const handleDelete = async (client: { id: string }) => {
    const ok = await confirm({
      title: "Delete client?",
      message: "This will permanently remove the client and all related records. This action cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(client.id);
    try {
      await deleteClient(client.id).unwrap();
      notify.success("Client deleted successfully");
    } catch {
      notify.error("Failed to delete client");
    } finally {
      setDeletingId(null);
    }
  };

  const tierBadge = (tier?: string) =>
    tier === "priority" ? (
      <Badge tone="brand" icon={<Star size={10} aria-hidden="true" />}>
        Priority
      </Badge>
    ) : (
      <Badge>Standard</Badge>
    );

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Companies you hire for, with contacts and engagement details"
        actions={
          canManage && (
            <Button icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>
              Add client
            </Button>
          )
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Total clients" value={stats.total} icon={<Building size={18} />} loading={isLoading} />
          <StatCard label="Active" value={stats.active} icon={<Users size={18} />} tone="success" loading={isLoading} />
          <StatCard label="Priority" value={stats.priority} icon={<Star size={18} />} tone="brand" loading={isLoading} />
          <StatCard label="Industries" value={stats.industries} icon={<Globe size={18} />} tone="neutral" loading={isLoading} />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search clients"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="zh-input pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <select
              aria-label="Filter by industry"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="zh-input sm:w-auto"
            >
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <select
              aria-label="Filter by tier"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="zh-input sm:w-auto"
            >
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Building size={22} aria-hidden="true" />}
              title={clients.length === 0 ? "No clients yet" : "No clients match your search"}
              description={
                clients.length === 0
                  ? "Add a client to start attaching jobs and contacts to it."
                  : "Try a different search term or clear the filters."
              }
              action={
                canManage && clients.length === 0 ? (
                  <Button icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>
                    Add your first client
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((client: any) => {
              const name = client.name || client.client_name || "—";
              const initial = name.charAt(0).toUpperCase();
              const active = client.is_active !== false;
              return (
                <div
                  key={client.id}
                  className="zh-card flex flex-col overflow-hidden transition hover:border-line-strong hover:shadow-md"
                >
                  {/* Card Header */}
                  <div className="flex items-start gap-3 border-b border-line p-4 sm:p-5">
                    <div
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-navy-600 text-lg font-semibold text-white"
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold leading-tight text-ink">{name}</h3>
                        {tierBadge(client.tier)}
                      </div>
                      {client.industry && (
                        <p className="mt-0.5 truncate text-xs text-muted">{client.industry}</p>
                      )}
                      {client.client_type && (
                        <Badge tone="navy" className="mt-1.5">
                          {client.client_type}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 space-y-2 px-4 py-4 sm:px-5">
                    {(client.primary_contact_name || client.contact_name) && (
                      <div className="flex items-center gap-2 text-sm text-ink-soft">
                        <Users size={13} className="shrink-0 text-muted" aria-hidden="true" />
                        <span className="truncate">{client.primary_contact_name || client.contact_name}</span>
                      </div>
                    )}
                    {client.primary_contact_email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail size={13} className="shrink-0 text-muted" aria-hidden="true" />
                        <a
                          href={`mailto:${client.primary_contact_email}`}
                          className="truncate text-navy-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {client.primary_contact_email}
                        </a>
                      </div>
                    )}
                    {client.primary_contact_phone && (
                      <div className="flex items-center gap-2 text-sm text-ink-soft">
                        <Phone size={13} className="shrink-0 text-muted" aria-hidden="true" />
                        <span>{client.primary_contact_phone}</span>
                      </div>
                    )}
                    {client.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe size={13} className="shrink-0 text-muted" aria-hidden="true" />
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-navy-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {client.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                    {!client.primary_contact_name && !client.contact_name && !client.primary_contact_email && !client.website && (
                      <p className="text-sm italic text-muted">No contact details added</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${active ? "bg-success-600" : "bg-line-strong"}`}
                      />
                      <span className="text-xs font-medium text-muted">{active ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => setDetailClient(client)}>
                        View
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${name}`}
                          className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                          loading={deletingId === client.id}
                          onClick={() => handleDelete(client)}
                        >
                          {deletingId === client.id ? null : <Trash2 size={14} aria-hidden="true" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <ClientInfoModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            refetch();
            notify.success("Client added successfully");
          }}
        />
      )}

      {/* Detail Modal */}
      {detailClient && (
        <ClientDetailModal
          client={detailClient}
          onClose={() => setDetailClient(null)}
        />
      )}
    </>
  );
}
