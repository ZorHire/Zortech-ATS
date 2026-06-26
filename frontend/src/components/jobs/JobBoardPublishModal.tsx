import { useState } from 'react';
import { Globe, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { useListBoardsQuery, usePublishJobMutation } from '../../store/api/jobBoardsApi';

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
      next.has(key) ? next.delete(key) : next.add(key);
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Publish to Job Boards</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {loadingBoards ? (
            <div className="flex justify-center py-6">
              <Loader2 size={22} className="animate-spin text-blue-500" />
            </div>
          ) : results ? (
            // Show results after publishing
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 mb-3">Publishing results:</p>
              {results.map((r) => (
                <div
                  key={r.board_key}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    r.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  {r.success ? (
                    <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${r.success ? 'text-emerald-800' : 'text-red-700'}`}>
                      {r.board_name}
                    </p>
                    {r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {connectedBoards.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Connected boards</p>
                  <div className="space-y-2">
                    {connectedBoards.map((board) => (
                      <label
                        key={board.key}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected.has(board.key)
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(board.key)}
                          onChange={() => toggle(board.key)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className={`w-2 h-2 rounded-full ${board.color}`} />
                        <span className="text-sm font-medium text-gray-800">{board.name}</span>
                        {board.connected_at && (
                          <span className="ml-auto text-xs text-gray-400">Connected</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {unconnectedBoards.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Not connected</p>
                  <div className="space-y-1.5">
                    {unconnectedBoards.map((board) => (
                      <div
                        key={board.key}
                        className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 opacity-50"
                      >
                        <span className={`w-2 h-2 rounded-full ${board.color}`} />
                        <span className="text-sm text-gray-500">{board.name}</span>
                        <a
                          href="/settings/job-boards"
                          className="ml-auto text-xs text-blue-600 hover:underline"
                        >
                          Connect
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {connectedBoards.length === 0 && !loadingBoards && (
                <div className="text-center py-6">
                  <Globe size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No job boards connected yet.</p>
                  <a href="/settings/job-boards" className="text-sm text-blue-600 hover:underline mt-1 block">
                    Connect boards in Settings
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={handlePublish}
              disabled={selected.size === 0 || publishing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {publishing && <Loader2 size={14} className="animate-spin" />}
              Publish to {selected.size > 0 ? `${selected.size} board${selected.size > 1 ? 's' : ''}` : 'selected boards'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
