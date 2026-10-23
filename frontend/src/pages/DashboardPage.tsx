import { Link } from "react-router-dom";
import { type Row } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { WithStudent } from "../auth/ActiveStudent";
import { useGet } from "../hooks/useLoad";
import { Card, PageHeader } from "../components/ui";
import { Bars, Empty, Loading, Stat, fmtDate, fmtTime, money, pct } from "../components/kit";
import { TimetableGrid } from "../components/TimetableGrid";

function Notices() {
  const { data } = useGet<Row[]>("/announcements");
  const items = (data ?? []).slice(0, 4);
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Latest announcements</h2><Link to="/announcements" className="text-xs text-indigo-600 hover:underline">View all</Link></div>
      {items.length === 0 ? <p className="text-sm text-slate-400">Nothing new.</p> : <ul className="space-y-2">{items.map((a) => <li key={a.id} className="text-sm"><p className="font-medium text-slate-800">{a.title}</p><p className="line-clamp-2 text-slate-500">{a.body}</p></li>)}</ul>}
    </Card>
  );
}

function StudentDashboard({ student }: { student: Row }) {
  const att = useGet<Row>(`/attendance/student/${student.id}/summary`);
  const res = useGet<Row>(`/results/student/${student.id}`);
  const fees = useGet<Row>(`/fees/student/${student.id}`);
  const asg = useGet<Row[]>(`/lms/assignments/my?studentId=${student.id}`);
  const tt = useGet<Row[]>(`/timetable/my?studentId=${student.id}`);
  const today = ((new Date().getDay() + 6) % 7) + 1;
  const todays = (tt.data ?? []).filter((s) => s.dayOfWeek === today);
  const pending = (asg.data ?? []).filter((a) => !a.submissionId && !a.missed);
  const a = att.data;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Attendance" value={a ? pct(a.percentage) : "-"} tone={a?.percentage == null ? "default" : Number(a.percentage) >= 75 ? "good" : "bad"} hint="Minimum 75%" />
        <Stat label="CGPA" value={res.data?.cgpa ?? "-"} />
        <Stat label="Fees due" value={fees.data ? money(fees.data.totalDue) : "-"} tone={fees.data && Number(fees.data.totalDue) > 0 ? "warn" : "good"} />
        <Stat label="Assignments pending" value={asg.data ? pending.length : "-"} tone={pending.length ? "warn" : "good"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Today's classes</h2><Link to="/my/timetable" className="text-xs text-indigo-600 hover:underline">Full timetable</Link></div>
          {tt.loading ? <Loading /> : todays.length === 0 ? <p className="text-sm text-slate-400">No classes today.</p> : <ul className="divide-y divide-slate-100 text-sm">{todays.map((s) => <li key={s.id} className="flex justify-between py-1.5"><span className="font-medium">{s.subjectName}</span><span className="text-slate-500">{fmtTime(s.startTime)} - {fmtTime(s.endTime)} · {s.room}</span></li>)}</ul>}
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Upcoming assignments</h2><Link to="/my/learning" className="text-xs text-indigo-600 hover:underline">Open</Link></div>
          {pending.length === 0 ? <p className="text-sm text-slate-400">You're up to date.</p> : <ul className="divide-y divide-slate-100 text-sm">{pending.slice(0, 5).map((p) => <li key={p.id} className="flex justify-between py-1.5"><span>{p.title} <span className="text-slate-400">· {p.subjectName}</span></span><span className="text-slate-500">due {fmtDate(p.dueDate)}</span></li>)}</ul>}
        </Card>
        {a && a.subjects.length > 0 && <Card><h2 className="mb-3 text-sm font-semibold text-slate-900">Attendance by subject</h2><Bars max={100} tone="green" format={(v) => `${v.toFixed(0)}%`} items={a.subjects.map((s: Row) => ({ label: s.subjectName, value: s.percentage == null ? null : Number(s.percentage) }))} /></Card>}
        <Notices />
      </div>
    </>
  );
}

function FacultyDashboard() {
  const tt = useGet<Row[]>("/timetable/my");
  const teaching = useGet<Row[]>("/catalog/teaching");
  const today = ((new Date().getDay() + 6) % 7) + 1;
  const todays = (tt.data ?? []).filter((s) => s.dayOfWeek === today);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Today's classes</h2><Link to="/teach/attendance" className="text-xs text-indigo-600 hover:underline">Mark attendance</Link></div>
        {tt.loading ? <Loading /> : todays.length === 0 ? <p className="text-sm text-slate-400">No classes today.</p> : <ul className="divide-y divide-slate-100 text-sm">{todays.map((s) => <li key={s.id} className="flex justify-between py-1.5"><span className="font-medium">{s.subjectName} <span className="text-slate-400">· {s.batchName}</span></span><span className="text-slate-500">{fmtTime(s.startTime)} · {s.room}</span></li>)}</ul>}
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">My teaching load</h2>
        {(teaching.data ?? []).length === 0 ? <p className="text-sm text-slate-400">No subjects allocated yet.</p> : <ul className="divide-y divide-slate-100 text-sm">{(teaching.data ?? []).map((t) => <li key={`${t.batchId}-${t.subjectId}`} className="py-1.5"><span className="font-medium">{t.subjectName}</span> <span className="text-slate-500">· {t.courseName} {t.batchName}</span></li>)}</ul>}
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[["/teach/attendance", "Mark attendance"], ["/teach/marks", "Enter marks"], ["/teach/classroom", "Assignments & materials"], ["/analytics", "At-risk students"], ["/faculty/me", "Apply for leave"], ["/me/payslips", "Payslips"]].map(([to, label]) => <Link key={to} to={to} className="rounded-md border border-slate-200 px-3 py-2 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50">{label}</Link>)}
        </div>
      </Card>
      <Notices />
    </div>
  );
}

