import { useParams } from "react-router-dom";
import type { Row } from "../../api/client";
import { useGet } from "../../hooks/useLoad";
import { Card, PageHeader } from "../../components/ui";
import { DataTable, ErrorBanner, Loading, Stat, pct } from "../../components/kit";

export function FacultyPerformancePage() {
  const { id } = useParams();
  const me = useGet<Row>(id ? null : "/faculty/me");
  const facultyId = id ?? me.data?.id ?? null;
  const { data, loading, error } = useGet<Row>(facultyId ? `/faculty/${facultyId}/performance` : null);

  if (loading || me.loading) return <Loading />;
  if (!data) return <ErrorBanner message={error ?? me.error} />;
  return (
    <div>
      <PageHeader title="Teaching performance" subtitle={`${data.fullName} · ${data.employeeCode} · ${data.departmentName ?? ""}`} />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Classes held" value={data.totalClassesHeld} />
        <Stat label="Assignments posted" value={data.assignmentsPosted} />
        <Stat label="Materials shared" value={data.materialsShared} />
        <Stat label="Leave days taken" value={data.leaveDaysTaken} />
        <Stat label="Days present (logged)" value={data.daysPresent} />
      </div>
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">By subject and batch</h2>
        <DataTable rows={data.allocations} rowKey={(_, i) => i} empty="No subjects allocated."
          columns={[
            { key: "subjectName", label: "Subject", render: (r) => <span className="font-medium">{r.subjectName}</span> },
            { key: "batchName", label: "Batch", render: (r) => `${r.batchName} (${r.academicYear})` },
            { key: "classesHeld", label: "Classes held" },
            { key: "averageAttendance", label: "Avg attendance", render: (r) => pct(r.averageAttendance) },
            { key: "averageMarksPercent", label: "Avg marks", render: (r) => pct(r.averageMarksPercent) },
            { key: "passPercentage", label: "Pass rate", render: (r) => pct(r.passPercentage) },
          ]} />
        <p className="mt-3 text-xs text-slate-400">Derived from attendance sessions, published results, assignments and approved leave. It is an activity report, not an appraisal.</p>
      </Card>
    </div>
  );
}
