import { useEffect, useState } from "react";
import { api, type Row } from "../../api/client";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge } from "../../components/ui";
import { Empty, Loading, Notice, Tabs, fmtDate } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

function Sheet({ scheduleId }: { scheduleId: number }) {
  const { data, loading, error, reload } = useGet<Row>(`/results/schedule/${scheduleId}/sheet`);
  const [marks, setMarks] = useState<Record<string, { marks: string; absent: boolean }>>({});
  const n = useNotice();

  useEffect(() => {
    const m: typeof marks = {};
    (data?.rows ?? []).forEach((r: Row) => { m[r.studentId] = { marks: r.marksObtained === null ? "" : String(Number(r.marksObtained)), absent: !!r.absent }; });
    setMarks(m);
  }, [data]);

  if (loading) return <Loading />;
  if (!data) return <p className="text-sm text-red-600">{error}</p>;
  const published = data.examStatus === "RESULTS_PUBLISHED";

  const save = () =>
    n.run(() => api.put(`/results/schedule/${scheduleId}`, {
      entries: Object.entries(marks).filter(([, v]) => v.absent || v.marks !== "").map(([studentId, v]) => ({ studentId, marks: v.absent ? null : Number(v.marks), absent: v.absent })),
    }), "Marks saved.", reload);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">{data.examName} · {data.subjectName} · maximum {data.maxMarks}, pass {data.passMarks}{published && " · results published (read only)"}</p>
      <Notice error={n.error} success={n.success} />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {data.rows.map((r: Row) => {
          const m = marks[r.studentId] ?? { marks: "", absent: false };
          return (
            <div key={r.studentId} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{r.fullName}</p>
                <p className="font-mono text-xs text-slate-500">{r.rollNumber}{r.grade && ` · ${r.grade}`}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" disabled={published} checked={m.absent} onChange={(e) => setMarks((s) => ({ ...s, [r.studentId]: { marks: "", absent: e.target.checked } }))} /> Absent</label>
                <Input type="number" min={0} max={data.maxMarks} step="0.5" disabled={published || m.absent} className="w-24" value={m.marks}
                  onChange={(e) => setMarks((s) => ({ ...s, [r.studentId]: { marks: e.target.value, absent: false } }))} />
              </div>
            </div>
          );
        })}
      </div>
      {!published && <div className="mt-4"><Button disabled={n.busy} onClick={save}>{n.busy ? "Saving..." : "Save marks"}</Button></div>}
    </div>
  );
}

function QuestionBank({ scheduleId }: { scheduleId: number }) {
  const { data, loading, reload } = useGet<Row[]>(`/exams/schedules/${scheduleId}/questions`);
  const n = useNotice();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <Notice error={n.error} success={n.success} />
        <FormCard title="Add a multiple-choice question" busy={n.busy} submitLabel="Add question"
          fields={[
            { name: "questionText", label: "Question", type: "textarea", required: true },
            { name: "optionA", label: "Option A", required: true }, { name: "optionB", label: "Option B", required: true },
            { name: "optionC", label: "Option C" }, { name: "optionD", label: "Option D" },
            { name: "correctOption", label: "Correct answer", type: "select", required: true, options: ["A", "B", "C", "D"].map((v) => ({ value: v, label: v })) },
            { name: "marks", label: "Marks", type: "number", min: 1, defaultValue: 1 },
          ]}
          onSubmit={(v) => n.run(() => api.post(`/exams/schedules/${scheduleId}/questions`, v), "Question added.", reload)} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Question paper ({(data ?? []).length} questions)</h3>
        {loading ? <Loading /> : (data ?? []).length === 0 ? <Empty>No questions yet. Students cannot start the exam until you add some.</Empty> : (
          <ol className="space-y-2">
            {(data ?? []).map((q, i) => (
              <li key={q.id}><Card>
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{i + 1}. {q.questionText}</p>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/exams/questions/${q.id}`), undefined, reload)}>Remove</button>
                </div>
                <p className="mt-1 text-xs text-slate-500">Answer: {q.correctOption} · {q.marks} mark(s)</p>
              </Card></li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function MarksEntryPage() {
  const exams = useGet<Row[]>("/exams");
  const [examId, setExamId] = useState("");
  const exam = useGet<Row>(examId ? `/exams/${examId}` : null);
  const [scheduleId, setScheduleId] = useState("");
  const schedule = exam.data?.schedules?.find((s: Row) => String(s.id) === scheduleId);

  return (
    <div>
      <PageHeader title="Marks & online exams" subtitle="Enter marks for a paper, or build the question bank for an online exam." />
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Exam">
            <Select value={examId} onChange={(e) => { setExamId(e.target.value); setScheduleId(""); }}>
              <option value="">Select exam</option>
              {(exams.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.batchName}{e.status === "RESULTS_PUBLISHED" ? " (published)" : ""}</option>)}
            </Select>
          </Field>
          <Field label="Paper">
            <Select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} disabled={!examId}>
              <option value="">Select paper</option>
              {(exam.data?.schedules ?? []).map((s: Row) => <option key={s.id} value={s.id}>{s.subjectName} · {fmtDate(s.examDate)}{s.isOnline ? " (online)" : ""}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      {!schedule ? <Empty>Choose an exam and paper.</Empty> : (
        <Tabs key={schedule.id} tabs={[
          { id: "marks", label: "Marks sheet", content: <Sheet scheduleId={schedule.id} /> },
          ...(schedule.isOnline ? [{ id: "questions", label: "Online question bank", content: <QuestionBank scheduleId={schedule.id} /> }] : []),
        ]} />
      )}
      {exam.data && <p className="mt-6 text-xs text-slate-400">Exam status: <StatusBadge status={exam.data.status} /> — published by the exam office / HOD.</p>}
    </div>
  );
}
