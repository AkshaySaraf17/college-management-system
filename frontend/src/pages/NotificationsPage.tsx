import { useNavigate } from "react-router-dom";
import { api, type Row } from "../api/client";
import { useGet, useNotice } from "../hooks/useLoad";
import { Button, Card, PageHeader } from "../components/ui";
import { Empty, ErrorBanner, Loading, Notice, fmtDateTime } from "../components/kit";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useGet<Row[]>("/notifications");
  const n = useNotice();

  const open = async (item: Row) => {
    if (!item.isRead) await api.post(`/notifications/${item.id}/read`).catch(() => {});
    if (item.link) navigate(item.link);
    else reload();
  };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Alerts about attendance, fees, results, assignments and more."
        action={<Button variant="secondary" disabled={n.busy} onClick={() => n.run(() => api.post("/notifications/read-all"), undefined, reload)}>Mark all as read</Button>} />
      <Notice error={n.error} success={n.success} />
      <ErrorBanner message={error} />
      {loading ? <Loading /> : (data ?? []).length === 0 ? <Empty>You're all caught up.</Empty> : (
        <div className="space-y-2">
          {(data ?? []).map((item) => (
            <button key={item.id} onClick={() => open(item)} className="block w-full text-left">
              <Card className={`transition hover:border-indigo-300 ${item.isRead ? "" : "border-indigo-200 bg-indigo-50/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm ${item.isRead ? "text-slate-700" : "font-semibold text-slate-900"}`}>{item.title}</p>
                    <p className="text-sm text-slate-600">{item.message}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-400">
                    <p>{fmtDateTime(item.createdAt)}</p>
                    <p className="mt-0.5 uppercase">{item.type}</p>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
