import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Course, Department } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, PageHeader, Select } from "../../components/ui";

const initialForm = {
  departmentId: "",
  name: "",
  code: "",
  level: "UNDERGRADUATE",
  durationYears: "",
  totalSemesters: "",
  totalSeats: "",
};

export function CoursesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN");

  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setError(null);
    try {
      const [c, d] = await Promise.all([unwrap<Course[]>(api.get("/courses")), unwrap<Department[]>(api.get("/departments"))]);
      setCourses(c);
      setDepartments(d);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post("/courses", {
        departmentId: Number(form.departmentId),
        name: form.name,
        code: form.code,
        level: form.level,
        durationYears: Number(form.durationYears),
        totalSemesters: Number(form.totalSemesters),
        totalSeats: form.totalSeats ? Number(form.totalSeats) : 0,
      });
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader title="Courses & Subjects" subtitle="Manage the programs offered across departments." />

      <ErrorText message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Seats</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.departmentName}</td>
                  <td className="px-4 py-3">{c.durationYears} yrs / {c.totalSemesters} sem</td>
                  <td className="px-4 py-3">{c.totalSeats}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/courses/${c.id}`} className="font-medium text-indigo-600 hover:underline">Manage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {canManage && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Add course</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Field label="Department">
                <Select required value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Name"><Input required value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
              <Field label="Code"><Input required value={form.code} onChange={(e) => update("code", e.target.value)} placeholder="BTECH-CSE" /></Field>
              <Field label="Level">
                <Select value={form.level} onChange={(e) => update("level", e.target.value)}>
                  <option value="UNDERGRADUATE">Undergraduate</option>
                  <option value="POSTGRADUATE">Postgraduate</option>
                  <option value="DIPLOMA">Diploma</option>
                </Select>
              </Field>
              <Field label="Duration (years)"><Input type="number" step="0.5" required value={form.durationYears} onChange={(e) => update("durationYears", e.target.value)} /></Field>
              <Field label="Total semesters"><Input type="number" required value={form.totalSemesters} onChange={(e) => update("totalSemesters", e.target.value)} /></Field>
              <Field label="Total seats"><Input type="number" value={form.totalSeats} onChange={(e) => update("totalSeats", e.target.value)} /></Field>
              <Button type="submit" disabled={creating}>{creating ? "Adding..." : "Add course"}</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
