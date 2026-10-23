import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ActiveStudentProvider, useActiveStudent } from "../auth/ActiveStudent";
import { api, unwrap } from "../api/client";
import type { Role } from "../api/types";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const ADMINS: Role[] = ["SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL"];
const ACADEMIC: Role[] = [...ADMINS, "HOD"];
const TEACHING: Role[] = ["SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "HOD", "FACULTY"];
const FAMILY: Role[] = ["STUDENT", "PARENT"];

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/announcements", label: "Announcements" },
      { to: "/calendar", label: "Academic calendar" },
    ],
  },
  {
    section: "My studies",
    items: [
      { to: "/my/attendance", label: "Attendance", roles: FAMILY },
      { to: "/my/timetable", label: "Timetable", roles: [...FAMILY, "FACULTY"] },
      { to: "/my/exams", label: "Exams & hall tickets", roles: FAMILY },
      { to: "/my/results", label: "Results", roles: FAMILY },
      { to: "/my/learning", label: "Assignments & materials", roles: FAMILY },
      { to: "/my/fees", label: "Fees", roles: FAMILY },
      { to: "/my/scholarships", label: "Scholarships", roles: FAMILY },
      { to: "/my/campus", label: "Library, hostel & bus", roles: FAMILY },
      { to: "/my/documents", label: "ID card & certificates", roles: FAMILY },
      { to: "/link-child", label: "Link a child", roles: ["PARENT"] },
    ],
  },
  {
    section: "Teaching",
    items: [
      { to: "/teach/attendance", label: "Mark attendance", roles: TEACHING },
      { to: "/teach/marks", label: "Marks & online exams", roles: TEACHING },
      { to: "/teach/classroom", label: "Classroom (LMS)", roles: TEACHING },
      { to: "/faculty/me/performance", label: "My performance", roles: ["FACULTY"] },
      { to: "/me/payslips", label: "My payslips", roles: ["FACULTY"] },
      { to: "/faculty/me", label: "My profile & leave", roles: ["FACULTY"] },
    ],
  },
  {
    section: "Academics",
    items: [
      { to: "/admissions", label: "Admissions", roles: [...ACADEMIC, "ACCOUNTANT"] },
      { to: "/students", label: "Students", roles: [...TEACHING, "ACCOUNTANT"] },
      { to: "/faculty", label: "Faculty", roles: ACADEMIC },
      { to: "/departments", label: "Departments", roles: ["SUPER_ADMIN", "COLLEGE_ADMIN"] },
      { to: "/courses", label: "Courses & subjects", roles: ACADEMIC },
      { to: "/admin/exams", label: "Exams & results", roles: ACADEMIC },
      { to: "/admin/timetable", label: "Timetable setup", roles: ACADEMIC },
      { to: "/analytics", label: "AI performance analytics", roles: TEACHING },
    ],
  },
  {
    section: "Finance",
    items: [
      { to: "/finance/fees", label: "Fees", roles: [...ADMINS, "ACCOUNTANT"] },
      { to: "/finance/scholarships", label: "Scholarships", roles: [...ADMINS, "ACCOUNTANT"] },
      { to: "/finance/payroll", label: "Payroll", roles: ["SUPER_ADMIN", "COLLEGE_ADMIN", "ACCOUNTANT"] },
    ],
  },
  {
    section: "Campus",
    items: [
      { to: "/library", label: "Library" },
      { to: "/hostel", label: "Hostel", roles: ["SUPER_ADMIN", "COLLEGE_ADMIN", "HOSTEL_WARDEN"] },
      { to: "/transport", label: "Transport", roles: ["SUPER_ADMIN", "COLLEGE_ADMIN", "TRANSPORT_MANAGER"] },
      { to: "/placement", label: "Placements", roles: ["SUPER_ADMIN", "COLLEGE_ADMIN", "PLACEMENT_OFFICER", "STUDENT"] },
    ],
  },
  {
    section: "Administration",
    items: [
      { to: "/admin/users", label: "Users & roles", roles: ["SUPER_ADMIN", "COLLEGE_ADMIN"] },
      { to: "/admin/communications", label: "Communications", roles: ADMINS },
      { to: "/reports", label: "Reports & analytics", roles: [...ACADEMIC, "ACCOUNTANT"] },
    ],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { hasRole } = useAuth();
  return (
    <nav className="flex flex-col gap-4">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.roles || hasRole(...i.roles));
        if (items.length === 0) return null;
        return (
          <div key={group.section}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.section}</p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function Bell() {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () =>
      unwrap<{ count: number }>(api.get("/notifications/unread-count"))
        .then((r) => alive && setCount(r.count))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [location.pathname]);

  return (
    <Link to="/notifications" className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifications (${count} unread)`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function ChildSwitcher() {
  const { students, student, select } = useActiveStudent();
  const { hasRole } = useAuth();
  if (!hasRole("PARENT") || students.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="hidden sm:inline">Viewing</span>
      <select value={student?.id ?? ""} onChange={(e) => select(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <ActiveStudentProvider>
      <div className="flex min-h-screen bg-slate-50">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex print:hidden">
          <Link to="/dashboard" className="mb-5 block px-2">
            <p className="text-lg font-semibold text-slate-900">CollegeMS</p>
            <p className="text-xs text-slate-500">College Management System</p>
          </Link>
          <div className="-mr-2 flex-1 overflow-y-auto pr-2">
            <NavList />
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <Link to="/profile" className="block truncate text-sm font-medium text-slate-800 hover:underline">
              {user?.fullName}
            </Link>
            <p className="truncate text-xs text-slate-500">{user?.roles.map((r) => r.replaceAll("_", " ")).join(", ")}</p>
            <button onClick={logout} className="mt-3 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Log out
            </button>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden print:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white p-4 shadow-xl">
              <p className="mb-4 px-2 text-lg font-semibold text-slate-900">CollegeMS</p>
              <NavList onNavigate={() => setOpen(false)} />
              <button onClick={logout} className="mt-6 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
                Log out
              </button>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 print:hidden">
            <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <p className="font-semibold text-slate-900 lg:hidden">CollegeMS</p>
            <div className="ml-auto flex items-center gap-3">
              <ChildSwitcher />
              <Bell />
              <Link to="/profile" className="hidden text-sm text-slate-600 hover:underline sm:inline">
                {user?.fullName}
              </Link>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </ActiveStudentProvider>
  );
}
