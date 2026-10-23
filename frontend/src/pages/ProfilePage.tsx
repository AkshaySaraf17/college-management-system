import { api, type Row } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useGet, useNotice } from "../hooks/useLoad";
import { Button, Card, PageHeader } from "../components/ui";
import { ErrorBanner, Loading, Notice, fmtDateTime } from "../components/kit";
import { FormCard } from "../components/FormCard";

export function ProfilePage() {
  const { logout } = useAuth();
  const me = useGet<Row>("/users/me");
  const sessions = useGet<Row[]>("/users/me/sessions");
  const n = useNotice();
  if (me.loading) return <Loading />;
  if (!me.data) return <ErrorBanner message={me.error} />;
  const u = me.data;

  return (
    <div>
      <PageHeader title="Profile & security" subtitle={u.email} />
      <Notice error={n.error} success={n.success} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Account</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{u.firstName} {u.lastName}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{u.phone ?? "-"}</dd></div>
            <div><dt className="text-slate-500">Roles</dt><dd className="font-medium">{String(u.roles).replaceAll("_", " ")}</dd></div>
            <div><dt className="text-slate-500">Last sign-in</dt><dd className="font-medium">{fmtDateTime(u.lastLoginAt)}</dd></div>
          </dl>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-800">Two-factor authentication</p>
            <p className="mb-2 text-xs text-slate-500">When on, signing in also requires a one-time code sent to your email.</p>
            <Button variant={u.twoFactorEnabled ? "secondary" : "primary"} disabled={n.busy}
              onClick={() => n.run(() => api.patch("/users/me/two-factor", { enabled: !u.twoFactorEnabled }), u.twoFactorEnabled ? "Two-factor turned off." : "Two-factor turned on.", me.reload)}>
              {u.twoFactorEnabled ? "Turn off" : "Turn on"}
            </Button>
          </div>
        </Card>

        <FormCard title="Change password" busy={n.busy} submitLabel="Change password"
          fields={[
            { name: "currentPassword", label: "Current password", type: "password", required: true },
            { name: "newPassword", label: "New password (8+ characters)", type: "password", required: true },
          ]}
          onSubmit={(v) => n.run(() => api.post("/users/me/change-password", v), "Password changed.")} />

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Active sessions ({(sessions.data ?? []).length})</h2>
            <Button variant="secondary" onClick={async () => { await api.post("/users/me/logout-all"); logout(); }}>Sign out everywhere</Button>
          </div>
          <ul className="space-y-1 text-sm text-slate-600">
            {(sessions.data ?? []).map((s) => <li key={s.id}>Signed in {fmtDateTime(s.createdAt)} · expires {fmtDateTime(s.expiresAt)}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}
