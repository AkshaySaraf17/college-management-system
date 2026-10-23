import { useRef } from "react";
import { useParams } from "react-router-dom";
import { api, downloadFile, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Card, PageHeader } from "../../components/ui";
import { DataTable, ErrorBanner, Loading, Notice, PrintButton, Tabs, fmtDate } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

function IdCard({ student }: { student: Row }) {
  return (
    <div className="print-area">
      <div className="mx-auto w-[340px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow">
        <div className="bg-indigo-700 px-4 py-3 text-white">
          <p className="text-lg font-semibold">CollegeMS</p>
          <p className="text-xs opacity-80">Student identity card</p>
        </div>
        <div className="flex gap-4 p-4">
          <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-md bg-slate-100 text-3xl font-semibold text-slate-400">
            {String(student.fullName).split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
          </div>
          <dl className="text-sm">
            <dt className="text-xs text-slate-500">Name</dt><dd className="mb-1 font-semibold text-slate-900">{student.fullName}</dd>
            <dt className="text-xs text-slate-500">Roll no.</dt><dd className="mb-1 font-mono text-slate-800">{student.rollNumber}</dd>
            <dt className="text-xs text-slate-500">ID card no.</dt><dd className="font-mono text-slate-800">{student.idCardNumber}</dd>
          </dl>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <p>{student.courseName}</p>
          <p>Batch {student.batchName} · DOB {fmtDate(student.dateOfBirth)}</p>
          <p>Blood group: {student.bloodGroup ?? "-"}</p>
        </div>
      </div>
    </div>
  );
}

function Bonafide({ student }: { student: Row }) {
  return (
    <Card className="print-area mx-auto max-w-2xl p-10">
      <p className="text-center text-xl font-semibold text-slate-900">CollegeMS</p>
      <p className="mb-8 text-center text-sm text-slate-500">Office of the Registrar</p>
      <p className="mb-6 text-center text-lg font-semibold uppercase tracking-wide text-slate-900">Bonafide Certificate</p>
      <p className="mb-6 text-sm leading-7 text-slate-700">
        This is to certify that <strong>{student.fullName}</strong> (Roll No. <strong>{student.rollNumber}</strong>), born on {fmtDate(student.dateOfBirth)},
        is a bonafide student of this institution, enrolled in <strong>{student.courseName}</strong> (batch {student.batchName}) since {fmtDate(student.admittedOn)}.
        The student is currently in <strong>{student.currentSemesterName ?? "the current semester"}</strong> and their status is <strong>{String(student.status).replace("_", " ").toLowerCase()}</strong>.
      </p>
      <p className="mb-12 text-sm text-slate-700">This certificate is issued on request for whatever purpose it may serve.</p>
      <div className="flex justify-between text-sm text-slate-600">
        <span>Date: {fmtDate(new Date().toISOString().slice(0, 10))}</span>
        <span>Registrar</span>
      </div>
    </Card>
  );
}

export function StudentDocuments({ student }: { student: Row }) {
  const { hasRole } = useAuth();
  const docs = useGet<Row[]>(`/students/${student.id}/documents`);
  const n = useNotice();
  const upload = (v: Row, file: File | null) =>
    n.run(async () => {
      if (!file) throw new Error("Choose a file to upload.");
      const form = new FormData();
      form.append("file", file);
      await api.post(`/students/${student.id}/documents/upload?docType=${encodeURIComponent(v.docType)}`, form);
    }, "Document uploaded.", docs.reload);

  return (
    <Tabs
      tabs={[
        { id: "id", label: "ID card", content: <><div className="mb-3 text-right"><PrintButton label="Print ID card" /></div><IdCard student={student} /></> },
        { id: "cert", label: "Bonafide certificate", content: <><div className="mb-3 text-right"><PrintButton label="Print certificate" /></div><Bonafide student={student} /></> },
        {
          id: "docs",
          label: "Uploaded documents",
          content: (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ErrorBanner message={docs.error} />
                <DataTable loading={docs.loading} rows={docs.data ?? []} empty="No documents uploaded."
                  columns={[
                    { key: "docType", label: "Type" },
                    { key: "fileUrl", label: "File", render: (r) => <button className="font-medium text-indigo-600 hover:underline" onClick={() => downloadFile(r.fileUrl, "document")}>Download</button> },
                  ]} />
              </div>
              {hasRole("STUDENT", "SUPER_ADMIN", "COLLEGE_ADMIN") && <UploadForm onUpload={upload} busy={n.busy} error={n.error} success={n.success} />}
            </div>
          ),
        },
      ]}
    />
  );
}

function UploadForm({ onUpload, busy, error, success }: { onUpload: (v: Row, f: File | null) => Promise<unknown>; busy: boolean; error: string | null; success: string | null }) {
  const chosen = useRef<File | null>(null);
  return (
    <div>
      <Notice error={error} success={success} />
      <FormCard title="Upload a document" busy={busy} submitLabel="Upload"
        fields={[{ name: "docType", label: "Document type", type: "select", required: true, options: ["PHOTO", "ID_PROOF", "MARKSHEET", "CERTIFICATE"].map((v) => ({ value: v, label: v.replace("_", " ") })) }]}
        onSubmit={(v) => onUpload(v, chosen.current)} />
      <input type="file" className="mt-2 block text-sm" onChange={(e) => { chosen.current = e.target.files?.[0] ?? null; }} />
    </div>
  );
}

export function MyDocumentsPage() {
  return (
    <div>
      <PageHeader title="ID card & certificates" subtitle="Print your ID card or a bonafide certificate, and manage uploaded documents." />
      <WithStudent>{(s) => <StudentDocuments key={s.id} student={s} />}</WithStudent>
    </div>
  );
}

export function StaffStudentDocumentsPage() {
  const { id } = useParams();
  const { data, loading, error } = useGet<Row>(`/students/${id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorBanner message={error} />;
  return (
    <div>
      <PageHeader title={`${data.fullName} - documents`} subtitle={`${data.rollNumber} · ${data.courseName}`} />
      <StudentDocuments student={data} />
    </div>
  );
}
