import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Faculty, FacultyLeave, SubjectAllocation } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, StatusBadge, SuccessText } from "../../components/ui";
import { useBatches, useBatchSubjects } from "../../hooks/useCatalog";
import { FormCard } from "../../components/FormCard";

function AllocateSubject({ facultyId, onDone }: { facultyId: string; onDone: () => void }) {
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const subjects = useBatchSubjects(batchId);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  return (
    <Card className="mt-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Allocate a subject</h2>
      <ErrorText message={error} />
      <SuccessText message={ok} />
      <div className="mb-3">
        <Field label="Batch">
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batches.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
      {batchId && (
        <FormCard plain key={batchId} submitLabel="Allocate"
          fields={[
            { name: "subjectId", label: "Subject", type: "select", required: true, options: subjects.options },
            { name: "academicYear", label: "Academic year", required: true, defaultValue: year },
          ]}
          onSubmit={async (v) => {
            setError(null); setOk(null);
            try {
              await api.post("/faculty/allocations", { ...v, facultyId, batchId: Number(batchId) });
              setOk("Subject allocated.");
              onDone();
              return true;
            } catch (e) {
              setError(errorMessage(e));
              return undefined;
            }
          }} />
      )}
    </Card>
  );
}

export function FacultyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const isSelf = !id;

  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [leaves, setLeaves] = useState<FacultyLeave[]>([]);
  const [allocations, setAllocations] = useState<SubjectAllocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [leaveType, setLeaveType] = useState("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    const path = isSelf ? "/faculty/me" : `/faculty/${id}`;
    const f = await unwrap<Faculty>(api.get(path));
    setFaculty(f);
    const [l, a] = await Promise.all([
      unwrap<FacultyLeave[]>(api.get(`/faculty/${f.id}/leaves`)),
      unwrap<SubjectAllocation[]>(api.get(`/faculty/${f.id}/allocations`)),
    ]);
    setLeaves(l);
    setAllocations(a);
  }

  useEffect(() => {
    load().catch((err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleApplyLeave(e: FormEvent) {
    e.preventDefault();
    if (!faculty) return;
    setError(null);
    setMessage(null);
    try {
      await api.post(`/faculty/${faculty.id}/leaves`, { leaveType, startDate, endDate, reason });
      setMessage("Leave request submitted.");
      setStartDate("");
      setEndDate("");
      setReason("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function decideLeave(leaveId: number, approve: boolean) {
    setError(null);
    try {
      await api.patch(`/faculty/leaves/${leaveId}/${approve ? "approve" : "reject"}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!faculty) return <ErrorText message={error} />;

  const canApplyLeave = isSelf || hasRole("SUPER_ADMIN", "COLLEGE_ADMIN");
  const canDecideLeave = hasRole("HOD", "SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL");

  return (
    <div>
      <PageHeader title={faculty.fullName} subtitle={`${faculty.employeeCode} · ${faculty.departmentName ?? "Unassigned"}`}
        action={<Link to={isSelf ? "/faculty/me/performance" : `/faculty/${faculty.id}/performance`} className="text-sm font-medium text-indigo-600 hover:underline">Teaching performance</Link>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <StatusBadge status={faculty.status} />
            {faculty.documentsVerified && <span className="text-xs text-green-600">Documents verified</span>}
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{faculty.email}</dd></div>
            <div><dt className="text-slate-500">Designation</dt><dd className="font-medium">{faculty.designation ?? "-"}</dd></div>
            <div><dt className="text-slate-500">Qualification</dt><dd className="font-medium">{faculty.qualification ?? "-"}</dd></div>
            <div><dt className="text-slate-500">Employment type</dt><dd className="font-medium">{faculty.employmentType.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-slate-500">Date of joining</dt><dd className="font-medium">{faculty.dateOfJoining}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Subject allocations</h2>
          {allocations.length === 0 && <p className="text-sm text-slate-400">No subjects allocated.</p>}
          <ul className="space-y-2">
            {allocations.map((a) => (
              <li key={a.id} className="rounded-md border border-slate-100 p-2 text-sm">
                <p className="font-medium text-slate-800">{a.subjectName}</p>
                <p className="text-slate-500">{a.batchName} · {a.academicYear}</p>
              </li>
            ))}
          </ul>
          {hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD") && !isSelf && <AllocateSubject facultyId={faculty.id} onDone={load} />}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Leave requests</h2>
        <ErrorText message={error} />
        <SuccessText message={message} />

        {leaves.length === 0 ? (
          <p className="text-sm text-slate-400">No leave requests yet.</p>
        ) : (
          <table className="mb-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Type</th>
                <th className="py-2">From</th>
                <th className="py-2">To</th>
                <th className="py-2">Status</th>
                {canDecideLeave && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">{l.leaveType}</td>
                  <td className="py-2">{l.startDate}</td>
                  <td className="py-2">{l.endDate}</td>
                  <td className="py-2"><StatusBadge status={l.status} /></td>
                  {canDecideLeave && (
                    <td className="py-2 text-right">
                      {l.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => decideLeave(l.id, true)}>Approve</Button>
                          <Button variant="danger" onClick={() => decideLeave(l.id, false)}>Reject</Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canApplyLeave && (
          <form onSubmit={handleApplyLeave} className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <Field label="Type">
              <Select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                <option value="CASUAL">Casual</option>
                <option value="SICK">Sick</option>
                <option value="EARNED">Earned</option>
                <option value="UNPAID">Unpaid</option>
              </Select>
            </Field>
            <Field label="Start date">
              <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Reason">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="sm:col-span-4">
              <Button type="submit">Apply for leave</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
