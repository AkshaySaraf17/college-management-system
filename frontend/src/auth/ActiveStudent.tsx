import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, unwrap, type Row } from "../api/client";
import { useAuth } from "./AuthContext";
import { Loading } from "../components/kit";
import { Card } from "../components/ui";

interface Ctx {
  student: Row | null;
  students: Row[];
  loading: boolean;
  select: (id: string) => void;
}

const ActiveStudentContext = createContext<Ctx>({ student: null, students: [], loading: false, select: () => {} });

/** For a student: their own record. For a parent: the selected child (persisted). Staff get nothing here. */
export function ActiveStudentProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const [students, setStudents] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("activeStudent");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const isStudent = hasRole("STUDENT");
  const isParent = hasRole("PARENT");

  useEffect(() => {
    if (!user) return;
    if (isStudent) {
      setLoading(true);
      unwrap<Row>(api.get("/students/me"))
        .then((s) => setStudents([s]))
        .catch(() => setStudents([]))
        .finally(() => setLoading(false));
    } else if (isParent) {
      setLoading(true);
      unwrap<Row[]>(api.get("/parents/me/children"))
        .then(setStudents)
        .catch(() => setStudents([]))
        .finally(() => setLoading(false));
    } else {
      setStudents([]);
    }
  }, [user, isStudent, isParent]);

  const value = useMemo<Ctx>(() => {
    const student = students.find((s) => s.id === selectedId) ?? students[0] ?? null;
    return {
      student,
      students,
      loading,
      select: (id: string) => {
        setSelectedId(id);
        try {
          localStorage.setItem("activeStudent", id);
        } catch {
          // storage unavailable: selection just won't persist
        }
      },
    };
  }, [students, selectedId, loading]);

  return <ActiveStudentContext.Provider value={value}>{children}</ActiveStudentContext.Provider>;
}

export const useActiveStudent = () => useContext(ActiveStudentContext);

/** Renders children only once a student record is available; explains what to do otherwise. */
export function WithStudent({ children }: { children: (student: Row) => ReactNode }) {
  const { student, loading } = useActiveStudent();
  const { hasRole } = useAuth();
  if (loading) return <Loading what="Loading student" />;
  if (!student) {
    return (
      <Card>
        {hasRole("PARENT") ? (
          <p className="text-sm text-slate-600">
            No child is linked to your account yet.{" "}
            <Link to="/link-child" className="font-medium text-indigo-600 hover:underline">
              Link your child
            </Link>{" "}
            using their roll number and date of birth.
          </p>
        ) : (
          <p className="text-sm text-slate-600">This page is for enrolled students and their parents.</p>
        )}
      </Card>
    );
  }
  return <>{children(student)}</>;
}
