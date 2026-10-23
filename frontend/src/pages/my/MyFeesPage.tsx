import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type Row } from "../../api/client";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Input, PageHeader, StatusBadge } from "../../components/ui";
import { Empty, ErrorBanner, Loading, Notice, Stat, fmtDate, money } from "../../components/kit";

function Invoice({ inv, onPaid }: { inv: Row; onPaid: () => void }) {
  const [amount, setAmount] = useState(String(inv.balance));
  const n = useNotice();
  const open = inv.status === "PENDING" || inv.status === "PARTIAL";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{inv.title}</p>
          <p className="text-xs text-slate-500">{inv.invoiceNumber} · due {fmtDate(inv.dueDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          {inv.overdue && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">OVERDUE</span>}
          <StatusBadge status={inv.status} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-500">Total</dt><dd className="font-medium">{money(inv.totalAmount)}</dd></div>
        <div><dt className="text-slate-500">Scholarship / discount</dt><dd className="font-medium">{money(inv.discount)}</dd></div>
        <div><dt className="text-slate-500">Paid</dt><dd className="font-medium">{money(inv.paidAmount)}</dd></div>
        <div><dt className="text-slate-500">Balance</dt><dd className="font-semibold text-slate-900">{money(inv.balance)}</dd></div>
      </dl>
      {inv.payments.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {inv.payments.map((p: Row) => (
            <li key={p.id}>
              {fmtDate(p.paidAt)} · {money(p.amount)} via {p.method} ·{" "}
              <Link to={`/receipt/${p.id}`} className="font-medium text-indigo-600 hover:underline">Receipt {p.receiptNumber}</Link>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <Notice error={n.error} success={n.success} />
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Amount to pay now</span>
              <Input type="number" step="0.01" min={1} max={Number(inv.balance)} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
            </label>
            <Button disabled={n.busy} onClick={() => n.run(() => api.post(`/fees/invoices/${inv.id}/pay-online`, { amount: Number(amount) }), "Payment successful.", onPaid)}>
              {n.busy ? "Processing..." : "Pay online"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Demo payment gateway: no real money moves. Part payments are allowed.</p>
        </div>
      )}
    </Card>
  );
}

function Content({ studentId }: { studentId: string }) {
  const { data, loading, error, reload } = useGet<Row>(`/fees/student/${studentId}`);
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBanner message={error} />;
  const overdue = data.invoices.filter((i: Row) => i.overdue).length;
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Total due" value={money(data.totalDue)} tone={Number(data.totalDue) > 0 ? "warn" : "good"} />
        <Stat label="Overdue invoices" value={overdue} tone={overdue > 0 ? "bad" : "good"} />
        <Stat label="Invoices" value={data.invoices.length} />
      </div>
      {data.invoices.length === 0 ? <Empty>No fee invoices have been raised yet.</Empty> : <div className="space-y-4">{data.invoices.map((i: Row) => <Invoice key={i.id} inv={i} onPaid={reload} />)}</div>}
    </>
  );
}

export function MyFeesPage() {
  return (
    <div>
      <PageHeader title="Fees" subtitle="Invoices, payments, and receipts." />
      <WithStudent>{(s) => <Content key={s.id} studentId={s.id} />}</WithStudent>
    </div>
  );
}
