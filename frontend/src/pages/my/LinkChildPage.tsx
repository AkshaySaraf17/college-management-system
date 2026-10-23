import { api } from "../../api/client";
import { useActiveStudent } from "../../auth/ActiveStudent";
import { useNotice } from "../../hooks/useLoad";
import { Card, PageHeader } from "../../components/ui";
import { Notice } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

export function LinkChildPage() {
  const { students } = useActiveStudent();
  const n = useNotice();
  return (
    <div>
      <PageHeader title="Link a child" subtitle="Prove the relationship with your child's roll number and date of birth." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Notice error={n.error} success={n.success} />
          <FormCard
            title="Add child"
            busy={n.busy}
            submitLabel="Link child"
            fields={[
              { name: "rollNumber", label: "Roll number", required: true, placeholder: "e.g. BTECH-CSE-2025-0001" },
              { name: "dateOfBirth", label: "Child's date of birth", type: "date", required: true },
              { name: "relation", label: "Your relation", type: "select", options: ["FATHER", "MOTHER", "GUARDIAN"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() })), defaultValue: "GUARDIAN" },
            ]}
            onSubmit={(v) => n.run(() => api.post("/parents/link", v), "Linked. Reloading your children...", () => window.location.assign("/dashboard"))}
          />
        </div>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Linked children</h2>
          {students.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
            <ul className="space-y-2 text-sm">
              {students.map((s) => <li key={s.id} className="rounded-md border border-slate-100 p-3"><span className="font-medium">{s.fullName}</span> · {s.rollNumber}<br /><span className="text-slate-500">{s.courseName} · {s.batchName}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
