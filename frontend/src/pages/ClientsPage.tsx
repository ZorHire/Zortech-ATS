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
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Header from "../components/layout/Header";
import ClientInfoModal from "../components/clients/ClientInfoModal";
import ClientDetailModal from "../components/clients/ClientDetailModal";
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

  const { data: clients = [], isLoading, isError, refetch } = useGetClientsQuery();
  const [deleteClient, { isLoading: isDeleting }] = useDeleteClientMutation();

  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("All Industries");
  const [tierFilter, setTierFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [detailClient, setDetailClient] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id).unwrap();
      setConfirmDeleteId(null);
      showToast("Client deleted successfully");
    } catch {
      showToast("Failed to delete client", "error");
    }
  };

  const tierBadge = (tier?: string) => {
    if (tier === "priority") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold">
          <Star size={9} strokeWidth={2.5} />
          Priority
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full font-bold">
        Standard
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <Header title="Clients" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Clients", value: stats.total, icon: Building, color: "text-blue-600 bg-blue-50" },
            { label: "Active", value: stats.active, icon: Users, color: "text-emerald-600 bg-emerald-50" },
            { label: "Priority", value: stats.priority, icon: Star, color: "text-amber-600 bg-amber-50" },
            { label: "Industries", value: stats.industries, icon: Globe, color: "text-purple-600 bg-purple-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-2xl font-black text-[#111111]">{value}</p>
                <p className="text-xs text-gray-400 font-semibold">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#111111] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#333] transition-all shadow-sm flex-shrink-0"
            >
              <Plus size={16} />
              Add Client
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-gray-300" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <AlertTriangle size={32} />
            <p className="text-sm font-medium">Failed to load clients</p>
            <button
              onClick={() => refetch()}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <Building size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium">
              {clients.length === 0 ? "No clients yet" : "No clients match your search"}
            </p>
            {canManage && clients.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Add your first client
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((client: any) => {
              const name = client.name || client.client_name || "—";
              const initial = name.charAt(0).toUpperCase();
              return (
                <div
                  key={client.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-gray-50 flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black text-[#111111] leading-tight truncate">{name}</h3>
                        {tierBadge(client.tier)}
                      </div>
                      {client.industry && (
                        <p className="text-xs text-gray-400 mt-0.5 font-medium truncate">{client.industry}</p>
                      )}
                      {client.client_type && (
                        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold border border-blue-100">
                          {client.client_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="px-5 py-4 space-y-2">
                    {(client.primary_contact_name || client.contact_name) && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Users size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{client.primary_contact_name || client.contact_name}</span>
                      </div>
                    )}
                    {client.primary_contact_email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Mail size={12} className="text-gray-400 flex-shrink-0" />
                        <a
                          href={`mailto:${client.primary_contact_email}`}
                          className="text-blue-600 hover:underline truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {client.primary_contact_email}
                        </a>
                      </div>
                    )}
                    {client.primary_contact_phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone size={12} className="text-gray-400 flex-shrink-0" />
                        <span>{client.primary_contact_phone}</span>
                      </div>
                    )}
                    {client.website && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Globe size={12} className="text-gray-400 flex-shrink-0" />
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {client.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}
                    {!client.primary_contact_name && !client.contact_name && !client.primary_contact_email && !client.website && (
                      <p className="text-xs text-gray-300 italic">No contact details added</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${client.is_active !== false ? "bg-emerald-500" : "bg-gray-300"}`} />
                      <span className="text-[10px] text-gray-400 font-semibold">
                        {client.is_active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDetailClient(client)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Eye size={13} />
                        View
                      </button>
                      {canManage && (
                        <button
                          onClick={() => setConfirmDeleteId(client.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
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
            showToast("Client added successfully");
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

      {/* Delete Confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-5">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-base font-black text-[#111111] mb-2">Delete Client?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently remove the client and all related records. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 bg-gray-50 text-[#111111] font-bold text-sm rounded-xl border border-gray-100 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-all disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-5 py-3.5 rounded-2xl text-sm font-bold shadow-xl transition-all animate-in slide-in-from-bottom-4 ${
            toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-[#111111] text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
