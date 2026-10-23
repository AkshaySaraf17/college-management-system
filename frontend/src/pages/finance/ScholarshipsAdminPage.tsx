import { useState } from "react";
import { api, type Row } from "../../api/client";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, PageHeader, Select, StatusBadge } from "../../components/ui";
import { DataTable, Notice, Tabs, fmtDate, money } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

function Applications() {
  const [status, setStatus] = useState("APPLIED");
  const { data, loading, reload } = useGet<Row[]>(`/scholarships/applications?status=${status}`);
  const n = useNotice();
  return (
    <>
      <Notice error={n.error} success={n.success} />
      <div className="mb-3 max-w-xs"><Select value={status} onChange={(e) => setStatus(e.target.value)}>{["APPLIED", "APPROVED", "REJECTED"].map((s) => <option key={s}>{s}</option>)}</Select></div>
      <DataTable loading={loading} rows={data ?? []} empty="No applications in this state."
        columns={[
          { key: "studentName", label: "Student", render: (a) => <div><p className="font-medium">{a.studentName}</p><p className="font-mono text-xs text-slate-500">{a.rollNumber} · CGPA {a.cgpa ?? "n/a"}</p></div> },
          { key: "schemeName", label: "Scheme", render: (a) => <div><p>{a.schemeName}</p><p className="text-xs text-slate-500">{a.discountType === "PERCENT" ? `${Number(a.discountValue)}%` : money(a.discountValue)}</p></div> },
          { key: "statement", label: "Statement", render: (a) => <span className="text-xs">{a.statement ?? "-"}</span> },
          { key: "appliedAt", label: "Applied", render: (a) => fmtDate(a.appliedAt) },
          { key: "status", label: "Status", render: (a) => <div><StatusBadge status={a.status} />{a.discountApplied && <p className="mt-1 text-xs text-slate-500">{money(a.discountApplied)} applied</p>}</div> },
          { key: "a", label: "", render: (a) => a.status === "APPLIED" && (
            <div className="flex gap-2">
              <Button disabled={n.busy} onClick={() => n.run(() => api.patch(`/scholarships/applications/${a.id}/decide`, { approve: true }), "Approved; discount applied to open invoices.", reload)}>Approve</Button>
              <Button variant="danger" disabled={n.busy} onClick={() => { const remarks = prompt("Reason for declining (optional)") ?? undefined; n.run(() => api.patch(`/scholarships/applications/${a.id}/decide`, { approve: false, remarks }), "Declined.", reload); }}>Decline</Button>
            </div>
          ) },
        ]} />
    </>
  );
}

function Schemes() {
  const { data, loading, reload } = useGet<Row[]>("/scholarships/schemes");
  const n = useNotice();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Notice error={n.error} success={n.success} />
        <DataTable loading={loading} rows={data ?? []} empty="No schemes yet."
          columns={[
            { key: "name", label: "Scheme", render: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.description}</p></div> },
            { key: "discountValue", label: "Discount", render: (s) => (s.discountType === "PERCENT" ? `${Number(s.discountValue)}%` : money(s.discountValue)) },
            { key: "minCgpa", label: "Min CGPA", render: (s) => s.minCgpa ?? "-" },
            { key: "active", label: "Open", render: (s) => <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => n.run(() => api.patch(`/scholarships/schemes/${s.id}/active`, { active: !s.active }), undefined, reload)}>{s.active ? "Yes (close)" : "No (reopen)"}</button> },
          ]} />
      </div>
      <FormCard title="New scheme" busy={n.busy} submitLabel="Create scheme"
        fields={[
          { name: "name", label: "Name", required: true }, { name: "description", label: "Description", type: "textarea" },
          { name: "discountType", label: "Discount type", type: "select", required: true, options: [{ value: "PERCENT", label: "Percentage of fees" }, { value: "FIXED", label: "Fixed amount" }] },
          { name: "discountValue", label: "Value", type: "number", step: "0.01", required: true }, { name: "minCgpa", label: "Minimum CGPA (optional)", type: "number", step: "0.1" },
        ]}
        onSubmit={(v) => n.run(() => api.post("/scholarships/schemes", v), "Scheme created.", reload)} />
    </div>
  );
}

export function ScholarshipsAdminPage() {
  return (
    <div>
      <PageHeader title="Scholarships" subtitle="Define schemes and decide applications. Approval applies the discount to the student's open invoices." />
      <Tabs tabs={[{ id: "apps", label: "Applications", content: <Applications /> }, { id: "schemes", label: "Schemes", content: <Schemes /> }]} />
    </div>
  );
}
