import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Batch, Course, Semester, Subject } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, PageHeader } from "../../components/ui";

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const canManage = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD");

  const [course, setCourse] = useState<Course | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjectsBySemester, setSubjectsBySemester] = useState<Record<number, Subject[]>>({});
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [subjectForm, setSubjectForm] = useState({ semesterId: "", name: "", code: "", credits: "" });
  const [batchForm, setBatchForm] = useState({ name: "", startYear: "", endYear: "" });

  async function load() {
    if (!id) return;
    setError(null);
    try {
      const [c, sems, b] = await Promise.all([
        unwrap<Course>(api.get(`/courses/${id}`)),
        unwrap<Semester[]>(api.get(`/courses/${id}/semesters`)),
        unwrap<Batch[]>(api.get(`/courses/${id}/batches`)),
      ]);
      setCourse(c);
      setSemesters(sems);
      setBatches(b);

      const subjectEntries = await Promise.all(
        sems.map((s) => unwrap<Subject[]>(api.get(`/semesters/${s.id}/subjects`)).then((subs) => [s.id, subs] as const))
      );
      setSubjectsBySemester(Object.fromEntries(subjectEntries));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddSubject(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/subjects", {
        semesterId: Number(subjectForm.semesterId),
        name: subjectForm.name,
        code: subjectForm.code,
        credits: Number(subjectForm.credits),
        elective: false,
      });
      setSubjectForm({ semesterId: "", name: "", code: "", credits: "" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleAddBatch(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    try {
      await api.post("/batches", {
        courseId: Number(id),
        name: batchForm.name,
        startYear: Number(batchForm.startYear),
        endYear: Number(batchForm.endYear),
      });
      setBatchForm({ name: "", startYear: "", endYear: "" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!course) return <ErrorText message={error} />;

  return (
    <div>
      <PageHeader title={course.name} subtitle={`${course.code} · ${course.departmentName}`} />
      <ErrorText message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {semesters.map((s) => (
            <Card key={s.id}>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">{s.name}</h3>
              <ul className="mb-2 divide-y divide-slate-100 text-sm">
                {(subjectsBySemester[s.id] ?? []).map((sub) => (
                  <li key={sub.id} className="flex justify-between py-1.5">
                    <span>{sub.name} <span className="font-mono text-xs text-slate-400">{sub.code}</span></span>
                    <span className="text-slate-500">{sub.credits} cr</span>
                  </li>
                ))}
                {(subjectsBySemester[s.id] ?? []).length === 0 && (
                  <li className="py-1.5 text-slate-400">No subjects added yet.</li>
                )}
              </ul>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          {canManage && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Add subject</h2>
              <form onSubmit={handleAddSubject} className="flex flex-col gap-3">
                <Field label="Semester">
                  <select
                    required
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={subjectForm.semesterId}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, semesterId: e.target.value }))}
                  >
                    <option value="">Select semester</option>
                    {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Subject name">
                  <Input required value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Subject code">
                  <Input required value={subjectForm.code} onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))} />
                </Field>
                <Field label="Credits">
                  <Input type="number" step="0.5" required value={subjectForm.credits} onChange={(e) => setSubjectForm((f) => ({ ...f, credits: e.target.value }))} />
                </Field>
                <Button type="submit">Add subject</Button>
              </form>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Batches</h2>
            <ul className="mb-3 divide-y divide-slate-100 text-sm">
              {batches.map((b) => (
                <li key={b.id} className="py-1.5">{b.name} <span className="text-slate-400">({b.startYear}-{b.endYear})</span></li>
              ))}
              {batches.length === 0 && <li className="py-1.5 text-slate-400">No batches yet.</li>}
            </ul>
            {canManage && (
              <form onSubmit={handleAddBatch} className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                <Field label="Batch name"><Input required placeholder="2026-2030" value={batchForm.name} onChange={(e) => setBatchForm((f) => ({ ...f, name: e.target.value }))} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start year"><Input type="number" required value={batchForm.startYear} onChange={(e) => setBatchForm((f) => ({ ...f, startYear: e.target.value }))} /></Field>
                  <Field label="End year"><Input type="number" required value={batchForm.endYear} onChange={(e) => setBatchForm((f) => ({ ...f, endYear: e.target.value }))} /></Field>
                </div>
                <Button type="submit">Add batch</Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
