import { useState } from "react";
import { api, type Row } from "../../api/client";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge } from "../../components/ui";
import { DataTable, Notice, Tabs, money } from "../../components/kit";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function StructureRow({ f, onSaved }: { f: Row; onSaved: () => void }) {
  const [v, setV] = useState({ basic: f.basic ?? "", hra: f.hra ?? "", allowances: f.allowances ?? "", deductions: f.deductions ?? "" });
  const n = useNotice();
  const cell = (k: keyof typeof v) => <Input type="number" step="0.01" className="w-28" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />;
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3"><p className="font-medium text-slate-900">{f.fullName}</p><p className="font-mono text-xs text-slate-500">{f.employeeCode} · {f.departmentName}</p></td>
      <td className="px-2">{cell("basic")}</td><td className="px-2">{cell("hra")}</td><td className="px-2">{cell("allowances")}</td><td className="px-2">{cell("deductions")}</td>
      <td className="px-2">
        <Button disabled={n.busy || v.basic === ""} onClick={() => n.run(() => api.put(`/payroll/structures/${f.facultyId}`, { basic: Number(v.basic), hra: Number(v.hra || 0), allowances: Number(v.allowances || 0), deductions: Number(v.deductions || 0) }), undefined, onSaved)}>Save</Button>
        {n.error && <p className="mt-1 text-xs text-red-600">{n.error}</p>}
      </td>
    </tr>
  );
}

function Structures() {
  const { data, loading, reload } = useGet<Row[]>("/payroll/structures");
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Faculty</th><th className="px-2">Basic</th><th className="px-2">HRA</th><th className="px-2">Allowances</th><th className="px-2">Deductions</th><th /></tr></thead>
        <tbody>{loading ? <tr><td className="p-4 text-slate-400">Loading...</td></tr> : (data ?? []).map((f) => <StructureRow key={f.facultyId} f={f} onSaved={reload} />)}</tbody>
      </table>
    </div>
  );
}

function Payslips() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const { data, loading, reload } = useGet<Row[]>(`/payroll/payslips?month=${month}&year=${year}`);
  const n = useNotice();
  const total = (data ?? []).reduce((sum, p) => sum + Number(p.netPay), 0);
  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Month"><Select value={month} onChange={(e) => setMonth(e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Field>
          <Field label="Year"><Input type="number" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
          <Button disabled={n.busy} onClick={() => n.run(async () => (await api.post("/payroll/generate", { month: Number(month), year: Number(year) })).data.data as Row, undefined, (r) => { n.setSuccess(`Generated ${r.generated} payslip(s); ${r.skippedAlreadyPaid} already paid were left untouched.`); reload(); })}>Generate payslips</Button>
        </div>
      </Card>
      <Notice error={n.error} success={n.success} />
      <DataTable loading={loading} rows={data ?? []} empty="No payslips for this month. Set salary structures, then generate."
        columns={[
          { key: "fullName", label: "Faculty", render: (p) => <div><p className="font-medium">{p.fullName}</p><p className="font-mono text-xs text-slate-500">{p.employeeCode}</p></div> },
          { key: "gross", label: "Gross", render: (p) => money(Number(p.basic) + Number(p.hra) + Number(p.allowances)) },
          { key: "leave", label: "Unpaid leave", render: (p) => (p.unpaidLeaveDays ? `${p.unpaidLeaveDays} day(s) · -${money(p.leaveDeduction)}` : "-") },
          { key: "netPay", label: "Net pay", render: (p) => <span className="font-semibold">{money(p.netPay)}</span> },
          { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status === "PAID" ? "ACTIVE" : "PENDING"} label={p.status === "PAID" ? "Paid" : "Pending"} /> },
          { key: "a", label: "", render: (p) => p.status === "GENERATED" && <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => n.run(() => api.patch(`/payroll/payslips/${p.id}/pay`), "Marked as paid.", reload)}>Mark paid</button> },
        ]} />
      {(data ?? []).length > 0 && <p className="mt-3 text-sm font-medium text-slate-700">Total net payout: {money(total)}</p>}
    </>
  );
}

export function PayrollAdminPage() {
  return (
    <div>
      <PageHeader title="Payroll" subtitle="Salary structures and monthly payslips. Approved unpaid leave is deducted pro rata (basic / 30 per day)." />
      <Tabs tabs={[{ id: "payslips", label: "Monthly payslips", content: <Payslips /> }, { id: "structures", label: "Salary structures", content: <Structures /> }]} />
    </div>
  );
}
