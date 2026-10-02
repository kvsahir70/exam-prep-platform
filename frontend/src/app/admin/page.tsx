"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Eraser, FileText, Loader2, Plus, UploadCloud, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, ProgressBar, Reveal, Select, Skeleton } from "@/components/ui";
import { api, type DocumentInfo, type Exam } from "@/lib/api";
import { formatDate, useApi } from "@/lib/hooks";

function JobBadge({ doc }: { doc: DocumentInfo }) {
  const job = doc.latest_job;
  if (!job) return <Badge>No job</Badge>;
  if (job.status === "completed") return <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Extracted</Badge>;
  if (job.status === "failed") return <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> Failed</Badge>;
  return (
    <Badge tone="brand">
      <Loader2 className="h-3 w-3 animate-spin" /> {job.status === "queued" ? "Queued" : `${job.stage} ${Math.round(job.progress * 100)}%`}
    </Badge>
  );
}

function UploadPanel({
  exams,
  papers,
  onDone,
  onExamCreated,
}: {
  exams: Exam[];
  papers: DocumentInfo[];
  onDone: () => void;
  onExamCreated: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "test_series", exam_id: "", institution: "", year: "", solutions_for: "" });
  const [newExam, setNewExam] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file");
      return;
    }
    setError(null);
    setFile(f);
    if (!form.title) setForm((s) => ({ ...s, title: f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") }));
  };

  async function addExam() {
    if (!newExam.trim()) return;
    try {
      const exam = await api<Exam>("/api/exams", { method: "POST", json: { name: newExam.trim() } });
      setForm((s) => ({ ...s, exam_id: String(exam.id) }));
      setNewExam("");
      onExamCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a PDF first");
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const solutions = form.kind === "solutions";
    Object.entries(form).forEach(([k, v]) => {
      // A solutions PDF inherits exam and year from its paper; a paper has no "solutions for".
      if (!v || (solutions && ["exam_id", "year", "institution"].includes(k)) || (!solutions && k === "solutions_for")) return;
      body.append(k, v);
    });
    try {
      await api("/api/documents", { method: "POST", body });
      setFile(null);
      setForm({ ...form, title: "", year: "", solutions_for: "" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Upload a paper</h2>
      <p className="mb-5 text-xs text-subtle">
        Any layout works. Questions are extracted and published automatically; upload the answer key or solutions PDF
        separately as &ldquo;Solutions&rdquo;.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
            drag ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50 hover:bg-sunken",
          )}
        >
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = ""; // allow choosing the same file again
            }}
          />
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-brand" />
                <div className="text-left">
                  <p className="max-w-[200px] truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-subtle">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="rounded-lg p-1 text-subtle hover:bg-elev hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <UploadCloud className="mx-auto h-8 w-8 text-brand" />
                <p className="mt-2 text-sm font-medium">Drop a PDF here or click to browse</p>
                <p className="text-xs text-subtle">Test series, PYQ papers, scanned or digital</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Field label="Title">
          <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="JEE Main Mock Test 12" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="test_series">Test series</option>
              <option value="pyq">PYQ paper</option>
              <option value="solutions">Solutions / answer key</option>
            </Select>
          </Field>
          {form.kind !== "solutions" && (
            <Field label="Year">
              <Input type="number" min={1950} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Auto" />
            </Field>
          )}
        </div>
        {form.kind === "solutions" ? (
          <Field label="Solutions for" hint="Answers and explanations are attached to this paper's questions">
            <Select value={form.solutions_for} onChange={(e) => setForm({ ...form, solutions_for: e.target.value })}>
              <option value="">Match by title automatically</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
        <Field label="Exam">
          <Select value={form.exam_id} onChange={(e) => setForm({ ...form, exam_id: e.target.value })}>
            <option value="">Select exam</option>
            {exams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Input value={newExam} onChange={(e) => setNewExam(e.target.value)} placeholder="Add new exam (e.g. NEET UG)" />
          <Button type="button" variant="secondary" onClick={addExam} aria-label="Add exam">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Field label="Institution">
          <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Optional" />
        </Field>
          </>
        )}
        {error && <ErrorNote message={error} />}
        <Button type="submit" className="w-full" loading={busy} disabled={!file}>
          <UploadCloud className="h-4 w-4" /> Upload & extract
        </Button>
      </form>
    </Card>
  );
}

/**
 * Clearing hides a document from this list only — it is never deleted. Deleting
 * would cascade into the document's questions, any test built from them and
 * students' PYQ progress, so this keeps to the list. Cleared ids are remembered
 * per browser; anything uploaded later is not in the set, so new uploads still
 * appear here on their own.
 */
const CLEARED_KEY = "examforge.clearedDocuments";

// A tiny external store, so the value is read during render rather than set from
// an effect, and the server snapshot ("nothing cleared") stays hydration-safe.
let clearedListeners: (() => void)[] = [];
function subscribeCleared(onChange: () => void) {
  clearedListeners.push(onChange);
  return () => {
    clearedListeners = clearedListeners.filter((l) => l !== onChange);
  };
}

const EMPTY = "[]";
let cachedRaw = EMPTY;
let cachedIds: number[] = [];

/** Returns a stable array reference, which useSyncExternalStore requires. */
function readClearedIds(): number[] {
  let raw = EMPTY;
  try {
    raw = localStorage.getItem(CLEARED_KEY) ?? EMPTY;
  } catch {
    /* storage unavailable (private mode) */
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      cachedIds = Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
    } catch {
      cachedIds = [];
    }
  }
  return cachedIds;
}

function writeClearedIds(ids: number[]) {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* storage unavailable — the list still clears for this session */
  }
  clearedListeners.forEach((l) => l());
}

