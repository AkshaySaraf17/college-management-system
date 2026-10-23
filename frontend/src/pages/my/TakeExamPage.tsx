import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage, unwrap, type Row } from "../../api/client";
import { Button, Card, PageHeader } from "../../components/ui";
import { ErrorBanner, Loading } from "../../components/kit";

export function TakeExamPage() {
  const { scheduleId } = useParams();
  const [paper, setPaper] = useState<Row | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    unwrap<Row>(api.post(`/exams/schedules/${scheduleId}/start`))
      .then(setPaper)
      .catch((e) => setError(errorMessage(e)));
  }, [scheduleId]);

  const submit = useCallback(async () => {
    if (submitted.current || !paper) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const payload = paper.questions.map((q: Row) => ({ questionId: q.id, selected: answersRef.current[q.id] ?? null }));
      setResult(await unwrap<Row>(api.post(`/exams/schedules/${scheduleId}/submit`, { answers: payload })));
    } catch (e) {
      submitted.current = false;
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [paper, scheduleId]);

  useEffect(() => {
    if (!paper || result) return;
    const end = new Date(paper.startedAt).getTime() + paper.durationMinutes * 60_000;
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [paper, result, submit]);

  if (result) {
    return (
      <div>
        <PageHeader title="Exam submitted" />
        <Card className="max-w-md">
          <p className="text-sm text-slate-600">Your answers were auto-graded.</p>
          <p className="my-3 text-3xl font-semibold text-slate-900">
            {Number(result.marksObtained)} <span className="text-lg font-normal text-slate-500">/ {result.maxMarks}</span>
          </p>
          <p className="mb-4 text-xs text-slate-500">Official results (grade and SGPA) appear after the college publishes them.</p>
          <Link to="/my/exams" className="text-sm font-medium text-indigo-600 hover:underline">Back to exams</Link>
        </Card>
      </div>
    );
  }
  if (error && !paper) {
    return (
      <div>
        <PageHeader title="Online exam" />
        <ErrorBanner message={error} />
        <Link to="/my/exams" className="text-sm font-medium text-indigo-600 hover:underline">Back to exams</Link>
      </div>
    );
  }
  if (!paper) return <Loading what="Preparing your paper" />;

  const mm = String(Math.floor((remaining ?? 0) / 60)).padStart(2, "0");
  const ss = String((remaining ?? 0) % 60).padStart(2, "0");
  const answered = Object.keys(answers).length;

  return (
    <div>
      <PageHeader title="Online exam" subtitle={`${answered} of ${paper.questions.length} answered. The paper submits automatically when time runs out.`}
        action={<span className={`rounded-md px-3 py-1.5 font-mono text-lg ${(remaining ?? 0) < 120 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-800"}`}>{mm}:{ss}</span>} />
      <ErrorBanner message={error} />
      <div className="space-y-4">
        {paper.questions.map((q: Row, i: number) => (
          <Card key={q.id}>
            <p className="mb-3 text-sm font-medium text-slate-900">{i + 1}. {q.questionText} <span className="text-xs font-normal text-slate-400">({q.marks} mark{q.marks > 1 ? "s" : ""})</span></p>
            <div className="space-y-1.5">
              {(["A", "B", "C", "D"] as const).map((opt) => {
                const text = q[`option${opt}`];
                if (!text) return null;
                return (
                  <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    <input type="radio" name={`q${q.id}`} checked={answers[q.id] === opt} onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))} />
                    <span className="font-medium text-slate-500">{opt}.</span> {text}
                  </label>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit exam"}</Button>
      </div>
    </div>
  );
}
