import { useState } from "react";
import { type Row } from "../../api/client";
import { useBatches } from "../../hooks/useCatalog";
import { useGet } from "../../hooks/useLoad";
import { Card, Field, PageHeader, Select } from "../../components/ui";
import { DataTable, Empty, ErrorBanner, Loading, RiskBadge, Stat } from "../../components/kit";
import { InsightCard } from "../my/MyResultsPage";

export function AnalyticsPage() {
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const { data, loading, error } = useGet<Row[]>(batchId ? `/analytics/at-risk?batchId=${batchId}` : null);
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
  (data ?? []).forEach((s) => { counts[s.riskLevel] = (counts[s.riskLevel] ?? 0) + 1; });

  return (
    <div>
      <PageHeader title="AI performance analytics" subtitle="Risk scoring and next-exam forecast from attendance, marks, trend, assignments, backlogs and overdue fees." />
      <Card className="mb-6 max-w-md">
        <Field label="Batch"><Select value={batchId} onChange={(e) => { setBatchId(e.target.value); setSelected(null); }}><option value="">Select batch</option>{batches.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
      </Card>
      {!batchId ? <Empty>Pick a batch to rank its students by risk.</Empty> : loading ? <Loading what="Analysing the batch" /> : (
        <>
          <ErrorBanner message={error} />
          <div className="mb-6 grid grid-cols-3 gap-4">
            <Stat label="High risk" value={counts.HIGH} tone={counts.HIGH ? "bad" : "good"} /><Stat label="Medium risk" value={counts.MEDIUM} tone={counts.MEDIUM ? "warn" : "good"} /><Stat label="Low risk" value={counts.LOW} tone="good" />
          </div>
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <DataTable rows={data ?? []} empty="No active students in this batch." rowKey={(r) => r.id}
                columns={[
                  { key: "fullName", label: "Student", render: (s) => <button className="text-left" onClick={() => setSelected(s)}><p className="font-medium text-indigo-600 hover:underline">{s.fullName}</p><p className="font-mono text-xs text-slate-500">{s.rollNumber}</p></button> },
                  { key: "riskScore", label: "Risk", render: (s) => <div className="flex items-center gap-2"><span className="font-semibold">{s.riskScore}</span><RiskBadge level={s.riskLevel} /></div> },
                  { key: "predictedNextScore", label: "Next score forecast", render: (s) => (s.predictedNextScore === null ? "-" : `${s.predictedNextScore}%`) },
                  { key: "topFactors", label: "Main drivers", render: (s) => (s.topFactors.length ? s.topFactors.join(", ") : "-") },
                ]} />
              <p className="mt-2 text-xs text-slate-400">A transparent weighted model, not a trained classifier: every point of the score is attributed to a named factor, shown on the right.</p>
            </div>
            <div className="lg:col-span-2">{selected ? <InsightCard key={selected.id} studentId={selected.id} /> : <Empty>Select a student to see the explanation and recommendations.</Empty>}</div>
          </div>
        </>
      )}
    </div>
  );
}
