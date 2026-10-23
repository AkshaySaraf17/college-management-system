import { useRef, useState } from "react";
import { api, errorMessage, unwrap, type Row } from "../../api/client";
import { Button, Select } from "../../components/ui";
import { ErrorBanner } from "../../components/kit";

const TYPES = [["MARKSHEET_10", "Class 10 marksheet"], ["MARKSHEET_12", "Class 12 marksheet"], ["ID_PROOF", "ID proof"], ["PHOTO", "Passport photo"], ["TRANSFER_CERTIFICATE", "Transfer certificate"]];

/** Public (no login) document upload for an applicant, keyed by their application id. */
export function DocumentUploader({ applicationId }: { applicationId: string }) {
  const [docType, setDocType] = useState(TYPES[0][0]);
  const [uploaded, setUploaded] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return setError("Choose a file first (PDF, image or Word, up to 10 MB).");
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("docType", docType);
      form.append("file", file);
      const doc = await unwrap<Row>(api.post(`/admissions/${applicationId}/documents/upload`, form));
      setUploaded((u) => [...u, { ...doc, name: file.name }]);
      if (input.current) input.current.value = "";
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 text-left">
      <p className="mb-2 text-sm font-medium text-slate-800">Upload your documents</p>
      <ErrorBanner message={error} />
      <div className="flex flex-wrap items-end gap-2">
        <Select value={docType} onChange={(e) => setDocType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <input ref={input} type="file" className="max-w-[200px] text-sm" />
        <Button disabled={busy} onClick={upload}>{busy ? "Uploading..." : "Upload"}</Button>
      </div>
      {uploaded.length > 0 && <ul className="mt-3 list-inside list-disc text-sm text-green-700">{uploaded.map((d, i) => <li key={i}>{String(d.docType).replaceAll("_", " ")}: {d.name}</li>)}</ul>}
      <p className="mt-2 text-xs text-slate-400">The admissions office verifies each document before review.</p>
    </div>
  );
}
