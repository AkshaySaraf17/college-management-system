import { useEffect, useMemo, useState } from "react";
import { api, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useBatches, useBatchSubjects, useTeaching } from "../../hooks/useCatalog";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Field, Input, PageHeader, Select } from "../../components/ui";
import { DataTable, Empty, Loading, Notice, Tabs, pct } from "../../components/kit";

const STATUSES = [["PRESENT", "P"], ["ABSENT", "A"], ["LATE", "L"], ["EXCUSED", "E"]] as const;

/** Picks a (batch, subject) pair: faculty choose from their allocations, admins/HODs from any batch. */
export function useClassPicker() {
  const { hasRole } = useAuth();
  const teachingOnly = hasRole("FACULTY") && !hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD", "PRINCIPAL");
  const teaching = useTeaching();
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const subjects = useBatchSubjects(teachingOnly ? null : batchId);

  const pairs = teaching.data ?? [];
  const pairKey = batchId && subjectId ? `${batchId}:${subjectId}` : "";

  const picker = teachingOnly ? (
    <Field label="Class">
      <Select value={pairKey} onChange={(e) => { const [b, s] = e.target.value.split(":"); setBatchId(b ?? ""); setSubjectId(s ?? ""); }}>
        <option value="">Select a class you teach</option>
        {pairs.map((p) => <option key={`${p.batchId}:${p.subjectId}`} value={`${p.batchId}:${p.subjectId}`}>{p.subjectName} · {p.courseName} · {p.batchName}</option>)}
      </Select>
    </Field>
  ) : (
    <>
      <Field label="Batch">
        <Select value={batchId} onChange={(e) => { setBatchId(e.target.value); setSubjectId(""); }}>
          <option value="">Select batch</option>
          {batches.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <Field label="Subject">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select subject</option>
          {subjects.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
    </>
  );
  return { batchId, subjectId, picker, noClasses: teachingOnly && !teaching.loading && pairs.length === 0 };
}

function Mark({ batchId, subjectId }: { batchId: string; subjectId: string }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState("1");
  const [topic, setTopic] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const roster = useGet<Row[]>(batchId && subjectId ? `/attendance/roster?batchId=${batchId}&subjectId=${subjectId}&date=${date}&period=${period}` : null);
  const n = useNotice();

  useEffect(() => {
    const initial: Record<string, string> = {};
    (roster.data ?? []).forEach((r) => { initial[r.studentId] = r.status ?? "PRESENT"; });
    setMarks(initial);
  }, [roster.data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(marks).forEach((s) => { c[s] = (c[s] ?? 0) + 1; });
    return c;
  }, [marks]);

  if (!batchId || !subjectId) return <Empty>Choose a class above to mark attendance.</Empty>;
  return (
    <div>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date"><Input type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Period"><Select value={period} onChange={(e) => setPeriod(e.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8].map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Topic covered"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Optional" /></Field>
        </div>
      </Card>
      <Notice error={n.error} success={n.success} />
      {roster.loading ? <Loading /> : (roster.data ?? []).length === 0 ? <Empty>No active students in this batch.</Empty> : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Button variant="secondary" onClick={() => setMarks(Object.fromEntries((roster.data ?? []).map((r) => [r.studentId, "PRESENT"])))}>Mark all present</Button>
            <span>Present {counts.PRESENT ?? 0} · Absent {counts.ABSENT ?? 0} · Late {counts.LATE ?? 0} · Excused {counts.EXCUSED ?? 0}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {(roster.data ?? []).map((r) => (
              <div key={r.studentId} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{r.fullName}</p>
                  <p className="font-mono text-xs text-slate-500">{r.rollNumber}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {STATUSES.map(([value, short]) => (
                    <button key={value} title={value} onClick={() => setMarks((m) => ({ ...m, [r.studentId]: value }))}
                      className={`h-8 w-8 rounded-md border text-xs font-semibold ${marks[r.studentId] === value
                        ? value === "ABSENT" ? "border-red-600 bg-red-600 text-white" : "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100"}`}>
                      {short}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button disabled={n.busy} onClick={() => n.run(
              () => api.post("/attendance/mark", { subjectId: Number(subjectId), batchId: Number(batchId), date, period: Number(period), topic: topic || null,
                records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) }),
              "Attendance saved. Absent students were notified.", roster.reload)}>
              {n.busy ? "Saving..." : "Save attendance"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ batchId, subjectId }: { batchId: string; subjectId: string }) {
  const { data, loading } = useGet<Row[]>(batchId ? `/attendance/batch-summary?batchId=${batchId}${subjectId ? `&subjectId=${subjectId}` : ""}` : null);
  if (!batchId) return <Empty>Choose a class above.</Empty>;
  return (
    <DataTable loading={loading} rows={data ?? []} rowKey={(r) => r.studentId} empty="No students."
      columns={[
        { key: "rollNumber", label: "Roll no.", render: (r) => <span className="font-mono text-xs">{r.rollNumber}</span> },
        { key: "fullName", label: "Student" },
        { key: "attended", label: "Attended / held", render: (r) => `${r.attended} / ${r.totalClasses}` },
        { key: "percentage", label: "Attendance", render: (r) => <span className={r.belowThreshold ? "font-semibold text-red-600" : ""}>{pct(r.percentage)}{r.belowThreshold ? " (low)" : ""}</span> },
      ]} />
  );
}

export function MarkAttendancePage() {
  const { batchId, subjectId, picker, noClasses } = useClassPicker();
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark attendance period by period and review students falling below 75%." />
      {noClasses ? <Empty>No subjects have been allocated to you yet. Ask your HOD or the college admin to allocate your subjects.</Empty> : (
        <>
          <Card className="mb-6"><div className="grid gap-3 sm:grid-cols-2">{picker}</div></Card>
          <Tabs tabs={[
            { id: "mark", label: "Mark attendance", content: <Mark key={`${batchId}:${subjectId}`} batchId={batchId} subjectId={subjectId} /> },
            { id: "summary", label: "Class summary", content: <Summary key={`${batchId}:${subjectId}`} batchId={batchId} subjectId={subjectId} /> },
          ]} />
        </>
      )}
    </div>
  );
}
