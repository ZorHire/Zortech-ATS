import { useId, useState } from 'react';
import { Globe, CheckCircle2, Plus, Trash2, Eye, EyeOff, Webhook } from 'lucide-react';
import {
  useListBoardsQuery,
  useConnectBoardMutation,
  useDisconnectBoardMutation,
} from '../store/api/jobBoardsApi';
import type { BoardInfo } from '../store/api/jobBoardsApi';
import { Badge, Button, EmptyState, ErrorState, Modal, PageHeader, Skeleton, useConfirm } from '../components/ui';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage } from '../lib/format';

// ── Connect modal ─────────────────────────────────────────────────────────────

function ConnectModal({ board, onClose }: { board: BoardInfo; onClose: () => void }) {
  const notify = useNotify();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;
  const [connectBoard, { isLoading }] = useConnectBoardMutation();
  const [form, setForm]   = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const allFields = [
    ...board.configFields,
    { key: 'webhook_secret', label: 'Webhook secret (optional)', placeholder: 'Shared secret to verify incoming webhooks', required: false, secret: true },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errs: Record<string, string> = {};
    for (const f of allFields) {
      if ((f.required || f.key === 'access_token') && !(form[f.key] ?? '').trim()) {
        errs[f.key] = f.key === 'access_token' ? 'API key / access token is required.' : `${f.label.replace(/\s*\*$/, '')} is required.`;
      }
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    const access_token = form['access_token'] ?? '';

    // Build extra_config from form keys prefixed with 'extra_config.'
    const extra_config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (k.startsWith('extra_config.') && v) {
        extra_config[k.replace('extra_config.', '')] = v;
      }
    }

    try {
      await connectBoard({
        boardKey: board.key,
        access_token,
        refresh_token:    form['refresh_token']    || undefined,
        webhook_secret:   form['webhook_secret']   || undefined,
        extra_config:     Object.keys(extra_config).length ? extra_config : undefined,
      }).unwrap();
      notify.success(`${board.name} connected`);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Connection failed'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={isLoading}
      title={`Connect ${board.name}`}
      description="Credentials are encrypted with AES-256-GCM before storage."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" form={fid('form')} loading={isLoading}>Save credentials</Button>
        </>
      }
    >
      <form id={fid('form')} onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        {allFields.map((field) => {
          const id = fid(field.key);
          const err = fieldErrors[field.key];
          const required = field.required || field.key === 'access_token';
          const shown = !!showSecrets[field.key];
          return (
            <div key={field.key}>
              <label htmlFor={id} className="zh-label">
                {field.label}
                {required && <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>}
              </label>
              <div className="relative">
                <input
                  id={id}
                  type={field.secret && !shown ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={form[field.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  autoComplete={field.secret ? 'new-password' : 'off'}
                  spellCheck={false}
                  required={required}
                  aria-invalid={!!err || undefined}
                  aria-describedby={err ? `${id}-err` : undefined}
                  className={`zh-input ${field.secret ? 'pr-11' : ''}`}
                />
                {field.secret && (
                  <button
                    type="button"
                    onClick={() => setShowSecrets((p) => ({ ...p, [field.key]: !p[field.key] }))}
                    aria-label={`${shown ? 'Hide' : 'Show'} ${field.label.replace(/\s*\(optional\)/i, '').toLowerCase()}`}
                    aria-pressed={shown}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-ink"
                  >
                    {shown ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
              {err && <p id={`${id}-err`} className="mt-1 text-xs text-danger-600">{err}</p>}
            </div>
          );
        })}
      </form>
    </Modal>
  );
}

// ── Board card ─────────────────────────────────────────────────────────────────

function BoardCard({ board }: { board: BoardInfo }) {
  const notify = useNotify();
  const confirm = useConfirm();
  const [disconnectBoard, { isLoading: disconnecting }] = useDisconnectBoardMutation();
  const [connectOpen, setConnectOpen] = useState(false);

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: `Disconnect ${board.name}?`,
      message: 'Active postings will no longer be manageable from ZorHire.',
      confirmText: 'Disconnect',
      danger: true,
    });
    if (!ok) return;
    try {
      await disconnectBoard(board.key).unwrap();
      notify.success(`${board.name} disconnected`);
    } catch (err) {
      notify.error(getErrorMessage(err, `Failed to disconnect ${board.name}`));
    }
  };

  return (
    <>
      <div className="zh-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
            <Globe size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              {board.name}
              {board.connected
                ? <Badge tone="success" icon={<CheckCircle2 size={11} aria-hidden="true" />}>Connected</Badge>
                : <Badge tone="neutral">Not connected</Badge>}
            </p>
            {board.connected && board.connected_at && (
              <p className="mt-0.5 text-xs text-muted">
                Connected {new Date(board.connected_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {board.connected ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setConnectOpen(true)}>
                Update credentials
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                loading={disconnecting}
                icon={<Trash2 size={14} />}
                aria-label={`Disconnect ${board.name}`}
                className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setConnectOpen(true)}>
              Connect
            </Button>
          )}
        </div>
      </div>

      {connectOpen && (
        <ConnectModal board={board} onClose={() => setConnectOpen(false)} />
      )}
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function JobBoardsSettingsPage() {
  const { data, isLoading, isFetching, isError, error, refetch } = useListBoardsQuery();

  const boards = data?.boards ?? [];
  const connectedCount = boards.filter((b) => b.connected).length;

  return (
    <>
      <PageHeader
        title="Job board integrations"
        subtitle={
          connectedCount > 0
            ? `${connectedCount} of ${boards.length} boards connected`
            : 'Connect job boards to publish openings and receive applications automatically'
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="flex gap-3 rounded-xl border border-navy-100 bg-navy-50 p-4">
          <Webhook size={18} className="mt-0.5 flex-shrink-0 text-navy-600" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-navy-800">Webhook endpoint for incoming applications</h2>
            <code className="mt-1 block break-all font-mono text-xs text-navy-700">
              {window.location.origin.replace('5173', '5000')}/v1/job-boards/webhooks/<span className="text-navy-500">{'<board_key>'}</span>
            </code>
            <p className="mt-1.5 text-xs text-ink-soft">
              Register this URL in each job board's developer console to receive applications automatically.
              Set the same webhook secret in both places.
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-3" role="status" aria-label="Loading job boards">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : boards.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Globe size={22} aria-hidden="true" />}
              title="No job boards available"
              description="No integrations are enabled for your workspace yet. Check again later or contact support."
              action={<Button variant="secondary" onClick={() => refetch()}>Refresh</Button>}
            />
          </div>
        ) : (
          <div className="grid gap-3">
            {boards.map((board) => (
              <BoardCard key={board.key} board={board} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
