import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../api/client";
import { Button, Card, ErrorText, Field, Input } from "../components/ui";

export function LoginPage() {
  const { login, verifyLoginOtp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.otpRequired) {
        setOtpRequired(true);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyLoginOtp(email, otp);
      navigate("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">College Management System</h1>
        <p className="mb-6 text-sm text-slate-500">
          {otpRequired ? "Enter the verification code sent to your email." : "Sign in to your account"}
        </p>

        {!otpRequired ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorText message={error} />
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <Field label="Verification code">
              <Input required value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
            </Field>
            <ErrorText message={error} />
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify & sign in"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          New student or parent?{" "}
          <Link to="/register" className="font-medium text-indigo-600 hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          <Link to="/" className="font-medium text-indigo-600 hover:underline">Back to home</Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          Applying for admission?{" "}
          <Link to="/apply" className="font-medium text-indigo-600 hover:underline">
            Apply now
          </Link>
        </p>
      </Card>
    </div>
  );
}
