import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, unwrap } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Department } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, PageHeader } from "../../components/ui";

export function DepartmentsPage() {
  const { hasRole } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [establishedYear, setEstablishedYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN");

  async function load() {
    setError(null);
    try {
      setDepartments(await unwrap<Department[]>(api.get("/departments")));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post("/departments", { name, code, establishedYear: establishedYear ? Number(establishedYear) : null });
      setName("");
      setCode("");
      setEstablishedYear("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader title="Departments" subtitle="Academic departments across the college." />

      <ErrorText message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Established</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-mono text-xs">{d.code}</td>
                  <td className="px-4 py-3">{d.name}</td>
                  <td className="px-4 py-3">{d.establishedYear ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {canManage && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Add department</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Code"><Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CSE" /></Field>
              <Field label="Established year"><Input type="number" value={establishedYear} onChange={(e) => setEstablishedYear(e.target.value)} /></Field>
              <Button type="submit" disabled={creating}>{creating ? "Adding..." : "Add department"}</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
