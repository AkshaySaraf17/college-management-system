import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Row } from "../../api/client";
import { useBatches, useBatchSubjects } from "../../hooks/useCatalog";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, ErrorBanner, Loading, Notice, fmtDate, fmtTime, pct } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

export function ExamsAdminPage() {
  const exams = useGet<Row[]>("/exams");
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const subjects = useBatchSubjects(batchId);
  const semesters = Array.from(new Map((subjects.data ?? []).map((s) => [s.semesterId, s.semesterName])).entries()).map(([value, label]) => ({ value: value as number, label: label as string }));
  const n = useNotice();
  const year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  return (
    <div>
      <PageHeader title="Exams & results" subtitle="Schedule exams, set papers, and publish results. Only FINAL exams feed SGPA/CGPA." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable loading={exams.loading} rows={exams.data ?? []} empty="No exams scheduled yet."
            columns={[
              { key: "name", label: "Exam", render: (e) => <Link className="font-medium text-indigo-600 hover:underline" to={`/admin/exams/${e.id}`}>{e.name}</Link> },
              { key: "batchName", label: "Batch", render: (e) => `${e.batchName} · ${e.semesterName}` },
              { key: "examType", label: "Type" },
              { key: "dates", label: "Window", render: (e) => `${fmtDate(e.startDate)} - ${fmtDate(e.endDate)}` },
              { key: "scheduleCount", label: "Papers" },
              { key: "status", label: "Status", render: (e) => <StatusBadge status={e.status === "RESULTS_PUBLISHED" ? "ENROLLED" : e.status === "COMPLETED" ? "APPROVED" : "PENDING"} label={String(e.status).replaceAll("_", " ")} /> },
            ]} />
        </div>
        <div>
          <Notice error={n.error} success={n.success} />
          <Card className="mb-3">
            <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Batch</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">Select batch</option>{batches.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </Card>
          {batchId && (
            <FormCard key={batchId} title="Create an exam" busy={n.busy} submitLabel="Create exam"
              fields={[
                { name: "name", label: "Exam name", required: true, placeholder: "Semester 1 Finals" },
                { name: "examType", label: "Type", type: "select", required: true, options: ["INTERNAL", "MIDTERM", "FINAL", "ONLINE"].map((v) => ({ value: v, label: v })) },
                { name: "semesterId", label: "Semester", type: "select", required: true, options: semesters },
                { name: "academicYear", label: "Academic year", required: true, defaultValue: year },
                { name: "startDate", label: "Starts", type: "date", required: true }, { name: "endDate", label: "Ends", type: "date", required: true },
              ]}
              onSubmit={(v) => n.run(() => api.post("/exams", { ...v, batchId: Number(batchId) }), "Exam created.", exams.reload)} />
          )}
        </div>
      </div>
    </div>
  );
}

export function ExamDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useGet<Row>(`/exams/${id}`);
  const summary = useGet<Row[]>(data?.status === "RESULTS_PUBLISHED" ? `/results/exam/${id}/summary` : null);
  const subjects = useBatchSubjects(data?.batchId);
  const n = useNotice();
  if (loading) return <Loading />;
  if (!data) return <ErrorBanner message={error} />;
  const published = data.status === "RESULTS_PUBLISHED";
  const semesterSubjects = (subjects.data ?? []).filter((s) => s.semesterId === data.semesterId);

  return (
    <div>
      <PageHeader title={data.name} subtitle={`${data.batchName} · ${data.semesterName} · ${data.examType} · ${fmtDate(data.startDate)} to ${fmtDate(data.endDate)}`}
        action={<Link to="/admin/exams" className="text-sm text-indigo-600 hover:underline">All exams</Link>} />
      <Notice error={n.error} success={n.success} />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={published ? "ENROLLED" : "PENDING"} label={data.status.replaceAll("_", " ")} />
          {!published && (
            <>
              {data.status !== "ONGOING" && <Button variant="secondary" onClick={() => n.run(() => api.patch(`/exams/${id}/status`, { status: "ONGOING" }), "Marked as ongoing.", reload)}>Mark ongoing</Button>}
              {data.status !== "COMPLETED" && <Button variant="secondary" onClick={() => n.run(() => api.patch(`/exams/${id}/status`, { status: "COMPLETED" }), "Marked as completed.", reload)}>Mark completed</Button>}
              <Button disabled={n.busy} onClick={() => { if (confirm("Publish results? Marks can no longer be edited and students will be notified.")) n.run(() => api.post(`/results/exam/${id}/publish`), "Results published. Students and parents were notified.", reload); }}>Publish results</Button>
            </>
          )}
        </div>
        {!published && <p className="mt-2 text-xs text-slate-500">Publishing requires marks (or an absence) for every student in every paper.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Papers</h2>
          <DataTable rows={data.schedules} empty="No papers scheduled yet."
            columns={[
              { key: "subjectName", label: "Subject", render: (s) => `${s.subjectName} (${s.subjectCode})` },
              { key: "examDate", label: "Date", render: (s) => `${fmtDate(s.examDate)} ${fmtTime(s.startTime)}-${fmtTime(s.endTime)}` },
              { key: "room", label: "Venue", render: (s) => (s.isOnline ? `Online · ${s.durationMinutes} min` : s.room ?? "-") },
              { key: "marks", label: "Max / pass", render: (s) => `${s.maxMarks} / ${s.passMarks}` },
              { key: "a", label: "", render: (s) => !published && <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/exams/schedules/${s.id}`), "Paper removed.", reload)}>Remove</button> },
            ]} />
          {published && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Result summary</h2>
              <DataTable loading={summary.loading} rows={summary.data ?? []} rowKey={(r) => r.subjectName}
                columns={[
                  { key: "subjectName", label: "Subject" }, { key: "appeared", label: "Entries" },
                  { key: "pass", label: "Pass rate", render: (r) => pct(Number(r.appeared) ? (Number(r.passed) * 100) / Number(r.appeared) : null) },
                  { key: "failed", label: "Failed" }, { key: "absent", label: "Absent" },
                  { key: "averageMarks", label: "Average", render: (r) => `${r.averageMarks ?? "-"} / ${r.maxMarks}` },
                ]} />
            </div>
          )}
        </div>
        {!published && (
          <FormCard title="Add a paper" busy={n.busy} submitLabel="Schedule paper"
            fields={[
              { name: "subjectId", label: "Subject", type: "select", required: true, options: semesterSubjects.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })) },
              { name: "examDate", label: "Date", type: "date", required: true }, { name: "startTime", label: "Start", type: "time", required: true }, { name: "endTime", label: "End", type: "time", required: true },
              { name: "room", label: "Room / hall" }, { name: "maxMarks", label: "Maximum marks", type: "number", required: true, defaultValue: 100 }, { name: "passMarks", label: "Pass marks", type: "number", required: true, defaultValue: 40 },
              { name: "online", label: "Online (MCQ) exam", type: "checkbox" }, { name: "durationMinutes", label: "Duration (minutes, online only)", type: "number" },
            ]}
            onSubmit={(v) => n.run(() => api.post(`/exams/${id}/schedules`, { ...v, startTime: `${v.startTime}:00`.slice(0, 8), endTime: `${v.endTime}:00`.slice(0, 8) }), "Paper scheduled and batch notified.", reload)} />
        )}
      </div>
    </div>
  );
}
