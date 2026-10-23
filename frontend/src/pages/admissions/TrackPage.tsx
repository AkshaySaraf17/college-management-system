import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, unwrap } from "../../api/client";
import type { Admission } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, StatusBadge } from "../../components/ui";

export function TrackPage() {
  const [applicationNumber, setApplicationNumber] = useState("");
  const [application, setApplication] = useState<Admission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setApplication(null);
    setLoading(true);
    try {
      const app = await unwrap<Admission>(api.get(`/admissions/track/${applicationNumber.trim()}`));
      setApplication(app);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Track your application</h1>
        <p className="mb-6 text-sm text-slate-500">Enter your application number to check its status.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Application number">
            <Input required value={applicationNumber} onChange={(e) => setApplicationNumber(e.target.value)} placeholder="ADM2026000123" />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={loading}>
            {loading ? "Looking up..." : "Track"}
          </Button>
        </form>

        {application && (
          <div className="mt-6 space-y-2 rounded-md border border-slate-200 p-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Applicant</span><span className="font-medium">{application.fullName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Course</span><span className="font-medium">{application.courseName}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><StatusBadge status={application.status} /></div>
            {application.meritRank && (
              <div className="flex justify-between"><span className="text-slate-500">Merit rank</span><span className="font-medium">#{application.meritRank}</span></div>
            )}
            {application.admissionFeeAmount != null && (
              <div className="flex justify-between"><span className="text-slate-500">Fee paid</span><span className="font-medium">{application.admissionFeePaid ? "Yes" : "No"}</span></div>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
