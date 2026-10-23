import { useState } from "react";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet } from "../../hooks/useLoad";
import { Card, Input, PageHeader, StatusBadge } from "../../components/ui";
import { Bars, DataTable, ErrorBanner, Loading, Stat, fmtDate, pct } from "../../components/kit";

function Content({ studentId }: { studentId: string }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const summary = useGet<any>(`/attendance/student/${studentId}/summary`);
  const records = useGet<any[]>(`/attendance/student/${studentId}/records?month=${month}`);

  if (summary.loading) return <Loading />;
  const s = summary.data;
  if (!s) return <ErrorBanner message={summary.error} />;
  const overall = s.percentage === null ? null : Number(s.percentage);
  const tone = overall === null ? "default" : overall >= 85 ? "good" : overall >= s.threshold ? "warn" : "bad";

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Overall attendance" value={pct(s.percentage)} tone={tone} hint={`Minimum required: ${s.threshold}%`} />
        <Stat label="Classes held" value={s.totalClasses} />
        <Stat label="Attended" value={s.attended} />
        <Stat label="Subjects below minimum" value={s.subjects.filter((x: any) => x.belowThreshold).length} tone={s.subjects.some((x: any) => x.belowThreshold) ? "bad" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">By subject</h2>
          <Bars
            max={100}
            tone="green"
            format={(v) => `${v.toFixed(1)}%`}
            items={s.subjects.map((x: any) => ({ label: `${x.subjectName}${x.belowThreshold ? " (below minimum)" : ""}`, value: x.percentage === null ? null : Number(x.percentage) }))}
          />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Daily record</h2>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>
          <DataTable
            loading={records.loading}
            rows={records.data ?? []}
            empty="No classes recorded for this month."
            rowKey={(_, i) => i}
            columns={[
              { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
              { key: "period", label: "Period" },
              { key: "subjectName", label: "Subject" },
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status === "PRESENT" ? "ACTIVE" : r.status === "ABSENT" ? "REJECTED" : "PENDING"} label={r.status[0] + r.status.slice(1).toLowerCase()} /> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

export function MyAttendancePage() {
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Subject-wise and daily attendance. Below 75% in a subject may affect exam eligibility." />
      <WithStudent>{(s) => <Content key={s.id} studentId={s.id} />}</WithStudent>
    </div>
  );
}
