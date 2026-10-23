import { useState } from "react";
import { api, downloadFile, uploadFile, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, PageHeader, StatusBadge } from "../../components/ui";
import { Empty, ErrorBanner, Loading, Notice, Tabs, Textarea, fmtDate, fmtDateTime } from "../../components/kit";

function Assignment({ a, canSubmit, onDone }: { a: Row; canSubmit: boolean; onDone: () => void }) {
  const [content, setContent] = useState(a.content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const n = useNotice();
  const graded = a.gradedAt !== null;

  const submit = () =>
    n.run(
      async () => {
        const stored = file ? await uploadFile(file) : null;
        await api.post(`/lms/assignments/${a.id}/submit`, { content, fileId: stored?.id ?? a.fileId ?? null });
      },
      "Submitted.",
      async () => {
        setEditing(false);
        onDone();
      },
    );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{a.title}</p>
          <p className="text-xs text-slate-500">{a.subjectName} · due {fmtDate(a.dueDate)} · {a.maxMarks} marks</p>
        </div>
        {graded ? <StatusBadge status="ENROLLED" label="Graded" /> : a.submissionId ? <StatusBadge status={a.late ? "PENDING" : "SUBMITTED"} label={a.late ? "Submitted late" : "Submitted"} /> : a.missed ? <StatusBadge status="REJECTED" label="Missed" /> : <StatusBadge status="PENDING" label="To do" />}
      </div>
      {a.description && <p className="mt-2 text-sm text-slate-600">{a.description}</p>}
      {a.submissionId && (
        <p className="mt-2 text-xs text-slate-500">
          Submitted {fmtDateTime(a.submittedAt)}{a.late ? " (late)" : ""}
          {a.fileId && <> · <button className="text-indigo-600 hover:underline" onClick={() => downloadFile(`/api/files/${a.fileId}`, "submission")}>your file</button></>}
        </p>
      )}
      {graded && (
        <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Score: <span className="font-semibold">{Number(a.marks)}/{a.maxMarks}</span>{a.feedback && <> · {a.feedback}</>}
        </p>
      )}
      {canSubmit && !graded && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {a.submissionId && !editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit submission</Button>
          ) : (
            <div className="space-y-2">
              <Notice error={n.error} success={n.success} />
              <Textarea rows={3} className="w-full" placeholder="Write your answer..." value={content} onChange={(e) => setContent(e.target.value)} />
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-sm" />
              <Button disabled={n.busy} onClick={submit}>{n.busy ? "Submitting..." : a.submissionId ? "Resubmit" : "Submit"}</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Content({ studentId }: { studentId: string }) {
  const { hasRole } = useAuth();
  const assignments = useGet<Row[]>(`/lms/assignments/my?studentId=${studentId}`);
  const materials = useGet<Row[]>(`/lms/materials?studentId=${studentId}`);

  return (
    <Tabs
      tabs={[
        {
          id: "assignments",
          label: `Assignments${assignments.data ? ` (${assignments.data.filter((a) => !a.submissionId).length} pending)` : ""}`,
          content: assignments.loading ? <Loading /> : (
            <>
              <ErrorBanner message={assignments.error} />
              {(assignments.data ?? []).length === 0 ? <Empty>No assignments yet.</Empty> : (
                <div className="space-y-4">{(assignments.data ?? []).map((a) => <Assignment key={a.id} a={a} canSubmit={hasRole("STUDENT")} onDone={assignments.reload} />)}</div>
              )}
            </>
          ),
        },
        {
          id: "materials",
          label: "Study materials",
          content: materials.loading ? <Loading /> : (
            <>
              <ErrorBanner message={materials.error} />
              {(materials.data ?? []).length === 0 ? <Empty>No materials shared yet.</Empty> : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(materials.data ?? []).map((m) => (
                    <Card key={m.id}>
                      <p className="font-medium text-slate-900">{m.title}</p>
                      <p className="text-xs text-slate-500">{m.subjectName} · {m.uploadedByName} · {fmtDate(m.createdAt)}</p>
                      {m.description && <p className="mt-1 text-sm text-slate-600">{m.description}</p>}
                      <div className="mt-2 flex gap-3 text-sm">
                        {m.fileId && <button className="font-medium text-indigo-600 hover:underline" onClick={() => downloadFile(`/api/files/${m.fileId}`, m.fileName ?? "material")}>Download {m.fileName}</button>}
                        {m.linkUrl && <a className="font-medium text-indigo-600 hover:underline" href={m.linkUrl} target="_blank" rel="noopener noreferrer">Open link</a>}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ),
        },
      ]}
    />
  );
}

export function MyLearningPage() {
  return (
    <div>
      <PageHeader title="Assignments & materials" subtitle="Submit work, see grades and feedback, and download study materials." />
      <WithStudent>{(s) => <Content key={s.id} studentId={s.id} />}</WithStudent>
    </div>
  );
}
