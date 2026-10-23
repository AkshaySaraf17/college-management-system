import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Faculty } from "../../api/types";
import { Button, Card, ErrorText, PageHeader, StatusBadge } from "../../components/ui";

export function FacultyListPage() {
  const { hasRole } = useAuth();
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    unwrap<Faculty[]>(api.get("/faculty"))
      .then(setFaculty)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Faculty"
        subtitle="Manage teaching staff, department assignments, and leave requests."
        action={
          hasRole("SUPER_ADMIN", "COLLEGE_ADMIN") ? (
            <Link to="/faculty/register"><Button>Register faculty</Button></Link>
          ) : undefined
        }
      />

      <ErrorText message={error} />

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>}
            {!loading && faculty.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No faculty found.</td></tr>
            )}
            {faculty.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{f.employeeCode}</td>
                <td className="px-4 py-3">{f.fullName}</td>
                <td className="px-4 py-3">{f.departmentName ?? "-"}</td>
                <td className="px-4 py-3">{f.designation ?? "-"}</td>
                <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/faculty/${f.id}`} className="font-medium text-indigo-600 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
