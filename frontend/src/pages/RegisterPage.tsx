import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage, unwrap } from "../api/client";
import { Button, Card, ErrorText, Field, Input, Select, SuccessText } from "../components/ui";

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    role: "STUDENT",
  });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await unwrap(api.post("/auth/register", form));
      setMessage("Registration successful. Check your email for a verification code.");
      setStep("verify");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await unwrap(api.post("/auth/verify-email", { email: form.email, code: otp }));
      navigate("/login");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Create an account</h1>
        <p className="mb-6 text-sm text-slate-500">
          Self-registration is available for students and parents. Staff accounts are created by an administrator.
        </p>

        {step === "form" ? (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name">
                <Input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
              </Field>
              <Field label="Last name">
                <Input required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </Field>
            <Field label="I am a">
              <Select value={form.role} onChange={(e) => update("role", e.target.value)}>
                <option value="STUDENT">Student</option>
                <option value="PARENT">Parent</option>
              </Select>
            </Field>
            <ErrorText message={error} />
            <Button type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <SuccessText message={message} />
            <Field label="Verification code">
              <Input required value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
            </Field>
            <ErrorText message={error} />
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify email"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
