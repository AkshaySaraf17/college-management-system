import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import type { Admission, Course } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, Select } from "../../components/ui";
import { DocumentUploader } from "./DocumentUploader";

const initialForm = {
  courseId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
};

export function ApplyPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Admission | null>(null);

  useEffect(() => {
    unwrap<Course[]>(api.get("/courses")).then(setCourses).catch(() => {});
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const application = await unwrap<Admission>(
        api.post("/admissions/apply", { ...form, courseId: Number(form.courseId) })
      );
      setResult(application);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <Card className="w-full max-w-lg text-center">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">Application submitted!</h1>
          <p className="mb-4 text-sm text-slate-600">
            Your application number is:
          </p>
          <p className="mb-4 rounded-md bg-indigo-50 px-4 py-3 font-mono text-lg font-semibold text-indigo-700">
            {result.applicationNumber}
          </p>
          <p className="mb-6 text-sm text-slate-500">Save this number to track your application status.</p>
          <Link to={`/track`} className="text-sm font-medium text-indigo-600 hover:underline">
            Track your application
          </Link>
          <DocumentUploader applicationId={result.id} />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-2xl">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Admission Application</h1>
        <p className="mb-6 text-sm text-slate-500">Fill in your details to apply for a course.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Course applying for">
            <Select required value={form.courseId} onChange={(e) => update("courseId", e.target.value)}>
              <option value="">Select a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name">
              <Input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            </Field>
            <Field label="Last name">
              <Input required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" required value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
          </div>

          <Field label="Address">
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Guardian name">
              <Input value={form.guardianName} onChange={(e) => update("guardianName", e.target.value)} />
            </Field>
            <Field label="Guardian phone">
              <Input value={form.guardianPhone} onChange={(e) => update("guardianPhone", e.target.value)} />
            </Field>
            <Field label="Guardian email">
              <Input type="email" value={form.guardianEmail} onChange={(e) => update("guardianEmail", e.target.value)} />
            </Field>
          </div>

          <ErrorText message={error} />
          <Button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit application"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
