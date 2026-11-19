import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { useListBoardsQuery, usePublishJobMutation } from '../../store/api/jobBoardsApi';
import { Button, EmptyState, Modal, Skeleton, buttonClasses } from '../ui';

interface Props {
  jobId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JobBoardPublishModal({ jobId, onClose, onSuccess }: Props) {
  const { data, isLoading: loadingBoards } = useListBoardsQuery();
  const [publishJob, { isLoading: publishing }] = usePublishJobMutation();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Array<{ board_key: string; board_name: string; success: boolean; error?: string }> | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePublish = async () => {
    if (selected.size === 0) return;
    try {
      const res = await publishJob({ jobId, board_keys: Array.from(selected) }).unwrap();
      const boards = data?.boards ?? [];
      setResults(
        res.results.map((r) => ({
          ...r,
          board_name: boards.find((b) => b.key === r.board_key)?.name ?? r.board_key,
        })),
      );
      onSuccess();
    } catch {
      // handled per-board in results
    }
  };

  const connectedBoards = data?.boards.filter((b) => b.connected) ?? [];
  const unconnectedBoards = data?.boards.filter((b) => !b.connected) ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={publishing}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <Globe size={18} className="text-navy-600" />
          Publish to job boards
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={publishing}>
            {results ? 'Close' : 'Cancel'}
          </Button>
          {!results && (
            <Button onClick={handlePublish} disabled={selected.size === 0} loading={publishing}>
              Publish to {selected.size > 0 ? `${selected.size} board${selected.size > 1 ? 's' : ''}` : 'selected boards'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {loadingBoards ? (
          <div className="space-y-2" role="status" aria-label="Loading job boards">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : results ? (
          // Show results after publishing
          <div className="space-y-2">
            <p className="mb-3 text-sm font-medium text-ink">Publishing results</p>
            {results.map((r) => (
              <div
                key={r.board_key}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  r.success ? 'border-emerald-100 bg-success-50' : 'border-red-100 bg-danger-50'
                }`}
              >
                {r.success ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-600" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger-600" />
                )}
                <div>
                  <p className={`text-sm font-medium ${r.success ? 'text-success-700' : 'text-danger-700'}`}>
                    {r.board_name}
                  </p>
                  {r.error && <p className="mt-0.5 text-xs text-danger-600">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {connectedBoards.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted">Connected boards</legend>
                <div className="space-y-2">
                  {connectedBoards.map((board) => (
                    <label
                      key={board.key}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        selected.has(board.key)
                          ? 'border-navy-300 bg-navy-50'
                          : 'border-line hover:border-line-strong hover:bg-surface'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(board.key)}
                        onChange={() => toggle(board.key)}
                        className="h-4 w-4 rounded border-line-strong text-navy-600 focus:ring-navy-500"
                      />
                      <span className={`h-2 w-2 rounded-full ${board.color}`} aria-hidden="true" />
                      <span className="text-sm font-medium text-ink">{board.name}</span>
                      {board.connected_at && <span className="ml-auto text-xs text-muted">Connected</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {unconnectedBoards.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Not connected</p>
                <div className="space-y-1.5">
                  {unconnectedBoards.map((board) => (
                    <div
                      key={board.key}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-line p-3"
                    >
                      <span className={`h-2 w-2 rounded-full opacity-50 ${board.color}`} aria-hidden="true" />
                      <span className="text-sm text-muted">{board.name}</span>
                      <Link to="/settings/job-boards" className="ml-auto text-xs font-medium text-navy-600 hover:underline">
                        Connect
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {connectedBoards.length === 0 && (
              <EmptyState
                compact
                icon={<Globe size={22} />}
                title="No job boards connected yet"
                description="Connect a job board in Settings to publish this job."
                action={
                  <Link to="/settings/job-boards" className={buttonClasses('secondary', 'sm')}>
                    Connect boards in Settings
                  </Link>
                }
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
