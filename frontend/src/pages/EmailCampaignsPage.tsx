import { useState, useEffect, useRef } from 'react';
import {
  Mail, Send, Loader2, X, Users, BarChart2, Clock,
  Search, ChevronDown, Plus, AlertCircle, CheckCircle2,
  XCircle, Eye, MousePointer, Globe, Bold, Italic,
  Underline, List, Link, Image, Smile, Trash2,
} from 'lucide-react';
import api from '../lib/api';
import { EmailCampaign } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIABLES = [
  { label: 'First Name', value: '{{first_name}}' },
  { label: 'Last Name', value: '{{last_name}}' },
  { label: 'Full Name', value: '{{full_name}}' },
  { label: 'Skills', value: '{{skills}}' },
  { label: 'Recruiter Name', value: '{{recruiter_name}}' },
  { label: 'Company Name', value: '{{company_name}}' },
  { label: 'Job Title', value: '{{job_title}}' },
];

const DEFAULT_BODY = `Hi {{first_name}},

I hope this email finds you well.

We came across your profile and were impressed by your experience in {{skills}}.

We have some exciting opportunities that align with your background and I would love to connect and discuss how we can work together.

Best regards,
{{recruiter_name}}
{{company_name}}`;

const CAMPAIGN_TEMPLATES = [
  { label: 'Outreach', subject: 'We have exciting opportunities for you!', body: DEFAULT_BODY },
  {
    label: 'Interview Invite',
    subject: 'Interview Invitation — next steps',
    body: `Hi {{first_name}},\n\nThank you for your interest. We would like to invite you for an interview.\n\nPlease share your availability and we will schedule a convenient time.\n\nBest regards,\n{{recruiter_name}}\n{{company_name}}`,
  },
  {
    label: 'Offer Update',
    subject: 'Update on your application',
    body: `Hi {{first_name}},\n\nWe are pleased to share an update regarding your recent application.\n\nWe will follow up shortly with the next steps.\n\nWarm regards,\n{{recruiter_name}}\n{{company_name}}`,
  },
  {
    label: 'Follow-up',
    subject: 'Following up on your profile',
    body: `Hi {{first_name}},\n\nI hope you are doing well! I wanted to follow up and check if you are still open to exploring new opportunities.\n\nPlease reply to let us know a good time to connect.\n\nBest regards,\n{{recruiter_name}}\n{{company_name}}`,
  },
];

const TIMEZONES = [
  '(GMT+05:30) Asia/Kolkata',
  '(GMT+00:00) UTC',
  '(GMT-05:00) America/New_York',
  '(GMT-08:00) America/Los_Angeles',
  '(GMT+01:00) Europe/London',
  '(GMT+08:00) Asia/Singapore',
];

const STEPS = [
  { n: 1, title: 'Recipients', sub: 'Select candidates' },
  { n: 2, title: 'Email Content', sub: 'Compose email' },
  { n: 3, title: 'Settings', sub: 'Configure campaign' },
  { n: 4, title: 'Review & Send', sub: 'Confirm and send' },
];

const TIPS = [
  'Personalize emails for better response',
  'Use clear subject lines',
  'Test your email before sending',
  'Schedule for optimal times',
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-amber-100 text-amber-700',
  sending: 'bg-blue-100 text-blue-700',
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-600',
};

const PAGE_SIZE = 5;

