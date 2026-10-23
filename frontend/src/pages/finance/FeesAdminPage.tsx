import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useBatches, useBatchSubjects } from "../../hooks/useCatalog";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge } from "../../components/ui";
import { DataTable, Loading, Notice, Stat, Tabs, fmtDate, fmtDateTime, money } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

function Overview() {
  const { data, loading } = useGet<Row>("/fees/summary");
  if (loading || !data) return <Loading />;
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Invoiced" value={money(data.invoiced)} />
        <Stat label="Collected" value={money(data.collected)} tone="good" />
        <Stat label="Outstanding" value={money(data.outstanding)} tone="warn" />
        <Stat label="Overdue" value={money(data.overdue)} tone={Number(data.overdue) > 0 ? "bad" : "good"} />
      </div>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent payments</h2>
      <DataTable rows={data.recentPayments} empty="No payments yet."
        columns={[
          { key: "studentName", label: "Student" }, { key: "amount", label: "Amount", render: (p) => money(p.amount) },
          { key: "method", label: "Method" }, { key: "paidAt", label: "When", render: (p) => fmtDateTime(p.paidAt) },
          { key: "receipt", label: "Receipt", render: (p) => <Link className="font-medium text-indigo-600 hover:underline" to={`/receipt/${p.id}`}>{p.receiptNumber}</Link> },
        ]} />
    </>
  );
}

function CollectRow({ inv, onDone }: { inv: Row; onDone: () => void }) {
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(inv.balance));
  const [method, setMethod] = useState("CASH");
  const n = useNotice();
  if (!(inv.status === "PENDING" || inv.status === "PARTIAL")) return null;
  return (
    <div className="text-xs">
      <Notice error={n.error} success={n.success} />
      {open ? (
        <div className="flex flex-wrap items-center gap-1">
          <Input type="number" step="0.01" className="w-24" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>{["CASH", "CARD", "UPI", "BANK"].map((m) => <option key={m}>{m}</option>)}</Select>
          <Button disabled={n.busy} onClick={() => n.run(() => api.post(`/fees/invoices/${inv.id}/pay`, { amount: Number(amount), method }), "Recorded.", () => { setOpen(false); onDone(); })}>Save</Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button className="font-medium text-indigo-600 hover:underline" onClick={() => setOpen(true)}>Collect</button>
          {hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL") && <button className="text-slate-600 hover:underline" onClick={() => { if (confirm("Waive this invoice?")) n.run(() => api.post(`/fees/invoices/${inv.id}/waive`), "Waived.", onDone); }}>Waive</button>}
        </div>
      )}
    </div>
  );
}

function Invoices() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, loading, reload } = useGet<Row[]>(`/fees/invoices?${new URLSearchParams({ ...(status && { status }), ...(q && { q }) })}`);
  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Search"><Input placeholder="Roll number, name or invoice no." value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{["PENDING", "PARTIAL", "PAID", "WAIVED", "OVERDUE"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </div>
      </Card>
      <DataTable loading={loading} rows={data ?? []} empty="No invoices match."
        columns={[
          { key: "invoiceNumber", label: "Invoice", render: (i) => <div><p className="font-mono text-xs">{i.invoiceNumber}</p><p className="text-xs text-slate-500">{i.title}</p></div> },
          { key: "studentName", label: "Student", render: (i) => <div><p>{i.studentName}</p><p className="font-mono text-xs text-slate-500">{i.rollNumber}</p></div> },
          { key: "balance", label: "Balance / total", render: (i) => <div><p className="font-medium">{money(i.balance)}</p><p className="text-xs text-slate-500">of {money(i.totalAmount)}{Number(i.discount) > 0 && ` (-${money(i.discount)})`}</p></div> },
          { key: "dueDate", label: "Due", render: (i) => <span className={i.overdue ? "font-medium text-red-600" : ""}>{fmtDate(i.dueDate)}</span> },
          { key: "status", label: "Status", render: (i) => <StatusBadge status={i.status} /> },
          { key: "a", label: "", render: (i) => <CollectRow inv={i} onDone={reload} /> },
        ]} />
    </>
  );
}

