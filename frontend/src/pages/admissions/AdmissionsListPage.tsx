import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import type { Admission, Course } from "../../api/types";
import { Button, Card, ErrorText, PageHeader, Select, StatusBadge } from "../../components/ui";

export function AdmissionsListPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = courseFilter ? { courseId: courseFilter } : {};
      const data = await unwrap<Admission[]>(api.get("/admissions", { params }));
      setAdmissions(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    unwrap<Course[]>(api.get("/courses")).then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter]);

  async function handleGenerateMeritList() {
    if (!courseFilter) {
      setError("Select a course first to generate its merit list.");
      return;
    }
    try {
      await api.post(`/admissions/merit-list?courseId=${courseFilter}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Admissions"
        subtitle="Review applications, generate merit lists, and enroll students."
        action={
          <div className="flex gap-2">
            <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={handleGenerateMeritList}>Generate merit list</Button>
          </div>
        }
      />

      <ErrorText message={error} />

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Application #</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>
            )}
            {!loading && admissions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No applications found.</td></tr>
            )}
            {admissions.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{a.applicationNumber}</td>
                <td className="px-4 py-3">{a.fullName}</td>
                <td className="px-4 py-3">{a.courseName}</td>
                <td className="px-4 py-3">{a.entranceExamScore ?? "-"}</td>
                <td className="px-4 py-3">{a.meritRank ?? "-"}</td>
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admissions/${a.id}`} className="font-medium text-indigo-600 hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
