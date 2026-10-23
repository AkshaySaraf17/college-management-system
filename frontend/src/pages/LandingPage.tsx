import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useGet } from "../hooks/useLoad";
import { fmtDate } from "../components/kit";
import type { Course, Department } from "../api/types";

export function LandingPage() {
  const { user } = useAuth();
  const courses = useGet<Course[]>("/courses");
  const departments = useGet<Department[]>("/departments");
  const notices = useGet<{ id: number; title: string; body: string; createdAt: string }[]>("/announcements/public");

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <p className="text-lg font-semibold">CollegeMS <span className="hidden text-sm font-normal text-slate-500 sm:inline">College of Engineering & Technology</span></p>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/track" className="hidden rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">Track application</Link>
            <Link to="/apply" className="hidden rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">Apply</Link>
            {user ? <Link to="/dashboard" className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Open dashboard</Link>
              : <Link to="/login" className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Sign in</Link>}
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <h1 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Everything your college runs on, in one place</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">Admissions, attendance, exams and results, fees, library, hostel, transport and placements - for students, parents, faculty and staff, on any device.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/apply" className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700">Apply for admission</Link>
            <Link to="/login" className="rounded-md border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">Student / staff login</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-xl font-semibold">Programmes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(courses.data ?? []).map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 p-5">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-slate-500">{c.departmentName}</p>
              <p className="mt-2 text-sm text-slate-600">{c.level.toLowerCase()} · {c.durationYears} years · {c.totalSeats} seats</p>
              <Link to="/apply" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">Apply to this programme</Link>
            </div>
          ))}
          {courses.data?.length === 0 && <p className="text-sm text-slate-400">Programmes will be listed here.</p>}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Notices</h2>
            {(notices.data ?? []).length === 0 ? <p className="text-sm text-slate-400">No public notices at the moment.</p> : (
              <ul className="space-y-3">{(notices.data ?? []).map((n) => <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-4"><p className="font-medium">{n.title}</p><p className="text-xs text-slate-400">{fmtDate(n.createdAt)}</p><p className="mt-1 text-sm text-slate-600">{n.body}</p></li>)}</ul>
            )}
          </div>
          <div>
            <h2 className="mb-4 text-xl font-semibold">How admission works</h2>
            <ol className="space-y-3 text-sm text-slate-700">
              {["Submit the online application and upload your documents.", "The admissions office reviews it and records your entrance score.", "A merit list is published; shortlisted applicants are approved.", "Pay the admission fee at the accounts office.", "You are enrolled: your roll number, ID card and login are created."].map((step, i) => (
                <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{i + 1}</span>{step}</li>
              ))}
            </ol>
            <Link to="/track" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">Already applied? Track your application</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-4 text-xl font-semibold">Departments</h2>
        <div className="flex flex-wrap gap-2">{(departments.data ?? []).map((d) => <span key={d.id} className="rounded-full border border-slate-200 px-4 py-1.5 text-sm text-slate-700">{d.name}</span>)}</div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">CollegeMS · Install this site on your phone: use your browser's "Add to Home Screen".</footer>
    </div>
  );
}
