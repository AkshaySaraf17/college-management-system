import { downloadFile, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, PageHeader } from "../../components/ui";
import { Bars, Loading, Notice, Stat, money } from "../../components/kit";

export function ReportsPage() {
  const { hasRole } = useAuth();
  const overview = useGet<Row>("/reports/overview");
  const enrollment = useGet<Row[]>("/reports/enrollment");
  const funnel = useGet<Row[]>("/reports/admissions-funnel");
  const attendance = useGet<Row[]>("/reports/attendance");
  const fees = useGet<Row[]>("/reports/fees");
  const results = useGet<Row[]>("/reports/results");
  const n = useNotice();
  const o = overview.data;
  const exportable = ["students", "attendance", "results", ...(hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "ACCOUNTANT") ? ["fees"] : [])];

  return (
    <div>
      <PageHeader title="Reports & analytics" subtitle="Live figures across the college. CSV exports open in Excel or Sheets."
        action={<div className="flex flex-wrap gap-2">{exportable.map((d) => <Button key={d} variant="secondary" onClick={() => n.run(() => downloadFile(`/reports/export/${d}`, `${d}.csv`), undefined)}>Export {d}</Button>)}</div>} />
      <Notice error={n.error} success={n.success} />
      {!o ? <Loading /> : (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Active students" value={o.activeStudents} /><Stat label="Faculty" value={o.faculty} /><Stat label="Courses" value={o.courses} /><Stat label="Open admissions" value={o.openAdmissions} />
          <Stat label="Average attendance" value={o.averageAttendance ? `${o.averageAttendance}%` : "-"} tone={o.averageAttendance && Number(o.averageAttendance) < 75 ? "bad" : "good"} />
          <Stat label="Fees collected" value={money(o.feesCollected)} tone="good" /><Stat label="Fees outstanding" value={money(o.feesOutstanding)} tone="warn" /><Stat label="Students placed" value={o.studentsPlaced} />
          <Stat label="Books on loan" value={o.booksOnLoan} /><Stat label="Hostel residents" value={o.hostelResidents} /><Stat label="Bus riders" value={o.transportRiders} /><Stat label="Departments" value={o.departments} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-3 text-sm font-semibold text-slate-900">Enrollment vs seats</h2>
          <Bars items={(enrollment.data ?? []).map((e) => ({ label: `${e.courseName} (${e.students}/${e.totalSeats || "-"})`, value: Number(e.students) }))} max={Math.max(1, ...(enrollment.data ?? []).map((e) => Number(e.totalSeats) || Number(e.students)))} /></Card>
        <Card><h2 className="mb-3 text-sm font-semibold text-slate-900">Admissions funnel</h2>
          <Bars tone="amber" items={(funnel.data ?? []).map((f) => ({ label: String(f.status).replaceAll("_", " "), value: Number(f.count) }))} /></Card>
        <Card><h2 className="mb-3 text-sm font-semibold text-slate-900">Attendance by batch</h2>
          <Bars tone="green" max={100} format={(v) => `${v.toFixed(1)}%`} items={(attendance.data ?? []).map((a) => ({ label: `${a.courseCode} · ${a.batchName}`, value: a.percentage === null ? null : Number(a.percentage) }))} /></Card>
        <Card><h2 className="mb-3 text-sm font-semibold text-slate-900">Fee collection (last 6 months)</h2>
          <Bars tone="green" format={(v) => money(v)} items={(fees.data ?? []).map((f) => ({ label: `${f.month} (${f.payments} payments)`, value: Number(f.collected) }))} /></Card>
        <Card className="lg:col-span-2"><h2 className="mb-3 text-sm font-semibold text-slate-900">Pass percentage - recent published exams</h2>
          <Bars max={100} format={(v) => `${v.toFixed(1)}%`} items={(results.data ?? []).map((r) => ({ label: `${r.examName} · ${r.batchName}`, value: r.passPercentage === null ? null : Number(r.passPercentage) }))} /></Card>
      </div>
    </div>
  );
}