interface CandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  current_title?: string;
  experience_years?: number;
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailCampaignsPage() {
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Wizard
  const [activeStep, setActiveStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');

  // Step 1 — Recipients
  const [recipientTab, setRecipientTab] = useState<'all' | 'saved' | 'manual'>('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [candidatePage, setCandidatePage] = useState(1);

  // Step 2 — Email Content
  const [subject, setSubject] = useState('We have exciting opportunities for you!');
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showVarMenu, setShowVarMenu] = useState<'subject' | 'body' | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Step 3 — Settings
  const [sendMode, setSendMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [timezone, setTimezone] = useState('(GMT+05:30) Asia/Kolkata');
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchCampaigns = async () => {
    setListLoading(true);
    try {
      const data = await api.get('/email-campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      setCampaigns([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  useEffect(() => {
    if (mode !== 'create') return;
    setCandidatesLoading(true);
    api.get('/candidates')
      .then((data) => {
        const list: CandidateRow[] = Array.isArray(data) ? data : (data?.candidates ?? []);
        setCandidates(list);
      })
      .catch(() => setCandidates([]))
      .finally(() => setCandidatesLoading(false));
  }, [mode]);

  // ─── Recipient helpers ──────────────────────────────────────────────────────

  const filteredCandidates = candidates.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email} ${c.current_title ?? ''}`
      .toLowerCase().includes(recipientSearch.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  const pageCandidates = filteredCandidates.slice(
    (candidatePage - 1) * PAGE_SIZE, candidatePage * PAGE_SIZE,
  );
  const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));

  const toggleCandidate = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ─── Variable insertion ─────────────────────────────────────────────────────

  const insertVariable = (v: string, target: 'subject' | 'body') => {
    if (target === 'subject') {
      setSubject(prev => prev + v);
    } else {
      const ta = bodyRef.current;
      if (ta) {
        const start = ta.selectionStart ?? emailBody.length;
        const end = ta.selectionEnd ?? emailBody.length;
        setEmailBody(prev => prev.slice(0, start) + v + prev.slice(end));
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + v.length;
          ta.focus();
        });
      } else {
        setEmailBody(prev => prev + v);
      }
    }
    setShowVarMenu(null);
  };

  // ─── Save / Send ────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!subject.trim() || !emailBody.trim()) {
      setSaveError('Subject and body are required.'); return;
    }
    setSaving(true); setSaveError('');
    try {
      const c = await api.post('/email-campaigns', {
        name: campaignName || `Campaign ${new Date().toLocaleDateString('en-IN')}`,
        subject: subject.trim(), body: emailBody.trim(), status: 'draft',
      });
      setCampaigns(prev => [c, ...prev]);
      resetWizard(); setMode('list');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSendCampaign = async () => {
    if (selectedIds.size === 0) { setSaveError('Select at least one recipient.'); return; }
    if (!subject.trim() || !emailBody.trim()) { setSaveError('Subject and body are required.'); return; }
    setSending(true); setSaveError('');
    try {
      const draft = await api.post('/email-campaigns', {
        name: campaignName || `Campaign ${new Date().toLocaleDateString('en-IN')}`,
        subject: subject.trim(), body: emailBody.trim(), status: 'draft',
      });
      await api.post(`/email-campaigns/${draft.id}/send`, {
        recipients: selectedCandidates.map(c => ({ email: c.email })),
      });
      await fetchCampaigns();
      resetWizard(); setMode('list');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  const resetWizard = () => {
    setActiveStep(1); setCampaignName(''); setRecipientSearch('');
    setSelectedIds(new Set()); setSubject('We have exciting opportunities for you!');
    setEmailBody(DEFAULT_BODY); setSelectedTemplate('');
    setSendMode('immediate'); setTrackOpens(true); setTrackClicks(true);
    setSaveError(''); setCandidatePage(1);
  };

  // ─── Preview ────────────────────────────────────────────────────────────────

  const firstSelected = selectedCandidates[0];
  const previewBody = emailBody
    .replace(/\{\{first_name\}\}/g, firstSelected?.first_name || 'John')
    .replace(/\{\{last_name\}\}/g, firstSelected?.last_name || 'Doe')
    .replace(/\{\{full_name\}\}/g, firstSelected ? `${firstSelected.first_name} ${firstSelected.last_name}` : 'John Doe')
    .replace(/\{\{skills\}\}/g, 'JavaScript, React, Node.js')
    .replace(/\{\{recruiter_name\}\}/g, 'John Smith')
    .replace(/\{\{company_name\}\}/g, 'TechCorp Solutions')
    .replace(/\{\{job_title\}\}/g, 'Senior Developer');

  const wordCount = emailBody.trim() ? emailBody.trim().split(/\s+/).length : 0;

  // ─── Delete campaign ────────────────────────────────────────────────────────

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!window.confirm(`Delete campaign "${name}"?\n\nThis cannot be undone.`)) return;
    try {
      await api.delete(`/email-campaigns/${id}`);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete campaign');
    }
  };

  // ─── List stats ─────────────────────────────────────────────────────────────

  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    scheduled: campaigns.filter(c => c.status === 'scheduled').length,
    delivered: campaigns.reduce((s, c) => s + (c.delivered_count ?? 0), 0),
    failed: campaigns.filter(c => c.status === 'failed').length,
  };

  const filteredCampaigns = filter === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === filter);

  // ─── CREATE MODE ─────────────────────────────────────────────────────────────

  if (mode === 'create') {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-white" onClick={() => setShowVarMenu(null)}>

        {/* ── Top header ── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h1 className="text-lg font-black text-gray-900">Email Campaigns</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">Create and send targeted email campaigns to candidates</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save as Draft
            </button>
            <button
              onClick={handleSendCampaign}
              disabled={sending || selectedIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-blue-100"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Review & Send
            </button>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
          {[
            { icon: Mail,       label: 'Total Recipients', value: candidates.length, ic: 'text-blue-500',   bg: 'bg-blue-50' },
            { icon: Send,       label: 'Sent',             value: stats.sent,        ic: 'text-emerald-500',bg: 'bg-emerald-50' },
            { icon: Clock,      label: 'Scheduled',        value: stats.scheduled,   ic: 'text-amber-500',  bg: 'bg-amber-50' },
            { icon: Users,      label: 'Delivered',        value: stats.delivered,   ic: 'text-violet-500', bg: 'bg-violet-50' },
            { icon: XCircle,    label: 'Failed',           value: stats.failed,      ic: 'text-red-400',    bg: 'bg-red-50' },
          ].map(({ icon: Icon, label, value, ic, bg }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={ic} />
              </div>
              <div>
                <p className="text-lg font-black text-gray-900 leading-none">{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── 3-column body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — Steps */}
          <div className="w-52 border-r border-gray-100 flex flex-col p-4 flex-shrink-0 overflow-y-auto">
            <div className="space-y-1 mb-5">
              {STEPS.map(step => (
                <button
                  key={step.n}
                  onClick={() => setActiveStep(step.n)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                    activeStep === step.n
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    activeStep === step.n ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {step.n}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold leading-tight ${activeStep === step.n ? 'text-white' : 'text-gray-800'}`}>
                      {step.title}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${activeStep === step.n ? 'text-blue-100' : 'text-gray-400'}`}>
                      {step.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Tips */}
            <div className="mt-auto bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">💡</span>
                <p className="text-xs font-bold text-amber-800">Tips</p>
              </div>
              <ul className="space-y-1.5">
                {TIPS.map(tip => (
                  <li key={tip} className="text-[10px] text-amber-700 flex items-start gap-1.5">
                    <span className="text-amber-400 flex-shrink-0 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* MIDDLE — Recipients */}
          <div className="w-[340px] border-r border-gray-100 flex flex-col flex-shrink-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-gray-900">Select Recipients</h3>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-blue-600 font-semibold hover:underline">
                  Clear All
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {(['all', 'saved', 'manual'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRecipientTab(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-bold transition-colors ${
                    recipientTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab === 'all' ? 'All Candidates' : tab === 'saved' ? 'Saved Filters' : 'Manual Select'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 border-b border-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Search size={13} className="text-gray-400 flex-shrink-0" />
                <input
                  value={recipientSearch}
                  onChange={e => { setRecipientSearch(e.target.value); setCandidatePage(1); }}
                  placeholder="Search candidates by name, email, skills..."
                  className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Selected chips */}
              {selectedCandidates.length > 0 && (
                <div className="px-3 pt-3 pb-2 border-b border-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Selected Candidates ({selectedCandidates.length})
                    </p>
                    <button onClick={() => setSelectedIds(new Set())}
                      className="text-[10px] text-blue-600 font-semibold hover:underline">
                      Clear
                    </button>
                  </div>
                  <div className="space-y-1">
                    {selectedCandidates.map(c => (
                      <div key={c.id} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2">
                        <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-[8px] font-bold text-blue-700">{c.first_name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{c.first_name} {c.last_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{c.email}</p>
                        </div>
                        <button onClick={() => toggleCandidate(c.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate list */}
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">All Candidates</p>
                  <button
                    onClick={() => {
                      const allIds = new Set(filteredCandidates.map(c => c.id));
                      setSelectedIds(selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0
                        ? new Set() : allIds);
                    }}
                    className="text-[10px] text-blue-600 font-semibold hover:underline"
                  >
                    {selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0
                      ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {candidatesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={18} className="animate-spin text-blue-500" />
                  </div>
                ) : pageCandidates.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-10">No candidates found</p>
                ) : (
                  <div className="space-y-0.5">
                    {pageCandidates.map(c => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2.5 px-2 py-2.5 rounded-lg cursor-pointer transition-colors ${
                          selectedIds.has(c.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleCandidate(c.id)}
                          className="w-3.5 h-3.5 rounded text-blue-600 border-gray-300"
                        />
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {c.first_name[0]}{c.last_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{c.first_name} {c.last_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{c.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {c.current_title && (
                            <p className="text-[10px] text-gray-500 font-medium truncate max-w-[80px]">{c.current_title}</p>
                          )}
                          {c.experience_years != null && (
                            <p className="text-[10px] text-gray-400">· {c.experience_years}+ yrs</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pagination */}
            {filteredCandidates.length > PAGE_SIZE && (
              <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
                <p className="text-[10px] text-gray-400">
                  Showing {Math.min(PAGE_SIZE, filteredCandidates.length - (candidatePage - 1) * PAGE_SIZE)} of {filteredCandidates.length} candidates
                </p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setCandidatePage(p)}
                      className={`w-6 h-6 text-[11px] rounded font-bold transition-colors ${
                        candidatePage === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  {totalPages > 3 && <span className="text-[11px] text-gray-400">... {totalPages}</span>}
                  {candidatePage < totalPages && (
                    <button onClick={() => setCandidatePage(p => p + 1)}
                      className="w-6 h-6 text-gray-400 hover:text-gray-700 font-bold">›</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Email Content + Settings + Footer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Email Content</h3>

              {/* Subject line */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">
                  Subject Line <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Enter subject line..."
                      className="flex-1 text-sm outline-none text-gray-800"
                    />
                    <button type="button" className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                      <Smile size={15} />
                    </button>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setShowVarMenu(v => v === 'subject' ? null : 'subject'); }}
                      className="h-full px-3 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1 whitespace-nowrap"
                    >
                      Insert Variable <ChevronDown size={11} />
                    </button>
                    {showVarMenu === 'subject' && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 w-48 py-1">
                        {VARIABLES.map(v => (
                          <button key={v.value} onClick={() => insertVariable(v.value, 'subject')}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                            {v.label}
                            <span className="text-gray-400 ml-1 text-[10px]">{v.value}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Template selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Email Template</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedTemplate}
                    onChange={e => {
                      const t = CAMPAIGN_TEMPLATES.find(t => t.label === e.target.value);
                      if (t) { setSubject(t.subject); setEmailBody(t.body); }
                      setSelectedTemplate(e.target.value);
                    }}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select Template</option>
                    {CAMPAIGN_TEMPLATES.map(t => (
                      <option key={t.label} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                  <button className="text-xs text-blue-600 font-semibold hover:underline whitespace-nowrap">
                    Create New Template
                  </button>
                </div>
              </div>

              {/* Body editor */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">
                  Email Body <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/60 flex-wrap" onClick={e => e.stopPropagation()}>
                    <select className="text-xs bg-transparent text-gray-600 focus:outline-none cursor-pointer border-0 pr-1 mr-1">
                      <option>Normal</option>
                      <option>Heading 1</option>
                      <option>Heading 2</option>
                    </select>
                    <div className="w-px h-4 bg-gray-200 mx-0.5" />
                    {[Bold, Italic, Underline].map((Icon, i) => (
                      <button key={i} type="button"
                        className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors">
                        <Icon size={13} />
                      </button>
                    ))}
                    <div className="w-px h-4 bg-gray-200 mx-0.5" />
                    <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"><List size={13} /></button>
                    <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"><Link size={13} /></button>
                    <button type="button" className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"><Image size={13} /></button>
                    <div className="ml-auto relative">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setShowVarMenu(v => v === 'body' ? null : 'body'); }}
                        className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-100 flex items-center gap-1"
                      >
                        Insert Variable <ChevronDown size={10} />
                      </button>
                      {showVarMenu === 'body' && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 w-48 py-1">
                          {VARIABLES.map(v => (
                            <button key={v.value} onClick={() => insertVariable(v.value, 'body')}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                              {v.label}
                              <span className="text-gray-400 ml-1 text-[10px]">{v.value}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea
                    ref={bodyRef}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none leading-relaxed"
                    placeholder="Write your email body..."
                  />
                  <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-medium">P</span>
                    <span className="text-[10px] text-gray-400">Words: {wordCount}</span>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700">Preview</h4>
                  <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                    <Send size={11} /> Send Test Email
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/20">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Subject: {subject.replace(/\{\{first_name\}\}/g, firstSelected?.first_name || 'John')}</p>
                  {previewBody.split('\n').map((line, i) => (
                    <p key={i} className="text-xs text-gray-600 leading-relaxed min-h-[1em]">{line || ' '}</p>
                  ))}
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  {saveError}
                </div>
              )}
            </div>

            {/* ── Campaign Settings ── */}
            <div className="border-t border-gray-100 px-5 py-3.5 flex-shrink-0 bg-gray-50/30">
              <h4 className="text-xs font-bold text-gray-700 mb-3">Campaign Settings</h4>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                {/* Send mode */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="sendMode" value="immediate"
                    checked={sendMode === 'immediate'} onChange={() => setSendMode('immediate')}
                    className="w-3.5 h-3.5 text-blue-600 accent-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Send Immediately</p>
                    <p className="text-[10px] text-gray-400">Send emails right away</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="sendMode" value="scheduled"
                    checked={sendMode === 'scheduled'} onChange={() => setSendMode('scheduled')}
                    className="w-3.5 h-3.5 text-blue-600 accent-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Schedule for Later</p>
                    <p className="text-[10px] text-gray-400">Choose date and time</p>
                  </div>
                </label>
                {/* Timezone */}
                <div className="flex items-center gap-1.5">
                  <Globe size={13} className="text-gray-400 flex-shrink-0" />
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
                  </select>
                </div>
                {/* Track toggles */}
                <div className="flex items-center gap-4 ml-auto">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle on={trackOpens} onChange={() => setTrackOpens(v => !v)} />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Track Opens</p>
                      <p className="text-[10px] text-gray-400">Track email opens</p>
                    </div>
                  </label>
                  <span className="text-gray-200 text-sm font-light">+</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle on={trackClicks} onChange={() => setTrackClicks(v => !v)} />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Track Clicks</p>
                      <p className="text-[10px] text-gray-400">Track link clicks</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Footer summary bar ── */}
            <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-white">
              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                <span className="font-bold text-gray-800">Campaign Summary</span>
                <span className="flex items-center gap-1">
                  <Users size={12} className="text-gray-400" /> {selectedIds.size} Recipients
                </span>
                {selectedIds.size > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 size={12} /> Personalized
                  </span>
                )}
                {trackOpens && (
                  <span className="flex items-center gap-1">
                    <Eye size={12} className="text-gray-400" /> Track Opens
                  </span>
                )}
                {trackClicks && (
                  <span className="flex items-center gap-1">
                    <MousePointer size={12} className="text-gray-400" /> Track Clicks
                  </span>
                )}
              </div>
              <button
                onClick={handleSendCampaign}
                disabled={sending || selectedIds.size === 0 || !subject.trim() || !emailBody.trim()}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100 flex-shrink-0"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Review & Send Campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST MODE ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900">Email Campaigns</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage outreach, interview invites, and bulk candidate communications</p>
        </div>
        <button
          onClick={() => { resetWizard(); setMode('create'); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Mail,    label: 'Total',     value: stats.total,     color: 'text-blue-600',   bg: 'bg-blue-50' },
            { icon: Send,    label: 'Sent',      value: stats.sent,      color: 'text-emerald-600',bg: 'bg-emerald-50' },
            { icon: Clock,   label: 'Scheduled', value: stats.scheduled, color: 'text-amber-600',  bg: 'bg-amber-50' },
            { icon: Users,   label: 'Delivered', value: stats.delivered, color: 'text-violet-600', bg: 'bg-violet-50' },
            { icon: XCircle, label: 'Failed',    value: stats.failed,    color: 'text-red-500',    bg: 'bg-red-50' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'draft', 'sent', 'scheduled', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              {f === 'all' ? 'All Campaigns' : f}
              {f !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({campaigns.filter(c => c.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Campaign list */}
        {listLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail size={28} className="text-blue-400" />
            </div>
            <p className="text-gray-600 font-bold text-base">No campaigns yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first campaign to reach candidates at scale</p>
            <button
              onClick={() => { resetWizard(); setMode('create'); }}
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
                {filteredCampaigns.map(campaign => (
                  <tr key={campaign.id} className="hover:bg-gray-50/50 transition-colors">
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
                      {campaign.delivered_count != null
                        ? <span className="text-sm font-semibold text-emerald-600">{campaign.delivered_count}</span>
                        : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs text-gray-400">
                        {new Date(campaign.sent_at || campaign.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {campaign.status === 'draft' && (
                          <button
                            onClick={() => { resetWizard(); setMode('create'); }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5"
                          >
                            <Send size={12} /> Send
                          </button>
                        )}
                        {campaign.status === 'sent' && (
                          <div className="flex items-center gap-1">
                            <BarChart2 size={13} className="text-emerald-500" />
                            <span className="text-xs text-emerald-600 font-bold">Sent</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete campaign"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
