import { api } from "../../api/client";
import { useBatches } from "../../hooks/useCatalog";
import { useNotice } from "../../hooks/useLoad";
import { Card, PageHeader } from "../../components/ui";
import { Notice } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

export function CommunicationsPage() {
  const batches = useBatches();
  const n = useNotice();
  return (
    <div>
      <PageHeader title="Communications" subtitle="Send an in-app notification to a whole audience (students, parents, faculty, staff) or a single batch and its parents." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <div>
          <Notice error={n.error} success={n.success} />
          <FormCard title="Broadcast a message" busy={n.busy} submitLabel="Send to audience"
            fields={[
              { name: "audience", label: "Audience", type: "select", required: true, defaultValue: "STUDENTS", options: [["ALL", "Everyone"], ["STUDENTS", "All students"], ["PARENTS", "All parents"], ["FACULTY", "All faculty"], ["STAFF", "All staff (non-students)"]].map(([value, label]) => ({ value, label })) },
              { name: "batchId", label: "Or only one batch (students + parents)", type: "select", options: batches.options },
              { name: "title", label: "Title", required: true }, { name: "message", label: "Message", type: "textarea", required: true },
            ]}
            onSubmit={(v) => n.run(async () => (await api.post("/notifications/broadcast", v)).data.data as { recipients: number }, undefined, (r) => n.setSuccess(`Delivered to ${r.recipients} recipient(s).`))} />
        </div>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">How it works</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>Recipients see it in their notification bell immediately.</li>
            <li>Choosing a batch overrides the audience: that batch's students and their linked parents are notified.</li>
            <li>For a lasting notice (and a public website notice), post an announcement instead.</li>
            <li>Automatic alerts (absences, fees, results, assignments, leave decisions) are sent by the system.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