function Setup() {
  const structures = useGet<Row[]>("/fees/structures");
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const subjects = useBatchSubjects(batchId);
  const semesters = Array.from(new Map((subjects.data ?? []).map((s) => [s.semesterId, s.semesterName])).entries()).map(([value, label]) => ({ value: value as number, label: label as string }));
  const batch = (batches.data ?? []).find((b) => String(b.id) === batchId);
  const courses = Array.from(new Map((batches.data ?? []).map((b) => [b.courseId, b.courseName])).entries()).map(([value, label]) => ({ value: value as number, label: label as string }));
  const [courseId, setCourseId] = useState("");
  const n = useNotice();
  const courseBatch = (batches.data ?? []).find((b) => String(b.courseId) === courseId);
  const courseSems = useBatchSubjects(courseBatch?.id);
  const courseSemOptions = Array.from(new Map((courseSems.data ?? []).map((s) => [s.semesterId, s.semesterName])).entries()).map(([value, label]) => ({ value: value as number, label: label as string }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <DataTable rows={structures.data ?? []} empty="No fee heads defined."
          columns={[
            { key: "courseName", label: "Course" }, { key: "semesterName", label: "Semester", render: (s) => s.semesterName ?? "Every semester" },
            { key: "name", label: "Fee head" }, { key: "amount", label: "Amount", render: (s) => money(s.amount) },
            { key: "a", label: "", render: (s) => <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/fees/structures/${s.id}`), "Removed.", structures.reload)}>Remove</button> },
          ]} />
        <Notice error={n.error} success={n.success} />
        <Card>
          <Field label="Course (to define fee heads for)"><Select value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">Select course</option>{courses.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
        </Card>
        {courseId && (
          <FormCard key={courseId} title="Add fee head" busy={n.busy} submitLabel="Add fee head"
            fields={[{ name: "name", label: "Name", required: true, placeholder: "Tuition" }, { name: "amount", label: "Amount", type: "number", required: true, step: "0.01" },
              { name: "semesterId", label: "Applies to", type: "select", placeholder: "Every semester", options: courseSemOptions }]}
            onSubmit={(v) => n.run(() => api.post("/fees/structures", { ...v, courseId: Number(courseId) }), "Fee head added.", structures.reload)} />
        )}
      </div>
      <div className="space-y-4">
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Generate invoices for a batch</h2>
          <p className="mb-3 text-xs text-slate-500">Creates one invoice per active student totalling the matching fee heads. Running it twice with the same title will not duplicate.</p>
          <Field label="Batch"><Select value={batchId} onChange={(e) => setBatchId(e.target.value)}><option value="">Select batch</option>{batches.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
        </Card>
        {batch && (
          <FormCard key={batchId} busy={n.busy} submitLabel="Generate invoices" title={`Invoices for ${batch.courseCode} ${batch.name}`}
            fields={[{ name: "title", label: "Invoice title", required: true, placeholder: "Semester 1 fees" },
              { name: "semesterId", label: "Semester fees to include", type: "select", placeholder: "Every-semester heads only", options: semesters },
              { name: "dueDate", label: "Due date", type: "date", required: true }]}
            onSubmit={(v) => n.run(
              async () => (await api.post("/fees/invoices/generate", { ...v, batchId: Number(batchId) })).data.data as Row,
              undefined,
              (r) => n.setSuccess(`Created ${r.created} invoice(s) of ${money(r.amountEach)} each; skipped ${r.skipped} that already existed.`),
            )} />
        )}
      </div>
    </div>
  );
}

export function FeesAdminPage() {
  return (
    <div>
      <PageHeader title="Fees" subtitle="Collections, invoices and fee structure." />
      <Tabs tabs={[{ id: "overview", label: "Overview", content: <Overview /> }, { id: "invoices", label: "Invoices & collection", content: <Invoices /> }, { id: "setup", label: "Fee structure & generation", content: <Setup /> }]} />
    </div>
  );
}
