import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Search } from "lucide-react";
import { ErrorState, PageHeader, Skeleton } from "../components/ui";
import HelpAssistant from "../components/help/HelpAssistant";
import Markdown from "../components/help/Markdown";
import { useGetHelpArticleQuery, useGetHelpArticlesQuery, type HelpArticleSummary } from "../store/api/helpApi";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";

export default function HelpPage() {
  const { slug } = useParams();
  const user = useAppSelector(selectCurrentUser);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Help" subtitle="Guides for every part of ZorHire, and Aruna, your help assistant, to answer your questions." />
      <div className="grid flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
        <div className="min-w-0">{slug ? <ArticleView slug={slug} /> : <Topics />}</div>
        <section aria-label="Ask Aruna" className="zh-card flex h-[640px] max-h-[80vh] flex-col overflow-hidden lg:sticky lg:top-6">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold text-ink">Ask Aruna</h2>
            <p className="text-xs text-muted">Your help assistant. Answers come from these help guides.</p>
          </div>
          <HelpAssistant role={user?.role} />
        </section>
      </div>
    </div>
  );
}

function Topics() {
  const { data, isLoading, isError, error, refetch } = useGetHelpArticlesQuery();
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = (data?.articles ?? []).filter((a) => words.every((w) => `${a.title} ${a.summary} ${a.category}`.toLowerCase().includes(w)));
    const map = new Map<string, HelpArticleSummary[]>();
    for (const a of list) map.set(a.category, [...(map.get(a.category) ?? []), a]);
    return [...map.entries()];
  }, [data, q]);

  return (
    <div className="space-y-5">
      <div className="relative max-w-xl">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="help-search" className="sr-only">Search help topics</label>
        <input id="help-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help topics" className="zh-input pl-9" />
      </div>
      {isLoading && <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="zh-card p-5"><Skeleton className="h-20 w-full" /></div>)}</div>}
      {isError && <div className="zh-card"><ErrorState error={error} onRetry={refetch} compact /></div>}
      {data && groups.length === 0 && <p className="text-sm text-muted">No help topics match "{q}". Try other words, or ask the assistant.</p>}
      {groups.map(([category, items]) => (
        <section key={category} aria-labelledby={`cat-${category}`}>
          <h2 id={`cat-${category}`} className="mb-2 text-sm font-semibold text-ink">{category}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((a) => (
              <li key={a.slug}>
                <Link to={`/help/${a.slug}`} className="zh-card flex h-full items-start gap-3 p-4 hover:border-navy-200 hover:shadow-md">
                  <BookOpen size={16} className="mt-0.5 flex-shrink-0 text-navy-600" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{a.title}</span>
                    {a.summary && <span className="mt-0.5 block text-xs text-muted">{a.summary}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ArticleView({ slug }: { slug: string }) {
  const { data, isLoading, isError, error, refetch } = useGetHelpArticleQuery(slug);
  const list = useGetHelpArticlesQuery();
  const related = (list.data?.articles ?? []).filter((a) => data && a.category === data.category && a.slug !== slug).slice(0, 5);
  return (
    <div className="space-y-4">
      <Link to="/help" className="inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-navy-800">
        <ArrowLeft size={16} aria-hidden="true" /> All help topics
      </Link>
      {isLoading && <div className="zh-card p-6"><Skeleton className="h-48 w-full" /></div>}
      {isError && <div className="zh-card"><ErrorState error={error} onRetry={refetch} compact /></div>}
      {data && (
        <article className="zh-card p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{data.category}</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{data.title}</h2>
          {data.summary && <p className="mt-1 text-sm text-muted">{data.summary}</p>}
          <div className="mt-4 border-t border-line pt-4">
            <Markdown text={data.body} />
          </div>
        </article>
      )}
      {related.length > 0 && (
        <section aria-labelledby="related-help">
          <h3 id="related-help" className="mb-2 text-sm font-semibold text-ink">More in {data?.category}</h3>
          <ul className="space-y-1">
            {related.map((a) => (
              <li key={a.slug}><Link to={`/help/${a.slug}`} className="text-sm text-navy-700 hover:underline">{a.title}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
