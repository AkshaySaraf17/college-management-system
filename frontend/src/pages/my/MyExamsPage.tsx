import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet } from "../../hooks/useLoad";
import { Card, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, ErrorBanner, PrintButton, fmtDate, fmtTime } from "../../components/kit";
import type { Row } from "../../api/client";

function Content({ student }: { student: Row }) {
  const { hasRole } = useAuth();
  const { data, loading, error } = useGet<Row[]>(`/exams/my?studentId=${student.id}`);
  const today = new Date().toISOString().slice(0, 10);
  const rows = data ?? [];

  return (
    <>
      <ErrorBanner message={error} />
      <DataTable
        loading={loading}
        rows={rows}
        rowKey={(r) => r.scheduleId}
        empty="No exams have been scheduled for your batch yet."
        columns={[
          { key: "examName", label: "Exam", render: (r) => <span className="font-medium">{r.examName}</span> },
          { key: "subjectName", label: "Subject", render: (r) => `${r.subjectName} (${r.subjectCode})` },
          { key: "examDate", label: "Date", render: (r) => fmtDate(r.examDate) },
          { key: "time", label: "Time", render: (r) => `${fmtTime(r.startTime)} - ${fmtTime(r.endTime)}` },
          { key: "room", label: "Room / mode", render: (r) => (r.isOnline ? `Online (${r.durationMinutes} min)` : (r.room ?? "-")) },
          { key: "marks", label: "Max / pass", render: (r) => `${r.maxMarks} / ${r.passMarks}` },
          {
            key: "action",
            label: "",
            render: (r) => {
              if (!r.isOnline) return null;
              if (r.submittedAt) return <StatusBadge status="ENROLLED" />;
              if (hasRole("STUDENT") && r.examDate === today && r.examStatus !== "RESULTS_PUBLISHED") {
                return (
                  <Link to={`/my/exams/${r.scheduleId}/take`} className="font-medium text-indigo-600 hover:underline">
                    Take exam
                  </Link>
                );
              }
              return <span className="text-xs text-slate-400">{r.examDate > today ? "Opens on exam day" : "Closed"}</span>;
            },
          },
        ]}
      />

      {rows.length > 0 && (
        <Card className="print-area mt-6">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Hall ticket</h2>
              <p className="text-sm text-slate-500">Carry this with your college ID card to each exam.</p>
            </div>
            <PrintButton label="Print hall ticket" />
          </div>
          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{student.fullName}</dd></div>
            <div><dt className="text-slate-500">Roll number</dt><dd className="font-medium">{student.rollNumber}</dd></div>
            <div><dt className="text-slate-500">Course</dt><dd className="font-medium">{student.courseName}</dd></div>
            <div><dt className="text-slate-500">Batch</dt><dd className="font-medium">{student.batchName}</dd></div>
          </dl>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr><th className="py-1">Subject</th><th>Date</th><th>Time</th><th>Venue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.scheduleId}>
                  <td className="py-1.5">{r.subjectName}</td>
                  <td>{fmtDate(r.examDate)}</td>
                  <td>{fmtTime(r.startTime)} - {fmtTime(r.endTime)}</td>
                  <td>{r.isOnline ? "Online" : (r.room ?? "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

export function MyExamsPage() {
  return (
    <div>
      <PageHeader title="Exams & hall tickets" subtitle="Your exam schedule. Online exams open on the day of the exam." />
      <WithStudent>{(s) => <Content key={s.id} student={s} />}</WithStudent>
    </div>
  );
}
