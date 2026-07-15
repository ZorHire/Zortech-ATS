import { useState } from 'react';
import { Globe, CheckCircle2, Plus, Trash2, Loader2, X, Eye, EyeOff } from 'lucide-react';
import Header from '../components/layout/Header';
import {
  useListBoardsQuery,
  useConnectBoardMutation,
  useDisconnectBoardMutation,
} from '../store/api/jobBoardsApi';
import type { BoardInfo } from '../store/api/jobBoardsApi';

// ── Connect modal ─────────────────────────────────────────────────────────────

function ConnectModal({ board, onClose }: { board: BoardInfo; onClose: () => void }) {
  const [connectBoard, { isLoading }] = useConnectBoardMutation();
  const [form, setForm]   = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const access_token = form['access_token'] ?? '';
    if (!access_token) { setError('API Key / Access Token is required.'); return; }

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
      onClose();
    } catch (err: unknown) {
      setError((err as { data?: { message?: string } })?.data?.message ?? 'Connection failed');
    }
  };

  const allFields = [
    ...board.configFields,
    { key: 'webhook_secret', label: 'Webhook Secret (optional)', placeholder: 'Shared secret to verify incoming webhooks', required: false, secret: false },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${board.color}`} />
            <h2 className="text-base font-semibold text-gray-900">Connect {board.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {allFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="relative">
                <input
                  type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={form[field.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-9"
                />
                {field.secret && (
                  <button
                    type="button"
                    onClick={() => setShowSecrets((p) => ({ ...p, [field.key]: !p[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <p className="text-xs text-gray-500">
            Credentials are encrypted with AES-256-GCM before storage.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              Save credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Board card ─────────────────────────────────────────────────────────────────

function BoardCard({ board }: { board: BoardInfo }) {
  const [disconnectBoard, { isLoading: disconnecting }] = useDisconnectBoardMutation();
  const [connectOpen, setConnectOpen] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm(`Disconnect ${board.name}? Active postings will no longer be manageable from ZorHire.`)) return;
    await disconnectBoard(board.key);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg ${board.color} flex items-center justify-center flex-shrink-0`}>
          <Globe size={18} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{board.name}</p>
          {board.connected && board.connected_at ? (
            <p className="text-xs text-gray-500 mt-0.5">
              Connected {new Date(board.connected_at).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">Not connected</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {board.connected ? (
            <>
              <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 size={11} />
                Connected
              </span>
              <button
                onClick={() => setConnectOpen(true)}
                className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                Update
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Disconnect"
              >
                {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConnectOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Connect
            </button>
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
  const { data, isLoading } = useListBoardsQuery();

  const connectedCount = data?.boards.filter((b) => b.connected).length ?? 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Job Board Integrations"
        subtitle={
          connectedCount > 0
            ? `${connectedCount} of ${data?.boards.length ?? 0} boards connected`
            : 'Connect job boards to publish openings and receive applications automatically'
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Webhook info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-800">Webhook endpoint for incoming applications</p>
          <code className="text-xs text-blue-700 font-mono mt-1 block break-all">
            {window.location.origin.replace('5173', '5000')}/v1/job-boards/webhooks/<span className="text-blue-500">{'<board_key>'}</span>
          </code>
          <p className="text-xs text-blue-600 mt-1.5">
            Register this URL in each job board's developer console to receive applications automatically.
            Set the same Webhook Secret in both places.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid gap-3">
            {data?.boards.map((board) => (
              <BoardCard key={board.key} board={board} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
