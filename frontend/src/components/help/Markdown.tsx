import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Small Markdown renderer for help articles and assistant answers. Builds React elements
 * (no HTML injection). Supports headings, paragraphs, numbered and bullet lists, tables,
 * **bold**, *italic*, `code` and [links](/path). Links inside ZorHire use the router;
 * external links open in a new tab.
 */
export default function Markdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  const key = () => `b${out.length}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level <= 2 ? "mt-5 text-base font-semibold text-ink" : "mt-4 text-sm font-semibold text-ink";
      out.push(level <= 2 ? <h3 key={key()} className={cls}>{inline(h[2], onNavigate)}</h3> : <h4 key={key()} className={cls}>{inline(h[2], onNavigate)}</h4>);
      i++;
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        <div key={key()} className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-line">{head.map((c, j) => <th key={j} className="px-2 py-1.5 font-semibold text-ink">{inline(c, onNavigate)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri} className="border-b border-line last:border-0">{r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top text-ink-soft">{inline(c, onNavigate)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const isOl = (l: string) => /^\s*\d+[.)]\s+/.test(l);
    const isUl = (l: string) => /^\s*[-*]\s+/.test(l);
    if (isOl(line) || isUl(line)) {
      const ordered = isOl(line);
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length && (isOl(lines[i]) || isUl(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const l = lines[i];
        const indented = /^\s{2,}/.test(l);
        if (indented && items.length) items[items.length - 1].sub.push(l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim());
        else items.push({ text: l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""), sub: [] });
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag key={key()} className={`mt-2 space-y-1 pl-5 text-sm text-ink-soft ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => (
            <li key={j}>
              {inline(it.text, onNavigate)}
              {it.sub.length > 0 && <ul className="mt-1 list-[circle] space-y-1 pl-5">{it.sub.map((s, k) => <li key={k}>{inline(s, onNavigate)}</li>)}</ul>}
            </li>
          ))}
        </Tag>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s/.test(lines[i]) && !isOl(lines[i]) && !isUl(lines[i]) && !/^\s*\|.*\|\s*$/.test(lines[i])) para.push(lines[i++].trim());
    out.push(<p key={key()} className="mt-2 text-sm leading-relaxed text-ink-soft first:mt-0">{inline(para.join(" "), onNavigate)}</p>);
  }
  return <div className="break-words">{out}</div>;
}

function inline(text: string, onNavigate?: () => void): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={n++}>{text.slice(last, m.index)}</Fragment>);
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={n++} className="font-semibold text-ink">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={n++} className="rounded bg-surface px-1 py-0.5 text-[0.85em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const lm = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const [, label, href] = lm;
      if (href.startsWith("/")) parts.push(<Link key={n++} to={href} onClick={onNavigate} className="font-medium text-navy-700 underline underline-offset-2 hover:text-navy-800">{label}</Link>);
      else if (/^(https?:|mailto:)/i.test(href)) parts.push(<a key={n++} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-navy-700 underline underline-offset-2">{label}</a>);
      else parts.push(<Fragment key={n++}>{label}</Fragment>);
    } else parts.push(<em key={n++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(<Fragment key={n++}>{text.slice(last)}</Fragment>);
  return parts;
}