function AdminDashboard() {
  const { hasRole } = useAuth();
  const o = useGet<Row>("/reports/overview");
  const funnel = useGet<Row[]>("/reports/admissions-funnel");
  const enrollment = useGet<Row[]>("/reports/enrollment");
  const v = o.data;
  return (
    <>
      {!v ? <Loading /> : (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Active students" value={v.activeStudents} /><Stat label="Faculty" value={v.faculty} />
          <Stat label="Average attendance" value={v.averageAttendance ? `${v.averageAttendance}%` : "-"} tone={v.averageAttendance && Number(v.averageAttendance) < 75 ? "bad" : "good"} /><Stat label="Open admissions" value={v.openAdmissions} />
          <Stat label="Fees collected" value={money(v.feesCollected)} tone="good" /><Stat label="Fees outstanding" value={money(v.feesOutstanding)} tone="warn" />
          <Stat label="Students placed" value={v.studentsPlaced} /><Stat label="Books on loan" value={v.booksOnLoan} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-3 text-sm font-semibold text-slate-900">Enrollment by course</h2><Bars items={(enrollment.data ?? []).map((e) => ({ label: e.courseName, value: Number(e.students) }))} /></Card>
        <Card><h2 className="mb-3 text-sm font-semibold text-slate-900">Admissions pipeline</h2><Bars tone="amber" items={(funnel.data ?? []).map((f) => ({ label: String(f.status).replaceAll("_", " "), value: Number(f.count) }))} /></Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[["/admissions", "Review admissions"], ["/admin/exams", "Exams & results"], ["/finance/fees", "Fee collection"], ["/reports", "Reports"], ["/analytics", "At-risk students"], ...(hasRole("SUPER_ADMIN", "COLLEGE_ADMIN") ? [["/admin/users", "Manage users"]] : [])].map(([to, label]) => <Link key={to} to={to} className="rounded-md border border-slate-200 px-3 py-2 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50">{label}</Link>)}
          </div>
        </Card>
        <Notices />
      </div>
    </>
  );
}

function AccountantDashboard() {
  const s = useGet<Row>("/fees/summary");
  if (!s.data) return <Loading />;
  const d = s.data;
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Invoiced" value={money(d.invoiced)} /><Stat label="Collected" value={money(d.collected)} tone="good" /><Stat label="Outstanding" value={money(d.outstanding)} tone="warn" /><Stat label="Overdue" value={money(d.overdue)} tone={Number(d.overdue) > 0 ? "bad" : "good"} />
      </div>
      <Link to="/finance/fees" className="text-sm font-medium text-indigo-600 hover:underline">Open fee collection</Link>
    </>
  );
}

function ParentOrStudent() {
  return <WithStudent>{(s) => <StudentDashboard key={s.id} student={s} />}</WithStudent>;
}

function ServiceDashboard({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2><div className="grid grid-cols-2 gap-2 text-sm">{links.map(([to, label]) => <Link key={label} to={to} className="rounded-md border border-slate-200 px-3 py-2 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50">{label}</Link>)}</div></Card>
      <Notices />
    </div>
  );
}

export function DashboardPage() {
  const { user, hasRole } = useAuth();
  let body;
  if (hasRole("STUDENT", "PARENT")) body = <ParentOrStudent />;
  else if (hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "HOD")) body = <AdminDashboard />;
  else if (hasRole("FACULTY")) body = <FacultyDashboard />;
  else if (hasRole("ACCOUNTANT")) body = <AccountantDashboard />;
  else if (hasRole("LIBRARIAN")) body = <ServiceDashboard title="Library" links={[["/library", "Issue & return desk and catalog"]]} />;
  else if (hasRole("HOSTEL_WARDEN")) body = <ServiceDashboard title="Hostel" links={[["/hostel", "Allocations & complaints"]]} />;
  else if (hasRole("TRANSPORT_MANAGER")) body = <ServiceDashboard title="Transport" links={[["/transport", "Routes & riders"]]} />;
  else if (hasRole("PLACEMENT_OFFICER")) body = <ServiceDashboard title="Placement" links={[["/placement", "Drives & applicants"]]} />;
  else body = <Empty>Welcome.</Empty>;

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.fullName}`} subtitle={user?.roles.map((r) => r.replaceAll("_", " ")).join(", ")} />
      {body}
      {hasRole("FACULTY") && !hasRole("STUDENT", "PARENT") && <div className="mt-6"><TimetableGridPreview /></div>}
    </div>
  );
}

function TimetableGridPreview() {
  const { data } = useGet<Row[]>("/timetable/my");
  if (!data || data.length === 0) return null;
  return (<><h2 className="mb-2 text-sm font-semibold text-slate-900">My week</h2><TimetableGrid slots={data} showFaculty={false} showBatch /></>);
}
