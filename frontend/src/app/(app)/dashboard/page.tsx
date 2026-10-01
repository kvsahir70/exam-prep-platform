"use client";

import { Activity, ArrowRight, Award, BookOpenCheck, Clock, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, Reveal, Ring, Skeleton, StatCard } from "@/components/ui";
import type { Dashboard } from "@/lib/api";
import { formatDate, useApi } from "@/lib/hooks";

const tooltipStyle = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--fg)",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { data, loading } = useApi<Dashboard>("/api/dashboard");

  if (loading || !data)
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const t = data.totals;
  const pyqPct = data.pyq.total ? (100 * data.pyq.solved) / data.pyq.total : 0;
  const trend = data.trend.map((p, i) => ({ ...p, idx: `#${i + 1}` }));

  return (
    <>
      <PageHeader
        title={
          <>
            {greeting()}, <span className="text-gradient">{data.user.name.split(" ")[0]}</span>
          </>
        }
        subtitle="Here is how your preparation is going."
        actions={
          <Button href="/tests">
            Take a test <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tests taken" value={t.tests_taken} icon={<Activity className="h-4 w-4" />} sub={`${t.hours_practiced} h practised`} />
        <StatCard label="Average score" value={`${t.avg_percent}%`} icon={<TrendingUp className="h-4 w-4" />} sub="across all tests" delay={0.05} />
        <StatCard label="Best score" value={`${t.best_percent}%`} icon={<Award className="h-4 w-4" />} sub="personal best" delay={0.1} />
        <StatCard label="Accuracy" value={`${t.accuracy}%`} icon={<Target className="h-4 w-4" />} sub="correct / attempted" delay={0.15} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Performance trend</h2>
                <p className="text-xs text-subtle">Score % and accuracy over your last tests</p>
              </div>
            </div>
            {trend.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="score" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "var(--fg-subtle)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--fg-subtle)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.test_title ?? ""} />
                    <Area type="monotone" dataKey="percent" name="Score %" stroke="var(--brand)" strokeWidth={2.5} fill="url(#score)" />
                    <Area type="monotone" dataKey="accuracy" name="Accuracy %" stroke="var(--success)" strokeWidth={2} fill="none" strokeDasharray="5 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="No tests yet" body="Your trend appears after your first test." />
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card className="flex h-full flex-col p-6">
            <h2 className="font-semibold">PYQ progress</h2>
            <p className="text-xs text-subtle">Previous-year questions solved</p>
            <div className="my-6 flex justify-center">
              <Ring
                value={pyqPct}
                size={140}
                label={
                  <div>
                    <div className="text-2xl font-semibold tabular-nums">{data.pyq.solved}</div>
                    <div className="text-xs text-subtle">of {data.pyq.total}</div>
                  </div>
                }
              />
            </div>
            <div className="space-y-3">
              {data.pyq.by_subject.slice(0, 4).map((s) => (
                <div key={s.subject}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium">{s.subject}</span>
                    <span className="text-subtle">
                      {s.solved}/{s.total}
                    </span>
                  </div>
                  <ProgressBar value={s.total ? (100 * s.solved) / s.total : 0} tone="success" />
                </div>
              ))}
            </div>
            <Button variant="secondary" href="/pyq" className="mt-auto w-full" size="sm">
              <BookOpenCheck className="h-4 w-4" /> Practise PYQs
            </Button>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <Card className="h-full p-6">
            <h2 className="font-semibold">Section-wise accuracy</h2>
            <p className="mb-4 text-xs text-subtle">
              {data.weak_areas.length ? (
                <>
                  Focus next on <span className="font-medium text-danger">{data.weak_areas.join(", ")}</span>
                </>
              ) : (
                "Across all attempted tests"
              )}
            </p>
            {data.sections.length ? (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.sections} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--fg-subtle)" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-sunken)" }} />
                    <Bar dataKey="accuracy" name="Accuracy %" fill="var(--brand)" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={<Target className="h-5 w-5" />} title="Nothing to analyse yet" />
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Recent tests</h2>
              <Link href="/history" className="text-xs font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {data.recent.length ? (
              <ul className="divide-y divide-line">
                {data.recent.map((r) => (
                  <li key={r.attempt_id}>
                    <Link href={`/results/${r.attempt_id}`} className="flex items-center gap-4 py-3 transition hover:opacity-80">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
                        {Math.round(r.percent)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.test_title}</p>
                        <p className="text-xs text-subtle">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {formatDate(r.date)}
                        </p>
                      </div>
                      <Badge tone={r.accuracy >= 70 ? "success" : r.accuracy >= 40 ? "warning" : "danger"}>
                        {r.accuracy}% acc
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Activity className="h-5 w-5" />}
                title="No attempts yet"
                action={<Button href="/tests" size="sm">Browse tests</Button>}
              />
            )}
          </Card>
        </Reveal>
      </div>
    </>
  );
}
