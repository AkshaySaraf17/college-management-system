import { useState } from "react";
import type { Row } from "../../api/client";
import { useGet } from "../../hooks/useLoad";
import { Card, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, Empty, ErrorBanner, PrintButton, money } from "../../components/kit";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function PayslipsPage() {
  const { data, loading, error } = useGet<Row[]>("/payroll/payslips/me");
  const [selected, setSelected] = useState<Row | null>(null);
  const slip = selected ?? data?.[0] ?? null;

  return (
    <div>
      <PageHeader title="My payslips" subtitle="Monthly salary statements. Approved unpaid leave is deducted pro rata over 30 days." />
      <ErrorBanner message={error} />
      {!loading && (data ?? []).length === 0 ? <Empty>No payslips have been generated for you yet.</Empty> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <DataTable loading={loading} rows={data ?? []} columns={[
              { key: "period", label: "Month", render: (r) => <button className="font-medium text-indigo-600 hover:underline" onClick={() => setSelected(r)}>{MONTHS[r.month]} {r.year}</button> },
              { key: "netPay", label: "Net pay", render: (r) => money(r.netPay) },
              { key: "status", label: "", render: (r) => <StatusBadge status={r.status === "PAID" ? "ACTIVE" : "PENDING"} label={r.status === "PAID" ? "Paid" : "Pending"} /> },
            ]} />
          </div>
          {slip && (
            <Card className="print-area lg:col-span-2">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Payslip - {MONTHS[slip.month]} {slip.year}</h2>
                  <p className="text-sm text-slate-500">{slip.fullName} · {slip.employeeCode} · {slip.designation ?? ""} {slip.departmentName ? `· ${slip.departmentName}` : ""}</p>
                </div>
                <PrintButton />
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2 text-slate-600">Basic</td><td className="text-right">{money(slip.basic)}</td></tr>
                  <tr><td className="py-2 text-slate-600">House rent allowance</td><td className="text-right">{money(slip.hra)}</td></tr>
                  <tr><td className="py-2 text-slate-600">Other allowances</td><td className="text-right">{money(slip.allowances)}</td></tr>
                  <tr><td className="py-2 text-slate-600">Standard deductions</td><td className="text-right">- {money(slip.deductions)}</td></tr>
                  <tr><td className="py-2 text-slate-600">Unpaid leave ({slip.unpaidLeaveDays} day(s))</td><td className="text-right">- {money(slip.leaveDeduction)}</td></tr>
                  <tr className="font-semibold"><td className="py-3 text-slate-900">Net pay</td><td className="text-right text-lg">{money(slip.netPay)}</td></tr>
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
