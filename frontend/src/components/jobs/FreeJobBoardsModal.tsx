import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Send } from "lucide-react";
import { Badge, Button, ErrorState, Modal, Skeleton } from "../ui";
import type { BadgeTone } from "../ui";
import { useGetFreeJobBoardsQuery, useGetLinkedInAccountQuery, useRequestFreeJobPostsMutation, useUpdateFreeJobPostMutation } from "../../store/api/linkedinApi";
import { useNotify } from "../../hooks/useNotify";
import { getErrorMessage } from "../../lib/format";
import { EXTENSION_ZIP } from "../linkedin/ConnectExtensionCard";
import { isDesktopApp } from "../../lib/desktop";
import type { FreeBoard } from "../../types/linkedin";

const POST_STATUS: Record<NonNullable<FreeBoard["post"]>["status"], { label: string; tone: BadgeTone }> = {
  requested: { label: "Waiting for extension", tone: "neutral" },
  opened: { label: "Open in Chrome", tone: "brand" },
  posted: { label: "Posted", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

/**
 * Post a job to free job boards through the ZorHire Assistant extension: it opens each
 * board's post-a-job page in the recruiter's Chrome and fills the form. The recruiter signs
 * in (or creates a free account) on each board and presses the board's own Post button.
 */
export default function FreeJobBoardsModal({ jobId, open, onClose }: { jobId: string; open: boolean; onClose: () => void }) {
  const notify = useNotify();
  const { data, isLoading, isError, error, refetch } = useGetFreeJobBoardsQuery(jobId, { skip: !open, pollingInterval: open ? 10000 : 0 });
  const account = useGetLinkedInAccountQuery(undefined, { skip: !open });
  const [request, { isLoading: sending }] = useRequestFreeJobPostsMutation();
  const [update] = useUpdateFreeJobPostMutation();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && data) setPicked(new Set(data.filter((b) => b.suitable && b.post?.status !== "posted").map((b) => b.key)));
  }, [open, data?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const online = !!account.data?.extension_online;
  const connected = !!account.data?.connected;
  const posted = useMemo(() => (data ?? []).filter((b) => b.post?.status === "posted").length, [data]);

  const submit = async () => {
    try {
      const r = await request({ jobId, boards: [...picked] }).unwrap();
      const n = `${r.queued} board${r.queued > 1 ? "s" : ""}`;
      notify.success(isDesktopApp
        ? `${n} will open as tabs in this app within a minute. Sign in on each and click "Fill form".`
        : online
          ? `${n} will open in Chrome in a moment. Sign in on each and click "Fill form".`
          : `${n} queued. They open as soon as the ZorHire Assistant extension is running in Chrome.`);
    } catch (err) {
      notify.error(getErrorMessage(err, "Could not queue the job boards."));
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Post to free job boards"
      description={`ZorHire opens each board's post-a-job page ${isDesktopApp ? "as a tab in this app" : "in your Chrome"} and fills in the job. You sign in or create a free account on the board, check the form and press its Post button.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button icon={<Send size={16} />} loading={sending} disabled={!picked.size || !connected} onClick={submit}>
          Open {picked.size || ""} board{picked.size === 1 ? "" : "s"}{isDesktopApp ? "" : " in Chrome"}
        </Button>
      </>}>
      {!connected && account.data && isDesktopApp && (
        <div role="status" className="mb-4 rounded-lg border border-line bg-surface-sunken p-3 text-sm text-muted">
          The app is still connecting to your account. Try again in a minute.
        </div>
      )}
      {!connected && account.data && !isDesktopApp && (
        <div role="status" className="mb-4 rounded-lg border border-line bg-warning-50 p-3 text-sm text-warning-700">
          This needs the ZorHire Assistant Chrome extension. <a className="font-medium underline" href={EXTENSION_ZIP} download>Download it</a>, then connect it from <a className="font-medium underline" href="/linkedin-agent">LinkedIn agent</a>.
        </div>
      )}
      {connected && !online && !isDesktopApp && (
        <p className="mb-4 text-sm text-muted">Your extension is offline right now. Queued boards open the next time Chrome is running with the extension.</p>
      )}
      {isLoading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        : isError ? <ErrorState error={error} onRetry={refetch} compact />
        : <>
          {posted > 0 && <p className="mb-3 flex items-center gap-1.5 text-sm text-success-700"><CheckCircle2 size={16} aria-hidden="true" /> Posted on {posted} board{posted > 1 ? "s" : ""}.</p>}
          <ul className="divide-y divide-line rounded-lg border border-line">
            {(data ?? []).map((b) => {
              const st = b.post ? POST_STATUS[b.post.status] : null;
              return (
                <li key={b.key} className="flex items-start gap-3 p-3">
                  <input type="checkbox" id={`fb-${b.key}`} className="mt-1" checked={picked.has(b.key)} disabled={b.post?.status === "posted"}
                    onChange={(e) => setPicked((s) => { const n = new Set(s); e.target.checked ? n.add(b.key) : n.delete(b.key); return n; })} />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`fb-${b.key}`} className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      {b.name}
                      {!b.suitable && <Badge tone="warning">{b.freshers_only ? `Mostly freshers (0-${b.maxExperience} yrs)` : "Not for this job type"}</Badge>}
                      {st && <Badge tone={st.tone}>{st.label}</Badge>}
                    </label>
                    <p className="text-xs text-muted">{b.bestFor}. {b.freeTier}</p>
                    {b.post?.posting_url && <a href={b.post.posting_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-navy-600 hover:underline"><ExternalLink size={12} aria-hidden="true" /> View posting</a>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <a href={b.signupUrl} target="_blank" rel="noreferrer" className="text-xs text-navy-600 hover:underline">Create account</a>
                    {b.post && b.post.status !== "posted" && (
                      <button type="button" className="text-xs text-muted hover:text-ink hover:underline"
                        onClick={() => update({ id: b.post!.id, jobId, status: "posted" })}>Mark as posted</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">Free plans change often. If a board asks you to pay, choose its free option or skip it. ZorHire never sees your job-board passwords.</p>
        </>}
    </Modal>
  );
}
