import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicHistory, ParentInfo, Student } from "../../api/types";
import { Card, ErrorText, PageHeader, StatusBadge } from "../../components/ui";

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const isSelf = !id;

  const [student, setStudent] = useState<Student | null>(null);
  const [parents, setParents] = useState<ParentInfo[]>([]);
  const [history, setHistory] = useState<AcademicHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = isSelf ? "/students/me" : `/students/${id}`;
    unwrap<Student>(api.get(path))
      .then((s) => {
        setStudent(s);
        return Promise.all([
          unwrap<ParentInfo[]>(api.get(`/students/${s.id}/parents`)),
          unwrap<AcademicHistory[]>(api.get(`/students/${s.id}/academic-history`)),
        ]);
      })
      .then(([p, h]) => {
        setParents(p);
        setHistory(h);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id, isSelf]);

  if (error) return <ErrorText message={error} />;
  if (!student) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div>
      <PageHeader title={student.fullName} subtitle={`${student.rollNumber} · ${student.courseName}`}
        action={<Link to={isSelf ? "/my/documents" : `/students/${student.id}/documents`} className="text-sm font-medium text-indigo-600 hover:underline">ID card, certificates & documents</Link>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <StatusBadge status={student.status} />
            <span className="text-sm text-slate-500">ID card: {student.idCardNumber}</span>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{student.email}</dd></div>
            <div><dt className="text-slate-500">Date of birth</dt><dd className="font-medium">{student.dateOfBirth}</dd></div>
            <div><dt className="text-slate-500">Gender</dt><dd className="font-medium">{student.gender ?? "-"}</dd></div>
            <div><dt className="text-slate-500">Blood group</dt><dd className="font-medium">{student.bloodGroup ?? "-"}</dd></div>
            <div><dt className="text-slate-500">Batch</dt><dd className="font-medium">{student.batchName}</dd></div>
            <div><dt className="text-slate-500">Current semester</dt><dd className="font-medium">{student.currentSemesterName ?? "-"}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">Address</dt><dd className="font-medium">{student.address ?? "-"}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Parent / Guardian</h2>
          {parents.length === 0 && <p className="text-sm text-slate-400">No parent records.</p>}
          <ul className="space-y-3">
            {parents.map((p) => (
              <li key={p.id} className="rounded-md border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-800">{p.fullName} {p.primaryContact && <span className="text-xs text-indigo-600">(primary)</span>}</p>
                <p className="text-slate-500">{p.relation}</p>
                <p className="text-slate-500">{p.phone}</p>
                {p.email && <p className="text-slate-500">{p.email}</p>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Academic history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No semester results recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Semester</th>
                <th className="py-2">Status</th>
                <th className="py-2">SGPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="py-2">{h.semesterName}</td>
                  <td className="py-2"><StatusBadge status={h.status} /></td>
                  <td className="py-2">{h.sgpa ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {hasRole("STUDENT") && (
        <p className="mt-4 text-xs text-slate-400">Contact your department office to update personal details.</p>
      )}
    </div>
  );
}
