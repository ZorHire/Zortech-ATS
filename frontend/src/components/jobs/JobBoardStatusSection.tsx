import { useState } from 'react';
import type { ReactNode } from 'react';
import { Globe, CheckCircle2, Clock, AlertCircle, XCircle, MinusCircle, Trash2 } from 'lucide-react';
import { useGetJobPostingsQuery, useWithdrawFromBoardMutation } from '../../store/api/jobBoardsApi';
import type { JobPosting } from '../../store/api/jobBoardsApi';
import JobBoardPublishModal from './JobBoardPublishModal';
import { useAppSelector } from '../../hooks/useAppSelector';
import { selectCurrentUser } from '../../store/slices/authSlice';
import { Badge, Button, Skeleton, Spinner, useConfirm } from '../ui';
import type { BadgeTone } from '../ui';

interface Props {
  jobId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: ReactNode; tone: BadgeTone }> = {
  not_posted:  { label: 'Not posted',  icon: <MinusCircle size={12} />,   tone: 'neutral' },
  pending:     { label: 'Pending',     icon: <Clock size={12} />,         tone: 'warning' },
  active:      { label: 'Live',        icon: <CheckCircle2 size={12} />,  tone: 'success' },
  expired:     { label: 'Expired',     icon: <XCircle size={12} />,       tone: 'neutral' },
  error:       { label: 'Error',       icon: <AlertCircle size={12} />,   tone: 'danger' },
  withdrawn:   { label: 'Withdrawn',   icon: <MinusCircle size={12} />,   tone: 'neutral' },
};

function PostingCard({ posting, jobId, canEdit }: { posting: JobPosting; jobId: string; canEdit: boolean }) {
  const [withdraw, { isLoading }] = useWithdrawFromBoardMutation();
  const cfg = STATUS_CONFIG[posting.status] ?? STATUS_CONFIG.not_posted;
  const confirm = useConfirm();

  const handleWithdraw = async () => {
    const ok = await confirm({ title: `Remove this job from ${posting.board_name}?`, danger: true, confirmText: 'Withdraw' });
    if (!ok) return;
    await withdraw({ jobId, boardKey: posting.board_key });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`h-2 w-2 shrink-0 rounded-full ${posting.board_color}`} />
        <span className="truncate text-sm font-medium text-ink">{posting.board_name}</span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {posting.application_count > 0 && (
          <span className="text-xs text-muted">
            {posting.application_count} app{posting.application_count !== 1 ? 's' : ''}
          </span>
        )}

        <Badge tone={cfg.tone} icon={cfg.icon}>{cfg.label}</Badge>

        {posting.error_message && (
          <span className="max-w-[140px] truncate text-xs text-danger-600" title={posting.error_message}>
            {posting.error_message}
          </span>
        )}

        {canEdit && posting.status === 'active' && (
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
            title={`Withdraw from ${posting.board_name}`}
            aria-label={`Withdraw from ${posting.board_name}`}
          >
            {isLoading ? <Spinner size={14} /> : <Trash2 size={14} />}
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
      <section className="zh-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Globe size={16} className="text-navy-600" />
            <h3 className="text-base font-semibold text-ink">Job board distribution</h3>
            {postedCount > 0 && (
              <Badge tone="success">{postedCount} live</Badge>
            )}
            {errorCount > 0 && (
              <Badge tone="danger">{errorCount} error</Badge>
            )}
          </div>

          {canEdit && (
            <Button variant="secondary" size="sm" icon={<Globe size={14} />} onClick={() => setPublishOpen(true)}>
              Publish to boards
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 py-1" role="status" aria-label="Loading job boards">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <div>
              {data?.postings.map((posting) => (
                <PostingCard key={posting.board_key} posting={posting} jobId={jobId} canEdit={canEdit} />
              ))}
            </div>

            {totalApps > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs text-muted">
                  <span className="font-semibold text-ink">{totalApps}</span> total applications ingested from job boards
                </p>
              </div>
            )}
          </>
        )}
      </section>

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
