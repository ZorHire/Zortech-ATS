import { useId, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Mail, Send, X, Users, BarChart2, Clock,
  Search, Plus, AlertCircle, CheckCircle2,
  XCircle, Eye, MousePointer, Globe, Trash2, Lightbulb,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { EmailCampaign } from '../types';
import {
  useGetCampaignsQuery, useCreateCampaignMutation,
  useSendCampaignMutation, useDeleteCampaignMutation,
} from '../store/api/emailApi';
import { useGetCandidatesQuery } from '../store/api/candidateApi';
import {
  Badge, Button, DataTable, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, useConfirm,
} from '../components/ui';
import type { BadgeTone, Column } from '../components/ui';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage } from '../lib/format';

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

const DEFAULT_SUBJECT = 'We have exciting opportunities for you!';

const CAMPAIGN_TEMPLATES = [
  { label: 'Outreach', subject: DEFAULT_SUBJECT, body: DEFAULT_BODY },
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
  { n: 1, title: 'Recipients', sub: 'Select candidates', anchor: 'recipients' },
  { n: 2, title: 'Email content', sub: 'Compose email', anchor: 'content' },
  { n: 3, title: 'Settings', sub: 'Configure campaign', anchor: 'settings' },
  { n: 4, title: 'Review & send', sub: 'Confirm and send', anchor: 'review' },
];

const TIPS = [
  'Personalize emails for better response',
  'Use clear subject lines',
  'Test your email before sending',
  'Schedule for optimal times',
];

