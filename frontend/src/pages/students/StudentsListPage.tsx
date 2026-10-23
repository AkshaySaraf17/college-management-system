import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import type { Course, Student } from "../../api/types";
import { Card, ErrorText, PageHeader, Select, StatusBadge } from "../../components/ui";

export function StudentsListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseFilter, setCourseFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    unwrap<Course[]>(api.get("/courses")).then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = courseFilter ? { courseId: courseFilter } : {};
    unwrap<Student[]>(api.get("/students", { params }))
      .then(setStudents)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [courseFilter]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Browse enrolled students, their courses, and current status."
        action={
          <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        }
      />

      <ErrorText message={error} />

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Roll No.</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>}
            {!loading && students.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No students found.</td></tr>
            )}
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{s.rollNumber}</td>
                <td className="px-4 py-3">{s.fullName}</td>
                <td className="px-4 py-3">{s.courseName}</td>
                <td className="px-4 py-3">{s.batchName}</td>
                <td className="px-4 py-3">{s.currentSemesterName ?? "-"}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/students/${s.id}`} className="font-medium text-indigo-600 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
