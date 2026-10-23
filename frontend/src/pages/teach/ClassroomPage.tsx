import { useRef, useState } from "react";
import { api, downloadFile, uploadFile, type Row } from "../../api/client";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Input, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, Empty, Loading, Notice, Tabs, fmtDate, fmtDateTime } from "../../components/kit";
import { FormCard } from "../../components/FormCard";
import { useClassPicker } from "./MarkAttendancePage";

function Submissions({ assignment, onClose }: { assignment: Row; onClose: () => void }) {
  const { data, loading, reload } = useGet<Row[]>(`/lms/assignments/${assignment.id}/submissions`);
  const [drafts, setDrafts] = useState<Record<number, { marks: string; feedback: string }>>({});
  const n = useNotice();
  return (
    <Card className="mt-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{assignment.title} - submissions</h3>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
      <Notice error={n.error} success={n.success} />
      {loading ? <Loading /> : (
        <div className="space-y-3">
          {(data ?? []).map((s) => {
            const d = drafts[s.submissionId] ?? { marks: s.marks === null ? "" : String(Number(s.marks)), feedback: s.feedback ?? "" };
            return (
              <div key={s.studentId} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{s.studentName} <span className="font-mono text-xs text-slate-500">{s.rollNumber}</span></p>
                  {s.submissionId ? <StatusBadge status={s.gradedAt ? "ENROLLED" : s.late ? "PENDING" : "SUBMITTED"} label={s.gradedAt ? "Graded" : s.late ? "Late" : "Submitted"} /> : <StatusBadge status="REJECTED" label="Not submitted" />}
                </div>
                {s.submissionId ? (
                  <>
                    <p className="mt-1 text-xs text-slate-500">{fmtDateTime(s.submittedAt)}{s.late ? " (late)" : ""}</p>
                    {s.content && <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm text-slate-700">{s.content}</p>}
                    {s.fileId && <button className="mt-1 text-sm font-medium text-indigo-600 hover:underline" onClick={() => downloadFile(`/api/files/${s.fileId}`, s.fileName ?? "file")}>Download {s.fileName}</button>}
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <Input type="number" step="0.5" min={0} max={assignment.maxMarks} placeholder={`/ ${assignment.maxMarks}`} className="w-28" value={d.marks} onChange={(e) => setDrafts((x) => ({ ...x, [s.submissionId]: { ...d, marks: e.target.value } }))} />
                      <Input placeholder="Feedback" className="min-w-[200px] flex-1" value={d.feedback} onChange={(e) => setDrafts((x) => ({ ...x, [s.submissionId]: { ...d, feedback: e.target.value } }))} />
                      <Button disabled={n.busy || d.marks === ""} onClick={() => n.run(() => api.patch(`/lms/submissions/${s.submissionId}/grade`, { marks: Number(d.marks), feedback: d.feedback }), "Graded.", reload)}>Grade</Button>
                    </div>
                  </>
                ) : <p className="mt-1 text-xs text-slate-400">Not submitted</p>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Assignments({ batchId, subjectId }: { batchId: string; subjectId: string }) {
  const { data, loading, reload } = useGet<Row[]>(batchId ? `/lms/assignments?batchId=${batchId}${subjectId ? `&subjectId=${subjectId}` : ""}` : null);
  const [open, setOpen] = useState<Row | null>(null);
  const n = useNotice();
  if (!batchId || !subjectId) return <Empty>Choose a class above.</Empty>;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <DataTable loading={loading} rows={data ?? []} empty="No assignments posted for this class."
          columns={[
            { key: "title", label: "Assignment", render: (r) => <span className="font-medium">{r.title}</span> },
            { key: "dueDate", label: "Due", render: (r) => fmtDate(r.dueDate) },
            { key: "submissions", label: "Submitted", render: (r) => `${r.submissions} / ${r.classSize} (${r.graded} graded)` },
            { key: "a", label: "", render: (r) => (
              <div className="flex gap-3 text-sm">
                <button className="font-medium text-indigo-600 hover:underline" onClick={() => setOpen(r)}>Review</button>
                <button className="text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/lms/assignments/${r.id}`), "Removed.", reload)}>Delete</button>
              </div>
            ) },
          ]} />
        {open && <Submissions key={open.id} assignment={open} onClose={() => setOpen(null)} />}
      </div>
      <div>
        <Notice error={n.error} success={n.success} />
        <FormCard title="Post an assignment" busy={n.busy} submitLabel="Post & notify class"
          fields={[
            { name: "title", label: "Title", required: true }, { name: "description", label: "Instructions", type: "textarea" },
            { name: "dueDate", label: "Due date", type: "date", required: true }, { name: "maxMarks", label: "Maximum marks", type: "number", defaultValue: 10, min: 1, required: true },
          ]}
          onSubmit={(v) => n.run(() => api.post("/lms/assignments", { ...v, batchId: Number(batchId), subjectId: Number(subjectId) }), "Assignment posted.", reload)} />
      </div>
    </div>
  );
}

function Materials({ batchId, subjectId }: { batchId: string; subjectId: string }) {
  const { data, loading, reload } = useGet<Row[]>(batchId && subjectId ? `/lms/materials?subjectId=${subjectId}&batchId=${batchId}` : null);
  const file = useRef<File | null>(null);
  const n = useNotice();
  if (!batchId || !subjectId) return <Empty>Choose a class above.</Empty>;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <DataTable loading={loading} rows={data ?? []} empty="No materials shared for this class yet."
          columns={[
            { key: "title", label: "Material", render: (r) => <span className="font-medium">{r.title}</span> },
            { key: "what", label: "Content", render: (r) => (r.fileId ? r.fileName : r.linkUrl) },
            { key: "createdAt", label: "Shared", render: (r) => fmtDate(r.createdAt) },
            { key: "a", label: "", render: (r) => <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/lms/materials/${r.id}`), "Removed.", reload)}>Delete</button> },
          ]} />
      </div>
      <div>
        <Notice error={n.error} success={n.success} />
        <FormCard title="Share study material" busy={n.busy} submitLabel="Share"
          fields={[{ name: "title", label: "Title", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "linkUrl", label: "Link (https://...)", placeholder: "Or attach a file below" }]}
          onSubmit={(v) => n.run(async () => {
            const stored = file.current ? await uploadFile(file.current) : null;
            await api.post("/lms/materials", { ...v, batchId: Number(batchId), subjectId: Number(subjectId), fileId: stored?.id ?? null });
            file.current = null;
          }, "Shared with the class.", reload)} />
        <input type="file" className="mt-2 block text-sm" onChange={(e) => { file.current = e.target.files?.[0] ?? null; }} />
      </div>
    </div>
  );
}

export function ClassroomPage() {
  const { batchId, subjectId, picker, noClasses } = useClassPicker();
  return (
    <div>
      <PageHeader title="Classroom" subtitle="Post assignments, grade submissions, and share study materials." />
      {noClasses ? <Empty>No subjects have been allocated to you yet.</Empty> : (
        <>
          <Card className="mb-6"><div className="grid gap-3 sm:grid-cols-2">{picker}</div></Card>
          <Tabs tabs={[
            { id: "assignments", label: "Assignments", content: <Assignments key={`${batchId}:${subjectId}`} batchId={batchId} subjectId={subjectId} /> },
            { id: "materials", label: "Study materials", content: <Materials key={`${batchId}:${subjectId}`} batchId={batchId} subjectId={subjectId} /> },
          ]} />
        </>
      )}
    </div>
  );
}

