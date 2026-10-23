import { api, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Card, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, Empty, Loading, Notice, Tabs, fmtDate, fmtTime, money } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

function Hostel({ studentId }: { studentId: string }) {
  const { hasRole } = useAuth();
  const mine = useGet<Row>(`/hostel/my?studentId=${studentId}`);
  const complaints = useGet<Row[]>(`/hostel/complaints?studentId=${studentId}`);
  const n = useNotice();
  if (mine.loading) return <Loading />;
  const a = mine.data?.allocation;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Hostel room</h2>
        {!mine.data?.allocated ? <Empty>No hostel room allocated.</Empty> : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">Hostel</dt><dd className="font-medium">{a.hostelName}</dd></div>
            <div><dt className="text-slate-500">Room</dt><dd className="font-medium">{a.roomNumber}</dd></div>
            <div><dt className="text-slate-500">Since</dt><dd className="font-medium">{fmtDate(a.fromDate)}</dd></div>
            <div><dt className="text-slate-500">Fee / term</dt><dd className="font-medium">{money(a.feePerTerm)}</dd></div>
          </dl>
        )}
      </Card>
      <div className="space-y-4">
        {mine.data?.allocated && hasRole("STUDENT") && (
          <>
            <Notice error={n.error} success={n.success} />
            <FormCard title="Raise a hostel complaint" busy={n.busy} submitLabel="Submit complaint"
              fields={[{ name: "subject", label: "Subject", required: true }, { name: "description", label: "Details", type: "textarea" }]}
              onSubmit={(v) => n.run(() => api.post("/hostel/complaints", v), "Complaint submitted.", complaints.reload)} />
          </>
        )}
        <DataTable rows={complaints.data ?? []} empty="No complaints raised."
          columns={[
            { key: "subject", label: "Complaint" },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "resolution", label: "Resolution" },
          ]} />
      </div>
    </div>
  );
}

function Transport({ studentId }: { studentId: string }) {
  const { data, loading } = useGet<Row>(`/transport/my?studentId=${studentId}`);
  if (loading) return <Loading />;
  if (!data?.allocated) return <Empty>No bus route allocated.</Empty>;
  const a = data.allocation;
  return (
    <Card className="max-w-xl">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500">Route</dt><dd className="font-medium">{a.routeName}</dd></div>
        <div><dt className="text-slate-500">Pickup stop</dt><dd className="font-medium">{a.stopName ?? "-"} {a.pickupTime && `at ${fmtTime(a.pickupTime)}`}</dd></div>
        <div><dt className="text-slate-500">Vehicle</dt><dd className="font-medium">{a.vehicle ?? "-"}</dd></div>
        <div><dt className="text-slate-500">Driver</dt><dd className="font-medium">{a.driverName ?? "-"} {a.driverPhone}</dd></div>
        <div><dt className="text-slate-500">Fee / term</dt><dd className="font-medium">{money(a.feePerTerm)}</dd></div>
      </dl>
    </Card>
  );
}

function Library() {
  const loans = useGet<Row[]>("/library/issues/my");
  return (
    <DataTable loading={loans.loading} rows={loans.data ?? []} empty="You have not borrowed any books. Browse the catalog under Library."
      columns={[
        { key: "title", label: "Book", render: (r) => <span className="font-medium">{r.title}</span> },
        { key: "issuedOn", label: "Issued", render: (r) => fmtDate(r.issuedOn) },
        { key: "dueOn", label: "Due", render: (r) => fmtDate(r.dueOn) },
        { key: "returnedOn", label: "Returned", render: (r) => (r.returnedOn ? fmtDate(r.returnedOn) : r.overdue ? <span className="text-red-600">Overdue</span> : "On loan") },
        { key: "fine", label: "Fine", render: (r) => (Number(r.currentFine) > 0 ? `${money(r.currentFine)}${r.finePaid ? " (paid)" : ""}` : "-") },
      ]} />
  );
}

export function MyCampusPage() {
  const { hasRole } = useAuth();
  return (
    <div>
      <PageHeader title="Library, hostel & transport" subtitle="Your campus services." />
      <WithStudent>
        {(s) => (
          <Tabs
            tabs={[
              ...(hasRole("STUDENT") ? [{ id: "library", label: "Library loans", content: <Library /> }] : []),
              { id: "hostel", label: "Hostel", content: <Hostel key={s.id} studentId={s.id} /> },
              { id: "transport", label: "Transport", content: <Transport key={s.id} studentId={s.id} /> },
            ]}
          />
        )}
      </WithStudent>
    </div>
  );
}
