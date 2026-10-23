import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadFile, errorMessage, unwrap, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useGet } from "../../hooks/useLoad";
import type { Admission, AdmissionStatus, Batch } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, StatusBadge, SuccessText } from "../../components/ui";

export function AdmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canDecide = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "HOD");
  const canFee = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "ACCOUNTANT");
  const canEnroll = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN");
  const docs = useGet<Row[]>(id ? `/admissions/${id}/documents` : null);

  const [application, setApplication] = useState<Admission | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [entranceScore, setEntranceScore] = useState("");
  const [notes, setNotes] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [batchId, setBatchId] = useState("");

  async function load() {
    if (!id) return;
    const app = await unwrap<Admission>(api.get(`/admissions/${id}`));
    setApplication(app);
    setEntranceScore(app.entranceExamScore != null ? String(app.entranceExamScore) : "");
    setNotes(app.reviewNotes ?? "");
    const batchList = await unwrap<Batch[]>(api.get(`/courses/${app.courseId}/batches`));
    setBatches(batchList);
    if (batchList.length > 0) setBatchId(String(batchList[0].id));
  }

  useEffect(() => {
    load().catch((err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAction(action: () => Promise<any>, successMessage: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!application) {
    return <ErrorText message={error} />;
  }

  const status: AdmissionStatus = application.status;

  return (
    <div>
      <PageHeader
        title={application.fullName}
        subtitle={`Application ${application.applicationNumber} · ${application.courseName}`}
        action={<Link to="/admissions" className="text-sm text-indigo-600 hover:underline">Back to list</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <StatusBadge status={status} />
            {application.meritRank && <span className="text-sm text-slate-500">Merit rank #{application.meritRank}</span>}
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{application.email}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{application.phone}</dd></div>
            <div><dt className="text-slate-500">Date of birth</dt><dd className="font-medium">{application.dateOfBirth}</dd></div>
            <div><dt className="text-slate-500">Entrance score</dt><dd className="font-medium">{application.entranceExamScore ?? "-"}</dd></div>
            <div><dt className="text-slate-500">Fee amount</dt><dd className="font-medium">{application.admissionFeeAmount ?? "-"}</dd></div>
            <div><dt className="text-slate-500">Fee paid</dt><dd className="font-medium">{application.admissionFeePaid ? "Yes" : "No"}</dd></div>
          </dl>

          {application.reviewNotes && (
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Review notes: </span>{application.reviewNotes}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Workflow actions</h2>
          <ErrorText message={error} />
          <SuccessText message={message} />

          {canDecide && (status === "SUBMITTED" || status === "DOCUMENTS_PENDING") && (
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Field label="Entrance exam score">
                <Input type="number" step="0.01" value={entranceScore} onChange={(e) => setEntranceScore(e.target.value)} />
              </Field>
              <Field label="Notes">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <Button
                onClick={() =>
                  runAction(
                    () => api.patch(`/admissions/${id}/review`, { entranceExamScore: entranceScore ? Number(entranceScore) : null, notes }),
                    "Moved to review."
                  )
                }
              >
                Mark under review
              </Button>
            </div>
          )}

          {canDecide && status === "MERIT_LISTED" && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs text-slate-500">This application is merit-listed. Approve to proceed to fee payment.</p>
              <Button onClick={() => runAction(() => api.patch(`/admissions/${id}/approve`), "Approved, pending fee payment.")}>
                Approve
              </Button>
            </div>
          )}

          {canFee && status === "FEE_PENDING" && (
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Field label="Admission fee amount">
                <Input type="number" step="0.01" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
              </Field>
              <Button
                onClick={() => runAction(() => api.post(`/admissions/${id}/fee-payment`, { amount: Number(feeAmount) }), "Fee payment recorded.")}
              >
                Record fee payment
              </Button>
            </div>
          )}

          {canEnroll && status === "APPROVED" && application.admissionFeePaid && (
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Field label="Batch">
                <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
              <Button
                onClick={() =>
                  runAction(async () => {
                    const result = await unwrap<{ student: { rollNumber: string }; temporaryPassword: string }>(
                      api.post(`/admissions/${id}/enroll`, { batchId: Number(batchId) })
                    );
                    setMessage(`Enrolled! Roll number ${result.student.rollNumber}. Temp password: ${result.temporaryPassword}`);
                  }, "")
                }
              >
                Enroll student
              </Button>
            </div>
          )}

          {canDecide && !["ENROLLED", "REJECTED", "WITHDRAWN"].includes(status) && (
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <Button
                variant="danger"
                onClick={() => runAction(() => api.patch(`/admissions/${id}/reject`, { notes }), "Application rejected.")}
              >
                Reject
              </Button>
            </div>
          )}

          {status === "ENROLLED" && application.enrolledStudentId && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <Button variant="secondary" onClick={() => navigate(`/students/${application.enrolledStudentId}`)}>
                View student profile
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Applicant documents</h2>
        {(docs.data ?? []).length === 0 ? <p className="text-sm text-slate-400">No documents uploaded yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(docs.data ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span>{String(d.docType).replaceAll("_", " ")}</span>
                <span className="flex items-center gap-3">
                  <button className="font-medium text-indigo-600 hover:underline" onClick={() => downloadFile(d.fileUrl, "document")}>Download</button>
                  {d.verified ? <StatusBadge status="ACTIVE" label="Verified" /> : canDecide ? <Button variant="secondary" onClick={() => runAction(() => api.patch(`/admissions/documents/${d.id}/verify`), "Document verified.").then(docs.reload)}>Verify</Button> : <StatusBadge status="PENDING" label="Unverified" />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
