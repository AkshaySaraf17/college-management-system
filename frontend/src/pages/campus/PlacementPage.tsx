import { useState } from "react";
import { api, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, PageHeader, Select, StatusBadge } from "../../components/ui";
import { DataTable, Empty, Loading, Notice, Stat, Tabs, fmtDate } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

const STATUSES = ["APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"];

function StudentView() {
  const drives = useGet<Row[]>("/placement/drives");
  const mine = useGet<Row[]>("/placement/my");
  const n = useNotice();
  return (
    <Tabs tabs={[
      { id: "drives", label: "Open drives", content: (
        <>
          <Notice error={n.error} success={n.success} />
          {drives.loading ? <Loading /> : (drives.data ?? []).length === 0 ? <Empty>No placement drives right now.</Empty> : (
            <div className="grid gap-4 md:grid-cols-2">
              {(drives.data ?? []).map((d) => (
                <Card key={d.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-medium text-slate-900">{d.title}</p><p className="text-sm text-slate-500">{d.companyName}{d.industry ? ` · ${d.industry}` : ""}</p></div>
                    <StatusBadge status={d.status === "OPEN" ? "ACTIVE" : "WITHDRAWN"} label={d.status === "OPEN" ? "Open" : "Closed"} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{d.description}</p>
                  <p className="mt-2 text-xs text-slate-500">{d.packageLpa ? `${Number(d.packageLpa)} LPA · ` : ""}Drive {fmtDate(d.driveDate)} · apply by {fmtDate(d.lastApplyDate)}{d.minCgpa ? ` · min CGPA ${d.minCgpa}` : ""}{d.courseName ? ` · ${d.courseName} only` : ""}</p>
                  <div className="mt-3">
                    {d.applied ? <StatusBadge status={d.applicationStatus === "SELECTED" ? "ENROLLED" : d.applicationStatus === "REJECTED" ? "REJECTED" : "SUBMITTED"} label={d.applicationStatus} />
                      : d.eligible ? <Button disabled={n.busy} onClick={() => n.run(() => api.post(`/placement/drives/${d.id}/apply`), "Application submitted.", () => { drives.reload(); mine.reload(); })}>Apply</Button>
                      : <p className="text-xs text-amber-700">{d.ineligibleReason}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>) },
      { id: "mine", label: "My applications", content: (
        <DataTable loading={mine.loading} rows={mine.data ?? []} empty="You haven't applied to any drive yet."
          columns={[{ key: "title", label: "Drive", render: (a) => `${a.title} · ${a.companyName}` }, { key: "driveDate", label: "Drive date", render: (a) => fmtDate(a.driveDate) },
            { key: "status", label: "Status", render: (a) => <StatusBadge status={a.status === "SELECTED" ? "ENROLLED" : a.status === "REJECTED" ? "REJECTED" : "SUBMITTED"} label={a.status} /> }, { key: "remarks", label: "Remarks" }]} />) },
    ]} />
  );
}

function Applicants({ drive }: { drive: Row }) {
  const { data, loading, reload } = useGet<Row[]>(`/placement/drives/${drive.id}/applications`);
  const n = useNotice();
  return (
    <Card className="mt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Applicants - {drive.title}</h3>
      <Notice error={n.error} success={n.success} />
      <DataTable loading={loading} rows={data ?? []} empty="No applicants yet."
        columns={[
          { key: "studentName", label: "Student", render: (a) => <div><p className="font-medium">{a.studentName}</p><p className="font-mono text-xs text-slate-500">{a.rollNumber} · {a.courseName}</p></div> },
          { key: "cgpa", label: "CGPA", render: (a) => a.cgpa ?? "-" },
          { key: "status", label: "Stage", render: (a) => <Select value={a.status} onChange={(e) => n.run(() => api.patch(`/placement/applications/${a.id}`, { status: e.target.value }), "Updated; student notified.", reload)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select> },
        ]} />
    </Card>
  );
}

function OfficerView() {
  const stats = useGet<Row>("/placement/stats");
  const companies = useGet<Row[]>("/placement/companies");
  const drives = useGet<Row[]>("/placement/drives");
  const [open, setOpen] = useState<Row | null>(null);
  const n = useNotice();
  const s = stats.data;
  return (
    <>
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Companies" value={s.companies} /><Stat label="Drives" value={s.drives} /><Stat label="Applications" value={s.applications} />
          <Stat label="Students placed" value={`${s.studentsPlaced}/${s.activeStudents}`} tone="good" /><Stat label="Average package" value={s.averagePackage ? `${s.averagePackage} LPA` : "-"} /><Stat label="Highest package" value={s.highestPackage ? `${s.highestPackage} LPA` : "-"} />
        </div>
      )}
      <Notice error={n.error} success={n.success} />
      <Tabs tabs={[
        { id: "drives", label: "Drives", content: (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DataTable loading={drives.loading} rows={drives.data ?? []} empty="No drives yet."
                columns={[
                  { key: "title", label: "Drive", render: (d) => <div><p className="font-medium">{d.title}</p><p className="text-xs text-slate-500">{d.companyName} · {d.packageLpa ? `${Number(d.packageLpa)} LPA` : "package n/a"}</p></div> },
                  { key: "driveDate", label: "Date", render: (d) => fmtDate(d.driveDate) }, { key: "applicants", label: "Applicants" },
                  { key: "status", label: "Status", render: (d) => <Select value={d.status} onChange={(e) => n.run(() => api.patch(`/placement/drives/${d.id}/status`, { status: e.target.value }), undefined, drives.reload)}>{["OPEN", "CLOSED", "COMPLETED"].map((x) => <option key={x}>{x}</option>)}</Select> },
                  { key: "a", label: "", render: (d) => <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => setOpen(d)}>Applicants</button> },
                ]} />
              {open && <Applicants key={open.id} drive={open} />}
            </div>
            <FormCard title="Create a drive" busy={n.busy} submitLabel="Create & notify students"
              fields={[{ name: "companyId", label: "Company", type: "select", required: true, options: (companies.data ?? []).map((c) => ({ value: c.id, label: c.name })) }, { name: "title", label: "Role / title", required: true }, { name: "description", label: "Description", type: "textarea" },
                { name: "packageLpa", label: "Package (LPA)", type: "number", step: "0.1" }, { name: "driveDate", label: "Drive date", type: "date", required: true }, { name: "lastApplyDate", label: "Apply by", type: "date", required: true }, { name: "minCgpa", label: "Minimum CGPA", type: "number", step: "0.1" }]}
              onSubmit={(v) => n.run(() => api.post("/placement/drives", v), "Drive created.", () => { drives.reload(); stats.reload(); })} />
          </div>) },
        { id: "companies", label: "Companies", content: (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DataTable loading={companies.loading} rows={companies.data ?? []} empty="No companies yet."
                columns={[{ key: "name", label: "Company" }, { key: "industry", label: "Industry" }, { key: "contactEmail", label: "Contact" }, { key: "drives", label: "Drives" },
                  { key: "a", label: "", render: (c) => <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/placement/companies/${c.id}`), "Removed.", companies.reload)}>Remove</button> }]} />
            </div>
            <FormCard title="Add company" busy={n.busy} submitLabel="Add company" fields={[{ name: "name", label: "Name", required: true }, { name: "industry", label: "Industry" }, { name: "website", label: "Website" }, { name: "contactEmail", label: "Contact email", type: "email" }]}
              onSubmit={(v) => n.run(() => api.post("/placement/companies", v), "Company added.", () => { companies.reload(); stats.reload(); })} />
          </div>) },
        { id: "top", label: "Top recruiters", content: <DataTable rows={s?.topRecruiters ?? []} rowKey={(r) => r.companyName} empty="No selections yet." columns={[{ key: "companyName", label: "Company" }, { key: "selected", label: "Students selected" }]} /> },
      ]} />
    </>
  );
}

export function PlacementPage() {
  const { hasRole } = useAuth();
  const staff = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PLACEMENT_OFFICER");
  return (
    <div>
      <PageHeader title="Placements" subtitle={staff ? "Companies, drives, applicants and placement statistics." : "Apply to campus drives you are eligible for."} />
      {staff ? <OfficerView /> : <StudentView />}
    </div>
  );
}
