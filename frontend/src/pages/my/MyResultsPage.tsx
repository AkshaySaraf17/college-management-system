import { WithStudent } from "../../auth/ActiveStudent";
import { useGet } from "../../hooks/useLoad";
import { Card, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, Empty, ErrorBanner, Loading, PrintButton, RiskBadge, Stat } from "../../components/kit";
import type { Row } from "../../api/client";

export function InsightCard({ studentId }: { studentId: string }) {
  const { data, loading, error } = useGet<Row>(`/analytics/student/${studentId}`);
  if (loading) return <Card><Loading what="Analysing performance" /></Card>;
  if (!data) return <Card><p className="text-sm text-slate-400">{error ?? "Performance insight is unavailable right now."}</p></Card>;
  const a = data.analysis;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">AI performance insight</h2>
        <RiskBadge level={a.risk_level} />
      </div>
      <p className="mb-3 text-sm text-slate-600">
        Risk score <span className="font-semibold">{a.risk_score}</span>/100 (confidence {a.confidence.toLowerCase()}).
        {a.predicted_next_score !== null && <> Forecast for your next exam: <span className="font-semibold">{a.predicted_next_score}%</span>.</>}
      </p>
      <ul className="mb-3 space-y-1 text-sm text-slate-600">
        {a.factors.filter((f: Row) => f.points > 0).map((f: Row) => (
          <li key={f.factor}><span className="font-medium text-slate-800">{f.factor}</span> (+{f.points}): {f.detail}</li>
        ))}
      </ul>
      <ul className="list-inside list-disc text-sm text-slate-700">
        {a.recommendations.map((r: string) => <li key={r}>{r}</li>)}
      </ul>
    </Card>
  );
}

function Content({ student }: { student: Row }) {
  const { data, loading, error } = useGet<Row>(`/results/student/${student.id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBanner message={error} />;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="CGPA" value={data.cgpa ?? "-"} hint="Credit-weighted, final exams" tone={data.cgpa && Number(data.cgpa) >= 8 ? "good" : "default"} />
        <Stat label="Semesters graded" value={data.semesters.length} />
        <Stat label="Exams published" value={data.exams.length} />
        <Stat label="Backlogs" value={data.semesters.filter((s: Row) => s.status === "BACKLOG").length} tone={data.semesters.some((s: Row) => s.status === "BACKLOG") ? "bad" : "good"} />
      </div>

      <Card className="print-area mb-6">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Academic transcript</h2>
            <p className="text-sm text-slate-500">{student.fullName} · {student.rollNumber} · {student.courseName}</p>
          </div>
          <PrintButton label="Print transcript" />
        </div>
        {data.semesters.length > 0 && (
          <table className="mb-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Semester</th><th>SGPA</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.semesters.map((s: Row) => (
                <tr key={s.semesterName}><td className="py-1.5">{s.semesterName}</td><td>{s.sgpa ?? "-"}</td><td><StatusBadge status={s.status} /></td></tr>
              ))}
            </tbody>
          </table>
        )}
        {data.exams.length === 0 && <Empty>No results have been published yet.</Empty>}
        {data.exams.map((exam: Row) => (
          <div key={exam.examId} className="mb-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-800">{exam.examName} <span className="font-normal text-slate-500">· {exam.semesterName} · {exam.examType}</span></h3>
            <DataTable
              rows={exam.results}
              rowKey={(r) => r.subjectCode}
              columns={[
                { key: "subjectName", label: "Subject", render: (r) => `${r.subjectName} (${r.subjectCode})` },
                { key: "credits", label: "Credits" },
                { key: "marks", label: "Marks", render: (r) => (r.resultStatus === "ABSENT" ? "Absent" : `${Number(r.marksObtained)} / ${r.maxMarks}`) },
                { key: "grade", label: "Grade", render: (r) => <span className="font-semibold">{r.grade}</span> },
                { key: "gp", label: "Points", render: (r) => r.gradePoints },
                { key: "resultStatus", label: "Result", render: (r) => <StatusBadge status={r.resultStatus === "PASS" ? "ACTIVE" : "REJECTED"} label={r.resultStatus[0] + r.resultStatus.slice(1).toLowerCase()} /> },
              ]}
            />
          </div>
        ))}
        {data.cgpa !== null && <p className="text-sm font-semibold text-slate-900">Cumulative GPA: {data.cgpa}</p>}
      </Card>
      <InsightCard studentId={student.id} />
    </>
  );
}

export function MyResultsPage() {
  return (
    <div>
      <PageHeader title="Results" subtitle="Published results, SGPA/CGPA, and an AI-generated performance insight." />
      <WithStudent>{(s) => <Content key={s.id} student={s} />}</WithStudent>
    </div>
  );
}
