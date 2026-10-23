import { useState } from "react";
import { api, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge } from "../../components/ui";
import { DataTable, Notice, fmtDateTime } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

const ROLES = ["SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "STUDENT", "PARENT", "ACCOUNTANT", "LIBRARIAN", "PLACEMENT_OFFICER", "HOSTEL_WARDEN", "TRANSPORT_MANAGER"];
const roleOptions = ROLES.map((r) => ({ value: r, label: r.replaceAll("_", " ") }));

function RoleEditor({ user, onDone }: { user: Row; onDone: () => void }) {
  const { hasRole } = useAuth();
  const [roles, setRoles] = useState<string[]>(String(user.roles).split(","));
  const n = useNotice();
  const allowed = ROLES.filter((r) => hasRole("SUPER_ADMIN") || !["SUPER_ADMIN", "COLLEGE_ADMIN"].includes(r));
  return (
    <div className="mt-2 rounded-md border border-slate-200 p-3">
      <Notice error={n.error} success={n.success} />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {allowed.map((r) => (
          <label key={r} className="flex items-center gap-1 text-xs text-slate-700">
            <input type="checkbox" checked={roles.includes(r)} onChange={(e) => setRoles((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))} />
            {r.replaceAll("_", " ")}
          </label>
        ))}
      </div>
      <Button className="mt-2" disabled={n.busy || roles.length === 0} onClick={() => n.run(() => api.put(`/users/${user.id}/roles`, { roles }), "Roles updated.", onDone)}>Save roles</Button>
    </div>
  );
}

export function UsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const query = `/users?${new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(status && { status }) })}`;
  const { data, loading, reload } = useGet<Row[]>(query);
  const n = useNotice();

  return (
    <div>
      <PageHeader title="Users & roles" subtitle="Create staff accounts, assign roles, suspend access and reset passwords." />
      <Notice error={n.error} success={n.success} />
      {temp && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Temporary password for <strong>{temp.email}</strong>: <span className="font-mono font-semibold">{temp.password}</span>. Share it securely; it is shown only once.</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Search"><Input placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
              <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
              <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any</option>{["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "DISABLED"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
          </Card>
          <DataTable loading={loading} rows={data ?? []} empty="No users match."
            columns={[
              { key: "fullName", label: "User", render: (u) => (<div><p className="font-medium text-slate-900">{u.fullName}</p><p className="text-xs text-slate-500">{u.email}</p>{editing === u.id && <RoleEditor user={u} onDone={() => { setEditing(null); reload(); }} />}</div>) },
              { key: "roles", label: "Roles", render: (u) => <span className="text-xs">{String(u.roles).replaceAll("_", " ").replaceAll(",", ", ")}</span> },
              { key: "status", label: "Status", render: (u) => <StatusBadge status={u.status} /> },
              { key: "lastLoginAt", label: "Last sign-in", render: (u) => fmtDateTime(u.lastLoginAt) },
              { key: "a", label: "", render: (u) => (
                <div className="flex flex-col items-start gap-1 text-xs">
                  <button className="font-medium text-indigo-600 hover:underline" onClick={() => setEditing(editing === u.id ? null : u.id)}>Roles</button>
                  <button className="text-slate-700 hover:underline" onClick={() => n.run(() => api.patch(`/users/${u.id}/status`, { status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }), u.status === "ACTIVE" ? "User suspended." : "User activated.", reload)}>{u.status === "ACTIVE" ? "Suspend" : "Activate"}</button>
                  <button className="text-slate-700 hover:underline" onClick={() => n.run(async () => { const r = await api.post(`/users/${u.id}/reset-password`); setTemp({ email: u.email, password: r.data.data.temporaryPassword }); }, undefined)}>Reset password</button>
                </div>
              ) },
            ]} />
        </div>
        <FormCard title="Create a staff account" busy={n.busy} submitLabel="Create user"
          fields={[
            { name: "firstName", label: "First name", required: true }, { name: "lastName", label: "Last name", required: true },
            { name: "email", label: "Email", type: "email", required: true }, { name: "phone", label: "Phone" },
            { name: "role", label: "Role", type: "select", required: true, options: roleOptions.filter((o) => !["STUDENT"].includes(String(o.value))) },
          ]}
          onSubmit={(v) => n.run(async () => { const r = await api.post("/auth/admin/create-user", v); setTemp({ email: v.email, password: r.data.data.temporaryPassword }); }, "Account created.", reload)} />
      </div>
    </div>
  );
}
