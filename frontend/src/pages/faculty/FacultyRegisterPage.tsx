import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import type { Department, Faculty } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, SuccessText } from "../../components/ui";

export function FacultyRegisterPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    departmentId: "",
    designation: "",
    qualification: "",
    dateOfJoining: "",
    employmentType: "FULL_TIME",
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ faculty: Faculty; temporaryPassword: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    unwrap<Department[]>(api.get("/departments")).then(setDepartments).catch(() => {});
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await unwrap<{ faculty: Faculty; temporaryPassword: string }>(
        api.post("/faculty", { ...form, departmentId: Number(form.departmentId) })
      );
      setResult(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Register faculty" subtitle="Creates a login and faculty profile for a new staff member." />

      <Card className="max-w-2xl">
        {result ? (
          <div className="space-y-3">
            <SuccessText message={`${result.faculty.fullName} registered as ${result.faculty.employeeCode}.`} />
            <p className="text-sm text-slate-600">
              Temporary password: <span className="font-mono font-semibold">{result.temporaryPassword}</span>
            </p>
            <p className="text-xs text-slate-500">Share this password securely with the new faculty member.</p>
            <Button onClick={() => navigate(`/faculty/${result.faculty.id}`)}>View faculty profile</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name"><Input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></Field>
            <Field label="Last name"><Input required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
            <Field label="Department">
              <Select required value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Designation"><Input value={form.designation} onChange={(e) => update("designation", e.target.value)} placeholder="Assistant Professor" /></Field>
            <Field label="Qualification"><Input value={form.qualification} onChange={(e) => update("qualification", e.target.value)} /></Field>
            <Field label="Date of joining"><Input type="date" required value={form.dateOfJoining} onChange={(e) => update("dateOfJoining", e.target.value)} /></Field>
            <Field label="Employment type">
              <Select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="VISITING">Visiting</option>
              </Select>
            </Field>
            <ErrorText message={error} />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>{loading ? "Registering..." : "Register faculty"}</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
