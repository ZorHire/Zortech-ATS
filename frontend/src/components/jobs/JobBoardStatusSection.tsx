import { useState } from 'react';
import { Globe, CheckCircle2, Clock, AlertCircle, XCircle, MinusCircle, Loader2, Trash2 } from 'lucide-react';
import { useGetJobPostingsQuery, useWithdrawFromBoardMutation } from '../../store/api/jobBoardsApi';
import type { JobPosting } from '../../store/api/jobBoardsApi';
import JobBoardPublishModal from './JobBoardPublishModal';
import { useAppSelector } from '../../hooks/useAppSelector';
import { selectCurrentUser } from '../../store/slices/authSlice';

interface Props {
  jobId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  not_posted:  { label: 'Not Posted',  icon: <MinusCircle size={13} />,   className: 'bg-gray-100 text-gray-500' },
  pending:     { label: 'Pending',     icon: <Clock size={13} />,         className: 'bg-amber-100 text-amber-700' },
  active:      { label: 'Live',        icon: <CheckCircle2 size={13} />,  className: 'bg-emerald-100 text-emerald-700' },
  expired:     { label: 'Expired',     icon: <XCircle size={13} />,       className: 'bg-orange-100 text-orange-600' },
  error:       { label: 'Error',       icon: <AlertCircle size={13} />,   className: 'bg-red-100 text-red-600' },
  withdrawn:   { label: 'Withdrawn',   icon: <MinusCircle size={13} />,   className: 'bg-slate-100 text-slate-500' },
};

function PostingCard({ posting, jobId, canEdit }: { posting: JobPosting; jobId: string; canEdit: boolean }) {
  const [withdraw, { isLoading }] = useWithdrawFromBoardMutation();
  const cfg = STATUS_CONFIG[posting.status] ?? STATUS_CONFIG.not_posted;

  const handleWithdraw = async () => {
    if (!confirm(`Remove this job from ${posting.board_name}?`)) return;
    await withdraw({ jobId, boardKey: posting.board_key });
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${posting.board_color}`} />
        <span className="text-sm font-medium text-gray-800 truncate">{posting.board_name}</span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {posting.application_count > 0 && (
          <span className="text-xs text-gray-500">
            {posting.application_count} app{posting.application_count !== 1 ? 's' : ''}
          </span>
        )}

        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
          {cfg.icon}
          {cfg.label}
        </span>

        {posting.error_message && (
          <span className="text-xs text-red-500 max-w-[140px] truncate" title={posting.error_message}>
            {posting.error_message}
          </span>
        )}

        {canEdit && posting.status === 'active' && (
          <button
            onClick={handleWithdraw}
            disabled={isLoading}
            className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            title={`Withdraw from ${posting.board_name}`}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function JobBoardStatusSection({ jobId }: Props) {
  const profile = useAppSelector(selectCurrentUser);
  const { data, isLoading, refetch } = useGetJobPostingsQuery(jobId);
  const [publishOpen, setPublishOpen] = useState(false);

  const canEdit = profile?.role === 'super_admin' || profile?.role === 'accounts_manager';

  const postedCount  = data?.postings.filter((p) => p.status === 'active').length ?? 0;
  const errorCount   = data?.postings.filter((p) => p.status === 'error').length ?? 0;
  const totalApps    = data?.postings.reduce((sum, p) => sum + p.application_count, 0) ?? 0;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Job Board Distribution</h3>
            {postedCount > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                {postedCount} live
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                {errorCount} error
              </span>
            )}
          </div>

          {canEdit && (
            <button
              onClick={() => setPublishOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Globe size={12} />
              Publish to Boards
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="divide-y-0">
              {data?.postings.map((posting) => (
                <PostingCard key={posting.board_key} posting={posting} jobId={jobId} canEdit={canEdit} />
              ))}
            </div>

            {totalApps > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-800">{totalApps}</span> total applications ingested from job boards
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {publishOpen && (
        <JobBoardPublishModal
          jobId={jobId}
          onClose={() => setPublishOpen(false)}
          onSuccess={() => { refetch(); }}
        />
      )}
    </>
  );
}
