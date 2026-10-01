"use client";

import { ClipboardList, Clock, Layers, ListChecks, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Card, EmptyState, Input, PageHeader, Reveal, Skeleton } from "@/components/ui";
import type { TestInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

export default function TestsPage() {
  const { data, loading } = useApi<TestInfo[]>("/api/tests");
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const tests = useMemo(
    () => (data ?? []).filter((t) => `${t.title} ${t.exam?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [data, q],
  );

  return (
    <>
      <PageHeader title="Test series" subtitle="Full-length and sectional tests built from uploaded papers." />
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests or exams" className="pl-9" />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : tests.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.04}>
              <Link href={`/tests/${t.id}`} className="group block h-full">
                <Card className="flex h-full flex-col p-5 transition duration-300 group-hover:-translate-y-1 group-hover:border-brand/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="flex gap-1.5">
                      {user?.role === "admin" && !t.is_published && <Badge tone="warning">Draft</Badge>}
                      {t.in_progress_attempt_id && <Badge tone="brand">In progress</Badge>}
                      {t.my_attempts > 0 && <Badge tone="success">Attempted</Badge>}
                    </div>
                  </div>
                  <h3 className="mt-4 font-semibold leading-snug">{t.title}</h3>
                  {t.exam && <p className="mt-0.5 text-xs text-subtle">{t.exam.name}</p>}
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" /> {t.question_count} Qs
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {t.duration_minutes} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" /> {t.sections.length} sections
                    </span>
                  </div>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No tests available yet"
          body={user?.role === "admin" ? "Upload a PDF and publish it as a test." : "Check back soon: your institute is adding tests."}
        />
      )}
    </>
  );
}