/** Campaign status → badge tone (one mapping for the page). */
const STATUS_TONES: Record<string, BadgeTone> = {
  draft: 'neutral',
  scheduled: 'warning',
  sending: 'info',
  sent: 'success',
  failed: 'danger',
};
const statusLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const FILTERS = ['all', 'draft', 'sent', 'scheduled', 'failed'] as const;

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

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="flex items-center gap-2.5 rounded-lg text-left"
    >
      <span className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-navy-600' : 'bg-line-strong'}`}>
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailCampaignsPage() {
  const notify = useNotify();
  const confirm = useConfirm();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;

  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [filter, setFilter] = useState<string>('all');

  // Wizard
  const [activeStep, setActiveStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');

  // Step 1 — Recipients
  const [recipientTab, setRecipientTab] = useState<'all' | 'saved' | 'manual'>('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [candidatePage, setCandidatePage] = useState(1);

  // Step 2 — Email Content
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Step 3 — Settings
  const [sendMode, setSendMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [timezone, setTimezone] = useState('(GMT+05:30) Asia/Kolkata');
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  // ─── RTK Query ──────────────────────────────────────────────────────────────

  const {
    data: campaigns = [], isLoading: listLoading, isError: listIsError, error: listError, refetch: refetchList,
  } = useGetCampaignsQuery();
  const {
    data: candidateData = [], isFetching: candidatesLoading, isError: candidatesIsError,
    error: candidatesError, refetch: refetchCandidates,
  } = useGetCandidatesQuery(undefined, { skip: mode !== 'create' });
  const candidates = candidateData as unknown as CandidateRow[];

  const [createCampaign, { isLoading: saving }] = useCreateCampaignMutation();
  const [sendCampaign] = useSendCampaignMutation();
  const [deleteCampaign] = useDeleteCampaignMutation();

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
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // ─── Variable insertion ─────────────────────────────────────────────────────

  const insertVariable = (v: string, target: 'subject' | 'body') => {
    if (!v) return;
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
  };

  // ─── Save / Send ────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!subject.trim() || !emailBody.trim()) {
      setShowFieldErrors(true);
      setSaveError('Subject and body are required.'); return;
    }
    setSaveError('');
    try {
      await createCampaign({
        name: campaignName || `Campaign ${new Date().toLocaleDateString('en-IN')}`,
        subject: subject.trim(), body: emailBody.trim(), status: 'draft',
      }).unwrap();
      resetWizard(); setMode('list');
      notify.success('Draft saved');
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save draft'));
    }
  };

  const handleSendCampaign = async () => {
    if (selectedIds.size === 0) { setSaveError('Select at least one recipient.'); return; }
    if (!subject.trim() || !emailBody.trim()) {
      setShowFieldErrors(true);
      setSaveError('Subject and body are required.'); return;
    }
    setSending(true); setSaveError('');
    try {
      const draft = await createCampaign({
        name: campaignName || `Campaign ${new Date().toLocaleDateString('en-IN')}`,
        subject: subject.trim(), body: emailBody.trim(), status: 'draft',
      }).unwrap();
      await sendCampaign({
        id: draft.id,
        recipients: selectedCandidates.map(c => ({ email: c.email, name: `${c.first_name} ${c.last_name}`.trim() })),
        track_opens: trackOpens,
        track_clicks: trackClicks,
      }).unwrap();
      resetWizard(); setMode('list');
      notify.success('Campaign sent');
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to send campaign'));
    } finally {
      setSending(false);
    }
  };

  const resetWizard = () => {
    setActiveStep(1); setCampaignName(''); setRecipientSearch('');
    setSelectedIds(new Set()); setSubject(DEFAULT_SUBJECT);
    setEmailBody(DEFAULT_BODY); setSelectedTemplate('');
    setSendMode('immediate'); setTrackOpens(true); setTrackClicks(true);
    setSaveError(''); setShowFieldErrors(false); setCandidatePage(1);
  };

  const isDirty =
    selectedIds.size > 0 || !!campaignName || subject !== DEFAULT_SUBJECT || emailBody !== DEFAULT_BODY;

  const handleCancelCreate = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: 'Discard this campaign?',
        message: 'Your recipients and email content will be lost. Save it as a draft to keep it.',
        confirmText: 'Discard',
        danger: true,
      });
      if (!ok) return;
    }
    resetWizard();
    setMode('list');
  };

  const goToStep = (n: number, anchor: string) => {
    setActiveStep(n);
    document.getElementById(fid(anchor))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const ok = await confirm({
      title: `Delete campaign "${name}"?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete campaign',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCampaign(id).unwrap();
      notify.success('Campaign deleted');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Failed to delete campaign'));
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

  const startCreate = () => { resetWizard(); setMode('create'); };

  // ─── CREATE MODE ─────────────────────────────────────────────────────────────

  if (mode === 'create') {
    const subjectError = showFieldErrors && !subject.trim() ? 'Enter a subject line.' : '';
    const bodyError = showFieldErrors && !emailBody.trim() ? 'Write the email body.' : '';
    const allFilteredSelected = selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0;

    return (
      <>
        <PageHeader
          breadcrumbs={[{ label: 'Campaigns' }, { label: 'New campaign' }]}
          title="New campaign"
          subtitle="Create and send targeted email campaigns to candidates"
          actions={
            <>
              <Button variant="ghost" onClick={handleCancelCreate} disabled={saving || sending}>Cancel</Button>
              <Button variant="secondary" onClick={handleSaveDraft} loading={saving && !sending} disabled={sending}>
                Save as draft
              </Button>
              <Button icon={<Send size={16} />} onClick={handleSendCampaign} loading={sending} disabled={selectedIds.size === 0}>
                Review & send
              </Button>
            </>
          }
        />

        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Steps */}
          <nav aria-label="Campaign steps">
            <ol className="flex gap-2 overflow-x-auto pb-1">
              {STEPS.map(step => {
                const active = activeStep === step.n;
                return (
                  <li key={step.n} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => goToStep(step.n, step.anchor)}
                      aria-current={active ? 'step' : undefined}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        active ? 'border-navy-600 bg-navy-50' : 'border-line bg-white hover:border-line-strong'
                      }`}
                    >
                      <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        active ? 'bg-navy-600 text-white' : 'bg-surface-sunken text-muted'
                      }`}>{step.n}</span>
                      <span>
                        <span className="block text-sm font-medium text-ink">{step.title}</span>
                        <span className="hidden text-xs text-muted sm:block">{step.sub}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            {/* Recipients */}
            <section id={fid('recipients')} aria-labelledby={fid('recipients-h')} className="zh-card flex min-w-0 scroll-mt-4 flex-col overflow-hidden lg:self-start">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 id={fid('recipients-h')} className="text-sm font-semibold text-ink">Select recipients</h2>
                {selectedIds.size > 0 && (
                  <Button variant="link" size="sm" className="text-xs" onClick={() => setSelectedIds(new Set())}>Clear all</Button>
                )}
              </div>

              <div role="tablist" aria-label="Recipient source" className="flex border-b border-line">
                {(['all', 'saved', 'manual'] as const).map(tab => (
                  <button key={tab} type="button" role="tab" aria-selected={recipientTab === tab} onClick={() => setRecipientTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                      recipientTab === tab ? 'border-b-2 border-navy-600 text-navy-700' : 'text-muted hover:text-ink'
                    }`}>
                    {tab === 'all' ? 'All candidates' : tab === 'saved' ? 'Saved filters' : 'Manual select'}
                  </button>
                ))}
              </div>

              <div className="border-b border-line px-3 py-2.5">
                <label htmlFor={fid('recipient-search')} className="sr-only">Search candidates</label>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input id={fid('recipient-search')} type="search" value={recipientSearch}
                    onChange={e => { setRecipientSearch(e.target.value); setCandidatePage(1); }}
                    placeholder="Search by name, email, title…"
                    className="zh-input py-2 pl-9" />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-[60vh]">
                {selectedCandidates.length > 0 && (
                  <div className="border-b border-line px-3 pb-2 pt-3">
                    <p className="mb-2 text-xs font-medium text-muted">Selected ({selectedCandidates.length})</p>
                    <ul className="space-y-1">
                      {selectedCandidates.map(c => (
                        <li key={c.id} className="flex items-center gap-2 rounded-lg border border-navy-100 bg-navy-50 px-2.5 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-ink">{c.first_name} {c.last_name}</p>
                            <p className="truncate text-xs text-muted">{c.email}</p>
                          </div>
                          <button type="button" onClick={() => toggleCandidate(c.id)}
                            aria-label={`Remove ${c.first_name} ${c.last_name}`}
                            className="flex-shrink-0 rounded p-1 text-muted hover:text-danger-600">
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="px-3 py-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted">All candidates</p>
                    <Button variant="link" size="sm" className="text-xs"
                      disabled={filteredCandidates.length === 0}
                      onClick={() => {
                        const allIds = new Set(filteredCandidates.map(c => c.id));
                        setSelectedIds(allFilteredSelected ? new Set() : allIds);
                      }}>
                      {allFilteredSelected ? 'Deselect all' : 'Select all'}
                    </Button>
                  </div>

                  {candidatesLoading ? (
                    <div className="space-y-2 py-2" role="status" aria-label="Loading candidates">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : candidatesIsError ? (
                    <ErrorState compact error={candidatesError} onRetry={refetchCandidates} title="Couldn't load candidates" />
                  ) : pageCandidates.length === 0 ? (
                    <EmptyState compact icon={<Users size={20} aria-hidden="true" />}
                      title={candidates.length === 0 ? 'No candidates yet' : 'No candidates match'}
                      description={candidates.length === 0 ? 'Add candidates before sending a campaign.' : 'Try a different search.'}
                      action={recipientSearch ? (
                        <Button variant="secondary" size="sm" onClick={() => { setRecipientSearch(''); setCandidatePage(1); }}>Clear search</Button>
                      ) : undefined}
                    />
                  ) : (
                    <ul className="space-y-0.5">
                      {pageCandidates.map(c => (
                        <li key={c.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2.5 transition-colors ${
                              selectedIds.has(c.id) ? 'bg-navy-50' : 'hover:bg-surface'
                            }`}>
                            <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleCandidate(c.id)}
                              className="h-4 w-4 rounded border-line-strong accent-navy-600" />
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700" aria-hidden="true">
                              {c.first_name?.[0]}{c.last_name?.[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-ink">{c.first_name} {c.last_name}</p>
                              <p className="truncate text-xs text-muted">{c.email}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {c.current_title && <p className="max-w-[80px] truncate text-xs text-ink-soft">{c.current_title}</p>}
                              {c.experience_years != null && <p className="text-xs text-muted">{c.experience_years}+ yrs</p>}
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {filteredCandidates.length > PAGE_SIZE && (
                <nav aria-label="Candidate pages" className="flex items-center justify-between border-t border-line bg-surface px-3 py-2">
                  <p className="text-xs text-muted">
                    Page {candidatePage} of {totalPages} · {filteredCandidates.length} candidates
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Previous page" disabled={candidatePage === 1}
                      onClick={() => setCandidatePage(p => Math.max(1, p - 1))}
                      className="rounded p-1.5 text-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30">
                      <ChevronLeft size={14} />
                    </button>
                    <button type="button" aria-label="Next page" disabled={candidatePage >= totalPages}
                      onClick={() => setCandidatePage(p => Math.min(totalPages, p + 1))}
                      className="rounded p-1.5 text-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-30">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </nav>
              )}
            </section>

            <div className="min-w-0 space-y-6">
              {/* Content */}
              <section id={fid('content')} aria-labelledby={fid('content-h')} className="zh-card scroll-mt-4 space-y-4 p-4 sm:p-5">
                <h2 id={fid('content-h')} className="text-sm font-semibold text-ink">Email content</h2>

                <div>
                  <label htmlFor={fid('name')} className="zh-label">Campaign name <span className="font-normal text-muted">(optional)</span></label>
                  <input id={fid('name')} value={campaignName} onChange={e => setCampaignName(e.target.value)}
                    placeholder={`Campaign ${new Date().toLocaleDateString('en-IN')}`}
                    autoComplete="off" className="zh-input" />
                </div>

                <div>
                  <label htmlFor={fid('subject')} className="zh-label">Subject line <span className="text-danger-600" aria-hidden="true">*</span></label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input id={fid('subject')} value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="Enter subject line…" required autoComplete="off"
                      aria-invalid={!!subjectError || undefined}
                      aria-describedby={subjectError ? fid('subject-err') : undefined}
                      className="zh-input flex-1" />
                    <select aria-label="Insert variable into subject" value=""
                      onChange={e => insertVariable(e.target.value, 'subject')}
                      className="zh-input sm:w-44">
                      <option value="">Insert variable…</option>
                      {VARIABLES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                  {subjectError && <p id={fid('subject-err')} className="mt-1 text-xs text-danger-600">{subjectError}</p>}
                </div>

                <div>
                  <label htmlFor={fid('template')} className="zh-label">Email template</label>
                  <select id={fid('template')} value={selectedTemplate}
                    onChange={e => {
                      const t = CAMPAIGN_TEMPLATES.find(t => t.label === e.target.value);
                      if (t) { setSubject(t.subject); setEmailBody(t.body); }
                      setSelectedTemplate(e.target.value);
                    }}
                    className="zh-input">
                    <option value="">Select template</option>
                    {CAMPAIGN_TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                    <label htmlFor={fid('body')} className="zh-label mb-0">Email body <span className="text-danger-600" aria-hidden="true">*</span></label>
                    <select aria-label="Insert variable into body" value=""
                      onChange={e => insertVariable(e.target.value, 'body')}
                      className="h-8 rounded-md border border-line bg-white px-2 text-xs text-ink-soft">
                      <option value="">Insert variable…</option>
                      {VARIABLES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </div>
                  <textarea id={fid('body')} ref={bodyRef} value={emailBody} onChange={e => setEmailBody(e.target.value)}
                    rows={10} required
                    aria-invalid={!!bodyError || undefined}
                    aria-describedby={`${fid('body-count')}${bodyError ? ` ${fid('body-err')}` : ''}`}
                    className="zh-input resize-y leading-relaxed"
                    placeholder="Write your email body…" />
                  <div className="mt-1 flex items-center justify-between">
                    {bodyError ? <p id={fid('body-err')} className="text-xs text-danger-600">{bodyError}</p> : <span />}
                    <span id={fid('body-count')} className="text-xs text-muted">Words: {wordCount}</span>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">Preview</h3>
                  <div className="rounded-lg border border-line bg-surface p-4">
                    <p className="mb-2 break-words text-xs font-medium text-ink-soft">
                      Subject: {subject.replace(/\{\{first_name\}\}/g, firstSelected?.first_name || 'John')}
                    </p>
                    {previewBody.split('\n').map((line, i) => (
                      <p key={i} className="min-h-[1em] break-words text-sm leading-relaxed text-ink-soft">{line || ' '}</p>
                    ))}
                  </div>
                </div>
              </section>

              {/* Settings */}
              <section id={fid('settings')} aria-labelledby={fid('settings-h')} className="zh-card scroll-mt-4 p-4 sm:p-5">
                <h2 id={fid('settings-h')} className="mb-4 text-sm font-semibold text-ink">Campaign settings</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <fieldset className="space-y-2">
                    <legend className="zh-label">When to send</legend>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="radio" name={fid('sendMode')} value="immediate" checked={sendMode === 'immediate'}
                        onChange={() => setSendMode('immediate')} className="mt-0.5 h-4 w-4 accent-navy-600" />
                      <span><span className="block text-sm font-medium text-ink">Send immediately</span><span className="block text-xs text-muted">Send emails right away</span></span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input type="radio" name={fid('sendMode')} value="scheduled" checked={sendMode === 'scheduled'}
                        onChange={() => setSendMode('scheduled')} className="mt-0.5 h-4 w-4 accent-navy-600" />
                      <span><span className="block text-sm font-medium text-ink">Schedule for later</span><span className="block text-xs text-muted">Choose date and time</span></span>
                    </label>
                  </fieldset>
                  <div>
                    <label htmlFor={fid('tz')} className="zh-label flex items-center gap-1.5">
                      <Globe size={14} className="text-muted" aria-hidden="true" /> Time zone
                    </label>
                    <select id={fid('tz')} value={timezone} onChange={e => setTimezone(e.target.value)} className="zh-input">
                      {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <Toggle on={trackOpens} onChange={() => setTrackOpens(v => !v)} label="Track opens" hint="Track email opens" />
                  <Toggle on={trackClicks} onChange={() => setTrackClicks(v => !v)} label="Track clicks" hint="Track link clicks" />
                </div>
              </section>

              {/* Review */}
              <section id={fid('review')} aria-labelledby={fid('review-h')} className="zh-card scroll-mt-4 space-y-4 p-4 sm:p-5">
                <h2 id={fid('review-h')} className="text-sm font-semibold text-ink">Campaign summary</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={selectedIds.size > 0 ? 'navy' : 'neutral'} icon={<Users size={12} aria-hidden="true" />}>
                    {selectedIds.size} recipient{selectedIds.size === 1 ? '' : 's'}
                  </Badge>
                  {selectedIds.size > 0 && <Badge tone="success" icon={<CheckCircle2 size={12} aria-hidden="true" />}>Personalized</Badge>}
                  {trackOpens && <Badge icon={<Eye size={12} aria-hidden="true" />}>Track opens</Badge>}
                  {trackClicks && <Badge icon={<MousePointer size={12} aria-hidden="true" />}>Track clicks</Badge>}
                </div>

                {saveError && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-700">
                    <AlertCircle size={16} className="flex-shrink-0" aria-hidden="true" />
                    {saveError}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={handleSaveDraft} loading={saving && !sending} disabled={sending}>
                    Save as draft
                  </Button>
                  <Button icon={<Send size={16} />} onClick={handleSendCampaign} loading={sending}
                    disabled={selectedIds.size === 0 || !subject.trim() || !emailBody.trim()}>
                    Review & send campaign
                  </Button>
                </div>
                {selectedIds.size === 0 && (
                  <p className="text-xs text-muted sm:text-right">Select at least one recipient to send.</p>
                )}
              </section>

              <aside className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-900">
                  <Lightbulb size={15} aria-hidden="true" /> Tips
                </p>
                <ul className="space-y-1.5">
                  {TIPS.map(tip => (
                    <li key={tip} className="flex items-start gap-1.5 text-xs text-brand-900">
                      <span aria-hidden="true" className="mt-0.5 flex-shrink-0">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── LIST MODE ────────────────────────────────────────────────────────────────

  const columns: Column<EmailCampaign>[] = [
    {
      key: 'campaign',
      header: 'Campaign',
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{c.name}</p>
          <p className="mt-0.5 max-w-[260px] truncate text-xs text-muted">{c.subject}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <Badge tone={STATUS_TONES[c.status] ?? 'neutral'}>{statusLabel(c.status)}</Badge>,
    },
    {
      key: 'recipients',
      header: 'Recipients',
      className: 'text-right',
      cell: (c) => <span className="font-medium text-ink-soft">{c.recipient_count ?? '—'}</span>,
    },
    {
      key: 'delivered',
      header: 'Delivered',
      className: 'text-right',
      cell: (c) => c.delivered_count != null
        ? <span className="font-medium text-success-700">{c.delivered_count}</span>
        : <span className="text-muted">—</span>,
    },
    {
      key: 'date',
      header: 'Date',
      className: 'text-right whitespace-nowrap',
      cell: (c) => (
        <span className="text-xs text-muted">
          {new Date(c.sent_at || c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right whitespace-nowrap',
      cell: (c) => (
        <div className="flex items-center justify-end gap-2">
          {c.status === 'draft' && (
            <Button size="sm" variant="secondary" icon={<Send size={12} />} onClick={startCreate}>Send</Button>
          )}
          {c.status === 'sent' && (
            <RouterLink to={`/campaigns/${c.id}`}
              className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline">
              <BarChart2 size={13} aria-hidden="true" /> Analytics
            </RouterLink>
          )}
          <button type="button" onClick={() => handleDeleteCampaign(c.id, c.name)}
            aria-label={`Delete campaign ${c.name}`} title="Delete campaign"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Email campaigns"
        subtitle="Manage outreach, interview invites, and bulk candidate communications"
        actions={<Button icon={<Plus size={16} />} onClick={startCreate}>New campaign</Button>}
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {!listIsError && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total" value={stats.total} icon={<Mail size={18} />} tone="navy" loading={listLoading} />
            <StatCard label="Sent" value={stats.sent} icon={<Send size={18} />} tone="success" loading={listLoading} />
            <StatCard label="Scheduled" value={stats.scheduled} icon={<Clock size={18} />} tone="brand" loading={listLoading} />
            <StatCard label="Delivered" value={stats.delivered} icon={<Users size={18} />} tone="neutral" loading={listLoading} />
            <StatCard label="Failed" value={stats.failed} icon={<XCircle size={18} />} tone="danger" loading={listLoading} />
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter campaigns by status">
          {FILTERS.map(f => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? 'border-navy-600 bg-navy-600 text-white' : 'border-line bg-white text-ink-soft hover:border-line-strong'
              }`}>
              {f === 'all' ? 'All campaigns' : statusLabel(f)}
              {f !== 'all' && <span className="ml-1 opacity-70">({campaigns.filter(c => c.status === f).length})</span>}
            </button>
          ))}
        </div>

        <DataTable
          caption="Email campaigns"
          columns={columns}
          rows={listIsError ? undefined : filteredCampaigns}
          rowKey={(c) => c.id}
          loading={listLoading}
          error={listIsError ? listError : undefined}
          onRetry={refetchList}
          empty={
            campaigns.length === 0 ? (
              <EmptyState
                icon={<Mail size={22} aria-hidden="true" />}
                title="No campaigns yet"
                description="Create your first campaign to reach candidates at scale."
                action={<Button icon={<Plus size={16} />} onClick={startCreate}>Create campaign</Button>}
              />
            ) : (
              <EmptyState
                icon={<Mail size={22} aria-hidden="true" />}
                title={`No ${filter} campaigns`}
                action={<Button variant="secondary" onClick={() => setFilter('all')}>Show all campaigns</Button>}
              />
            )
          }
        />
      </div>
    </>
  );
}
