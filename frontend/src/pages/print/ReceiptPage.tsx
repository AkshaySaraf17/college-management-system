import { useParams } from "react-router-dom";
import { useGet } from "../../hooks/useLoad";
import { Card, PageHeader } from "../../components/ui";
import { ErrorBanner, Loading, PrintButton, fmtDateTime, money } from "../../components/kit";

export function ReceiptPage() {
  const { paymentId } = useParams();
  const { data: r, loading, error } = useGet<any>(`/fees/payments/${paymentId}/receipt`);
  if (loading) return <Loading />;
  if (!r) return <ErrorBanner message={error} />;
  return (
    <div>
      <PageHeader title="Fee receipt" action={<PrintButton label="Print receipt" />} />
      <Card className="print-area mx-auto max-w-xl p-8">
        <p className="text-center text-xl font-semibold text-slate-900">CollegeMS</p>
        <p className="mb-6 text-center text-sm text-slate-500">Fee payment receipt</p>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-slate-500">Receipt no.</dt><dd className="text-right font-mono font-medium">{r.receiptNumber}</dd>
          <dt className="text-slate-500">Date</dt><dd className="text-right">{fmtDateTime(r.paidAt)}</dd>
          <dt className="text-slate-500">Student</dt><dd className="text-right">{r.studentName} ({r.rollNumber})</dd>
          <dt className="text-slate-500">Course</dt><dd className="text-right">{r.courseName}</dd>
          <dt className="text-slate-500">Invoice</dt><dd className="text-right">{r.invoiceNumber} · {r.title}</dd>
          <dt className="text-slate-500">Payment method</dt><dd className="text-right">{r.method}{r.reference ? ` (${r.reference})` : ""}</dd>
          <dt className="text-slate-500">Received by</dt><dd className="text-right">{r.receivedBy ?? "-"}</dd>
        </dl>
        <div className="my-6 flex items-center justify-between rounded-md bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">Amount received</span>
          <span className="text-2xl font-semibold text-slate-900">{money(r.amount)}</span>
        </div>
        <p className="text-xs text-slate-500">Invoice total {money(r.totalAmount)} · discount {money(r.discount)} · paid to date {money(r.paidAmount)}</p>
      </Card>
    </div>
  );
}