const SERVER_IDS: number[] = [];

export default function AdminPage() {
  const { data: docs, loading, reload } = useApi<DocumentInfo[]>("/api/documents");
  const { data: exams, reload: reloadExams } = useApi<Exam[]>("/api/exams");
  const clearedIds = useSyncExternalStore(subscribeCleared, readClearedIds, () => SERVER_IDS);
  const cleared = new Set(clearedIds);

  const clearOne = (id: number) => writeClearedIds([...clearedIds, id]);
  const clearList = () => writeClearedIds([...clearedIds, ...(docs ?? []).map((d) => d.id)]);

  const visibleDocs = docs?.filter((d) => !cleared.has(d.id));
  const hiddenCount = (docs?.length ?? 0) - (visibleDocs?.length ?? 0);

  const active = docs?.some((d) => d.latest_job && ["queued", "running"].includes(d.latest_job.status));
  const paperTitle = (id: number | null) => docs?.find((d) => d.id === id)?.title;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(reload, 2500);
    return () => clearInterval(t);
  }, [active, reload]);

  return (
    <>
      <PageHeader title="PDF extraction" subtitle="Upload papers and their solutions. Extracted questions are published to tests and the PYQ bank automatically." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Reveal>
          <UploadPanel
            exams={exams ?? []}
            papers={(docs ?? []).filter((d) => d.kind !== "solutions")}
            onDone={reload}
            onExamCreated={reloadExams}
          />
        </Reveal>
        <Reveal delay={0.05} className="min-w-0">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Documents</h2>
              <div className="flex items-center gap-3">
                {!!visibleDocs?.length && (
                  <button
                    onClick={clearList}
                    className="i-lift inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
            {loading && !docs ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : visibleDocs?.length ? (
              <ul className="space-y-2">
                {visibleDocs.map((d) => {
                  const job = d.latest_job;
                  const total = Object.entries(d.question_counts)
                    .filter(([k]) => k !== "flagged")
                    .reduce((a, [, v]) => a + v, 0);
                  return (
                    <li
                      key={d.id}
                      className="flex items-start gap-3 rounded-xl border border-line p-4 transition hover:border-brand/40 hover:bg-sunken"
                    >
                      <Link href={`/admin/documents/${d.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 truncate font-medium">{d.title}</p>
                            <Badge tone={d.kind === "pyq" ? "warning" : d.kind === "solutions" ? "brand" : "neutral"}>
                              {d.kind === "pyq" ? "PYQ" : d.kind === "solutions" ? "Solutions" : "Test series"}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-subtle">
                            {[d.exam?.name, d.institution?.name, d.year, `${d.page_count} pages`, formatDate(d.created_at)].filter(Boolean).join(" · ")}
                          </p>
                          {job && ["queued", "running"].includes(job.status) && (
                            <div className="mt-3">
                              <ProgressBar value={job.progress * 100} />
                            </div>
                          )}
                          {job?.status === "completed" && d.kind === "solutions" && (
                            <p className="mt-2 text-xs text-muted">
                              {d.answer_key_entries ?? 0} answers &amp; explanations ·{" "}
                              {paperTitle(d.solutions_for_id) ? <>for {paperTitle(d.solutions_for_id)}</> : "no paper linked"}
                            </p>
                          )}
                          {job?.status === "completed" && d.kind !== "solutions" && (
                            <p className="mt-2 text-xs text-muted">
                              {total} questions · <span className="text-success">{d.question_counts.approved ?? 0} published</span> ·{" "}
                              <span className="text-warning">{d.question_counts.flagged ?? 0} to check</span>
                              {d.solutions.length > 0 && <> · {d.solutions.length} solutions PDF</>}
                            </p>
                          )}
                          {job?.status === "failed" && <p className="mt-2 line-clamp-1 text-xs text-danger">{job.error}</p>}
                        </div>
                      </Link>
                      <JobBadge doc={d} />
                      <button
                        onClick={() => clearOne(d.id)}
                        title="Clear from this list"
                        aria-label={`Clear ${d.title} from this list`}
                        className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-subtle opacity-60 transition hover:bg-danger-soft hover:text-danger hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : hiddenCount > 0 ? (
              <EmptyState
                icon={<Eraser className="h-5 w-5" />}
                title="List cleared"
                body={`${hiddenCount} document${hiddenCount === 1 ? "" : "s"} cleared from this list. Nothing was deleted — new uploads appear here.`}
              />
            ) : (
              <EmptyState icon={<UploadCloud className="h-5 w-5" />} title="No documents yet" body="Upload your first test series or PYQ PDF." />
            )}
          </Card>
        </Reveal>
      </div>
    </>
  );
}
