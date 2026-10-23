import { useState } from "react";
import { api, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, Empty, Loading, Notice, Textarea, fmtDate, money } from "../../components/kit";

function Scheme({ s, applied, canApply, onApplied }: { s: Row; applied: boolean; canApply: boolean; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const n = useNotice();
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{s.name}</p>
          <p className="text-sm text-slate-500">
            {s.discountType === "PERCENT" ? `${Number(s.discountValue)}% off fees` : `${money(s.discountValue)} off fees`}
            {s.minCgpa && ` · minimum CGPA ${s.minCgpa}`}
          </p>
        </div>
        {!s.active && <StatusBadge status="WITHDRAWN" label="Closed" />}
      </div>
      {s.description && <p className="mt-2 text-sm text-slate-600">{s.description}</p>}
      {canApply && s.active && !applied && (
        <div className="mt-3">
          <Notice error={n.error} success={n.success} />
          {open ? (
            <div className="space-y-2">
              <Textarea rows={3} className="w-full" placeholder="Why should you receive this scholarship?" value={statement} onChange={(e) => setStatement(e.target.value)} />
              <Button disabled={n.busy} onClick={() => n.run(() => api.post("/scholarships/applications", { schemeId: s.id, statement }), "Application submitted.", onApplied)}>Submit application</Button>
            </div>
          ) : <Button variant="secondary" onClick={() => setOpen(true)}>Apply</Button>}
        </div>
      )}
      {applied && <p className="mt-3 text-xs text-slate-500">You have applied for this scheme.</p>}
    </Card>
  );
}

function Content({ studentId }: { studentId: string }) {
  const { hasRole } = useAuth();
  const schemes = useGet<Row[]>("/scholarships/schemes");
  const mine = useGet<Row[]>(`/scholarships/my?studentId=${studentId}`);
  const appliedNames = new Set((mine.data ?? []).map((a) => a.schemeName));
  if (schemes.loading) return <Loading />;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Available schemes</h2>
        {(schemes.data ?? []).length === 0 ? <Empty>No scholarship schemes are open.</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(schemes.data ?? []).map((s) => <Scheme key={s.id} s={s} applied={appliedNames.has(s.name)} canApply={hasRole("STUDENT")} onApplied={mine.reload} />)}
          </div>
        )}
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Applications</h2>
        <DataTable rows={mine.data ?? []} empty="No applications yet."
          columns={[
            { key: "schemeName", label: "Scheme" },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "discountApplied", label: "Discount applied", render: (r) => (r.discountApplied ? money(r.discountApplied) : "-") },
            { key: "remarks", label: "Remarks" },
            { key: "appliedAt", label: "Applied", render: (r) => fmtDate(r.appliedAt) },
          ]} />
      </div>
    </div>
  );
}

export function MyScholarshipsPage() {
  return (
    <div>
      <PageHeader title="Scholarships" subtitle="Apply for fee waivers. Approved discounts are applied to your open invoices." />
      <WithStudent>{(s) => <Content key={s.id} studentId={s.id} />}</WithStudent>
    </div>
  );
}
