import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { Button, Card, ErrorText, Field, Input, SuccessText } from "../components/ui";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "reset">("email");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setMessage("If an account exists for this email, a 6-digit code has been sent to it.");
      setStep("reset");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { email, code, newPassword: password });
      navigate("/login");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Reset your password</h1>
        <p className="mb-6 text-sm text-slate-500">{step === "email" ? "Enter your account email and we will send a code." : "Enter the code and choose a new password."}</p>
        {step === "email" ? (
          <form onSubmit={requestCode} className="flex flex-col gap-4">
            <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <ErrorText message={error} />
            <Button type="submit" disabled={busy}>{busy ? "Sending..." : "Send code"}</Button>
          </form>
        ) : (
          <form onSubmit={reset} className="flex flex-col gap-4">
            <SuccessText message={message} />
            <Field label="Code"><Input required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Field label="New password (8+ characters)"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <ErrorText message={error} />
            <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Reset password"}</Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-500"><Link to="/login" className="font-medium text-indigo-600 hover:underline">Back to sign in</Link></p>
      </Card>
    </div>
  );
}
