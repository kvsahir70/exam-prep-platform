"use client";

import clsx from "clsx";
import { Bookmark, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, Search, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { EditQuestionButton } from "@/components/QuestionEditor";
import { formatAnswer, QuestionView, type Response } from "@/components/QuestionView";
import { RichText } from "@/components/RichText";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, PageHeader, ProgressBar, Reveal, Select, Skeleton } from "@/components/ui";
import { api, type PyqItem, type PyqStats } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

const STATUSES = [
  ["", "All"],
  ["unsolved", "Unsolved"],
  ["solved", "Solved"],
  ["incorrect", "Got wrong"],
  ["bookmarked", "Bookmarked"],
] as const;

function PyqCard({
  item,
  onChange,
  onRemoved,
  onError,
}: {
  item: PyqItem;
  onChange: (i: PyqItem) => void;
  onRemoved: () => void;
  onError: (message: string) => void;
}) {
  const { user } = useAuth();
  const [response, setResponse] = useState<Response>(item.progress?.last_response ?? null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const solved = !!item.progress?.solved;
  const [reveal, setReveal] = useState(solved);

  async function check() {
    if (!response || (Array.isArray(response) && !response.length)) return;
    setBusy(true);
    try {
      onChange(await api<PyqItem>(`/api/pyq/${item.id}/answer`, { method: "POST", json: { response } }));
      setReveal(true);
    } finally {
      setBusy(false);
    }
  }

  async function bookmark() {
    const { bookmarked } = await api<{ bookmarked: boolean }>(`/api/pyq/${item.id}/bookmark`, { method: "POST" });
    onChange({ ...item, progress: { ...(item.progress ?? { solved: false, is_correct: null, attempts: 0, last_response: null }), bookmarked } });
  }

  async function remove() {
    if (!confirm("Remove this question from the PYQ bank? It stays on the uploaded paper and can be restored from the admin review page.")) return;
    setRemoving(true);
    try {
      await api(`/api/pyq/${item.id}`, { method: "DELETE" });
      onRemoved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      setRemoving(false);
    }
  }

  const result = item.progress?.is_correct;
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {item.year && <Badge tone="brand">{item.year}</Badge>}
        <Badge>{item.subject ?? item.section}</Badge>
        {item.topic && <Badge>{item.topic}</Badge>}
        {solved && (
          <Badge tone={result ? "success" : result === false ? "danger" : "neutral"}>
            {result ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {result ? "Solved" : result === false ? "Incorrect" : "Attempted"}
          </Badge>
        )}
        <button
          onClick={bookmark}
          aria-label="Bookmark"
          className={clsx("ml-auto grid h-8 w-8 place-items-center rounded-lg transition hover:bg-sunken", item.progress?.bookmarked ? "text-warning" : "text-subtle")}
        >
          <Bookmark className="h-4 w-4" fill={item.progress?.bookmarked ? "currentColor" : "none"} />
        </button>
        {user?.role === "admin" && (
          <button
            onClick={remove}
            disabled={removing}
            aria-label="Remove from PYQ bank"
            title="Remove from PYQ bank"
            className="grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:bg-sunken hover:text-danger disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <QuestionView
        type={item.type}
        text={item.text}
        options={item.options}
        images={item.images}
        response={response}
        onChange={(r) => {
          setResponse(r);
          setReveal(false);
        }}
        answer={reveal ? item.answer : undefined}
      />
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={check} loading={busy} disabled={!response || (Array.isArray(response) && !response.length)}>
          Check answer
        </Button>
        {solved && !reveal && (
          <Button size="sm" variant="ghost" onClick={() => setReveal(true)}>
            Show solution
          </Button>
        )}
        <span className="ml-auto">
          <EditQuestionButton
            questionId={item.id}
            onSaved={(q) =>
              onChange({ ...item, text: q.text, type: q.type, options: q.options, images: q.images, answer: q.answer, explanation: q.explanation })
            }
          />
        </span>
      </div>
      {reveal && item.answer !== null && (
        <div className="mt-4 rounded-xl bg-brand-soft/60 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Answer {formatAnswer(item.answer)}</p>
          {item.explanation ? <RichText text={item.explanation} className="text-sm" /> : <p className="text-sm text-muted">No explanation in the source paper.</p>}
        </div>
      )}
    </Card>
  );
}

export default function PyqPage() {
  const [filters, setFilters] = useState({ subject: "", year: "", status: "", q: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: meta } = useApi<{ subjects: string[]; years: number[] }>("/api/pyq/filters");
  const { data: stats, reload: reloadStats } = useApi<PyqStats>("/api/pyq/stats");

  const qs = new URLSearchParams({ page: String(page), page_size: "10" });
  Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
  const { data, loading, setData, reload } = useApi<{ total: number; items: PyqItem[] }>(`/api/pyq?${qs}`);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, q: search }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const set = (k: keyof typeof filters) => (v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;

  return (
    <>
      <PageHeader title="PYQ bank" subtitle="Previous-year questions from every uploaded paper." />
      {failed && <ErrorNote message={failed} />}

      {stats && (
        <Reveal>
          <Card className="mb-6 grid gap-6 p-6 sm:grid-cols-[220px_1fr]">
            <div>
              <p className="text-sm text-muted">Overall progress</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {stats.solved}
                <span className="text-lg text-subtle"> / {stats.total}</span>
              </p>
              <p className="mt-1 text-xs text-subtle">{stats.accuracy}% accuracy on solved</p>
              <div className="mt-3">
                <ProgressBar value={stats.total ? (100 * stats.solved) / stats.total : 0} tone="success" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.by_subject.map((s) => (
                <button key={s.subject} onClick={() => set("subject")(filters.subject === s.subject ? "" : s.subject)} className="text-left">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className={clsx("font-medium", filters.subject === s.subject && "text-brand")}>{s.subject}</span>
                    <span className="text-subtle">
                      {s.solved}/{s.total}
                    </span>
                  </div>
                  <ProgressBar value={s.total ? (100 * s.solved) / s.total : 0} />
                </button>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text" className="pl-9" />
        </div>
        <Select value={filters.subject} onChange={(e) => set("subject")(e.target.value)} className="lg:w-48">
          <option value="">All subjects</option>
          {meta?.subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={filters.year} onChange={(e) => set("year")(e.target.value)} className="lg:w-32">
          <option value="">All years</option>
          {meta?.years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
      </div>
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-sunken p-1 sm:inline-flex">
        {STATUSES.map(([value, label]) => (
          <button
            key={value}
            onClick={() => set("status")(value)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              filters.status === value ? "bg-elev text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : data?.items.length ? (
        <div className="space-y-4">
          {data.items.map((item, i) => (
            <Reveal key={item.id} delay={Math.min(i, 4) * 0.04}>
              <PyqCard
                item={item}
                onError={setFailed}
                onChange={(next) => {
                  setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === next.id ? next : x)) } : d));
                  void reloadStats();
                }}
                onRemoved={() => {
                  setFailed(null);
                  // Refetch rather than only splicing: the page is server-paginated, so dropping a row
                  // locally would leave a short page (and an empty one on the last page).
                  if (data && data.items.length === 1 && page > 1) setPage(page - 1);
                  else reload();
                  void reloadStats();
                }}
              />
            </Reveal>
          ))}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted">
              Page {page} of {pages} · {data.total} questions
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState icon={<BookOpenCheck className="h-5 w-5" />} title="No questions match" body="Try a different filter, or ask an admin to upload PYQ papers." />
      )}
    </>
  );
}
