import React from 'react';
import { Mail, Plus, Send, Loader2, X, Users, BarChart2, Clock } from 'lucide-react';
import api from '../lib/api';
import { EmailCampaign } from '../types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-amber-100 text-amber-700',
  sending: 'bg-blue-100 text-blue-700',
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-600',
};

const CAMPAIGN_TEMPLATES = [
  {
    label: 'Outreach',
    subject: 'Exciting opportunity — let us connect',
    body: 'Hi,\n\nWe came across your profile and believe you could be a great fit for an exciting opportunity we are working on.\n\nWe would love to connect and share more details at your convenience.\n\nBest regards,\nRecruitment Team',
  },
  {
    label: 'Interview Invite',
    subject: 'Interview Invitation — next steps',
    body: 'Hi,\n\nThank you for your interest. We would like to invite you for an interview.\n\nPlease share your availability and we will schedule a convenient time.\n\nBest regards,\nRecruitment Team',
  },
  {
    label: 'Offer Update',
    subject: 'Update on your application',
    body: 'Hi,\n\nWe are pleased to share an update regarding your recent application.\n\nWe will follow up shortly with the next steps. Please feel free to reach out if you have any questions.\n\nWarm regards,\nRecruitment Team',
  },
  {
    label: 'Follow-up',
    subject: 'Following up on your profile',
    body: 'Hi,\n\nI hope you are doing well! I wanted to follow up and check if you are still open to exploring new opportunities.\n\nPlease reply to this email or let us know a good time to connect.\n\nBest regards,\nRecruitment Team',
  },
];

interface CandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  current_title?: string;
}

// ─── Create Campaign Modal ────────────────────────────────────────────────────

function CreateCampaignModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (c: EmailCampaign) => void;
}) {
  const [name, setName] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [activeTemplate, setActiveTemplate] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const applyTemplate = (i: number) => {
    setSubject(CAMPAIGN_TEMPLATES[i].subject);
    setBody(CAMPAIGN_TEMPLATES[i].body);
    setActiveTemplate(i);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError('Campaign name, subject, and body are all required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const campaign = await api.post('/email-campaigns', {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        status: 'draft',
      });
      onCreate(campaign);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Mail size={18} className="text-blue-600" />
            </div>
            <h2 className="text-base font-black text-gray-900">New Campaign</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Templates */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick templates</p>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_TEMPLATES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => applyTemplate(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  activeTemplate === i
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. April Outreach 2026"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => { setSubject(e.target.value); setActiveTemplate(null); }}
              placeholder="Email subject line..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Message Body</label>
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setActiveTemplate(null); }}
              rows={9}
              placeholder="Write your message here..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none leading-relaxed"
            />
          </div>
          {error && <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-50 text-gray-700 font-bold text-sm rounded-xl border border-gray-200 hover:bg-gray-100 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : 'Save as Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Campaign Modal ──────────────────────────────────────────────────────

function SendCampaignModal({
  campaign,
  onClose,
  onSent,
}: {
  campaign: EmailCampaign;
  onClose: () => void;
  onSent: () => void;
}) {
  const [candidates, setCandidates] = React.useState<CandidateRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get('/candidates');
        const list: CandidateRow[] = Array.isArray(data) ? data : (data?.candidates ?? []);
        setCandidates(list);
      } catch {
        // silent — user can still proceed if they selected some
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = candidates.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email} ${c.current_title ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      setError('Select at least one recipient.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const recipients = candidates
        .filter(c => selected.has(c.id))
        .map(c => ({ email: c.email }));
      await api.post(`/email-campaigns/${campaign.id}/send`, { recipients });
      onSent();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">Select Recipients</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[300px]">Campaign: {campaign.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates by name or email..."
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Select all row */}
        <div className="px-6 py-2 flex items-center justify-between flex-shrink-0 border-b border-gray-50">
          <button onClick={toggleAll} className="text-xs text-blue-600 font-bold hover:underline">
            {selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-xs text-gray-400 font-medium">{selected.size} selected</span>
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-1 pt-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No candidates found</p>
          ) : (
            filtered.map(c => (
              <label
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                />
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {c.first_name[0]}{c.last_name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                </div>
              </label>
            ))
          )}
        </div>

        {error && <p className="px-6 pb-2 text-xs text-red-600 font-medium">{error}</p>}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-50 text-gray-700 font-bold text-sm rounded-xl border border-gray-200 hover:bg-gray-100 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="flex-[2] py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? <><Loader2 size={15} className="animate-spin" /> Sending...</>
              : <><Send size={15} /> Send to {selected.size} recipient{selected.size !== 1 ? 's' : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = React.useState<EmailCampaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');
  const [showCreate, setShowCreate] = React.useState(false);
  const [sendingCampaign, setSendingCampaign] = React.useState<EmailCampaign | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await api.get('/email-campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchCampaigns(); }, []);

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter);

  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    delivered: campaigns.reduce((sum, c) => sum + (c.delivered_count ?? 0), 0),
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Email Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Manage outreach, interview invites, and bulk candidate communications</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Mail, color: 'blue' },
          { label: 'Sent', value: stats.sent, icon: Send, color: 'emerald' },
          { label: 'Drafts', value: stats.draft, icon: Clock, color: 'amber' },
          { label: 'Delivered', value: stats.delivered, icon: Users, color: 'violet' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-50`}>
              <Icon size={18} className={`text-${color}-600`} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'draft', 'sent', 'failed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${
              filter === f
                ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-200 hover:text-blue-600'
            }`}
          >
            {f === 'all' ? 'All Campaigns' : f}
            {f !== 'all' && (
              <span className="ml-1.5 opacity-70">
                ({campaigns.filter(c => c.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail size={28} className="text-blue-400" />
          </div>
          <p className="text-gray-600 font-bold text-base">No campaigns yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first campaign to reach candidates at scale</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 inline-flex items-center gap-2 transition-all"
          >
            <Plus size={16} /> Create Campaign
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Campaign</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="text-right px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recipients</th>
                <th className="text-right px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Delivered</th>
                <th className="text-right px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(campaign => (
                <tr key={campaign.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{campaign.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">{campaign.subject}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-gray-700">{campaign.recipient_count ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {campaign.delivered_count != null ? (
                      <span className="text-sm font-semibold text-emerald-600">{campaign.delivered_count}</span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs text-gray-400">
                      {campaign.sent_at
                        ? new Date(campaign.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : new Date(campaign.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => setSendingCampaign(campaign)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 ml-auto"
                      >
                        <Send size={12} /> Send
                      </button>
                    )}
                    {campaign.status === 'sent' && (
                      <div className="flex items-center gap-1 justify-end">
                        <BarChart2 size={13} className="text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-bold">Sent</span>
                      </div>
                    )}
                    {campaign.status === 'failed' && (
                      <button
                        onClick={() => setSendingCampaign(campaign)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1.5 ml-auto"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreate={c => setCampaigns(prev => [c, ...prev])}
        />
      )}

      {sendingCampaign && (
        <SendCampaignModal
          campaign={sendingCampaign}
          onClose={() => setSendingCampaign(null)}
          onSent={() => { fetchCampaigns(); }}
        />
      )}
    </div>
  );
}
