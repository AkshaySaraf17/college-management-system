import { api, type Row } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useBatches } from "../hooks/useCatalog";
import { useGet, useNotice } from "../hooks/useLoad";
import { Button, Card, PageHeader } from "../components/ui";
import { Empty, ErrorBanner, Loading, Notice, fmtDateTime } from "../components/kit";
import { FormCard } from "../components/FormCard";

export function AnnouncementsPage() {
  const { hasRole } = useAuth();
  const { data, loading, error, reload } = useGet<Row[]>("/announcements");
  const batches = useBatches();
  const n = useNotice();
  const isAdmin = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL");
  const canPost = isAdmin || hasRole("HOD", "FACULTY");

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Notices from the college and your teachers." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <ErrorBanner message={error} />
          {loading ? <Loading /> : (data ?? []).length === 0 ? <Empty>No announcements yet.</Empty> : (data ?? []).map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.author ?? "College"} · {fmtDateTime(a.createdAt)} · for {String(a.audience).toLowerCase()}{a.batchId ? " (one batch)" : ""}{a.isPublic ? " · public" : ""}</p>
                </div>
                {canPost && <Button variant="secondary" onClick={() => n.run(() => api.delete(`/announcements/${a.id}`), "Deleted.", reload)}>Delete</Button>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
            </Card>
          ))}
        </div>
        {canPost && (
          <div>
            <Notice error={n.error} success={n.success} />
            <FormCard title="Post an announcement" busy={n.busy} submitLabel="Post"
              fields={[
                { name: "title", label: "Title", required: true },
                { name: "body", label: "Message", type: "textarea", required: true },
                { name: "audience", label: "Audience", type: "select", defaultValue: "STUDENTS", options: [["ALL", "Everyone"], ["STUDENTS", "Students"], ["PARENTS", "Parents"], ["FACULTY", "Faculty"], ["STAFF", "Staff"]].map(([value, label]) => ({ value, label })) },
                { name: "batchId", label: isAdmin ? "Limit to a batch (optional)" : "Batch", type: "select", required: !isAdmin, options: batches.options },
                ...(isAdmin ? [{ name: "isPublic", label: "Show on the public website", type: "checkbox" as const }] : []),
              ]}
              onSubmit={(v) => n.run(() => api.post("/announcements", v), "Posted and notified.", reload)} />
          </div>
        )}
      </div>
    </div>
  );
}
