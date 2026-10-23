import { useAuth } from "../../auth/AuthContext";
import { WithStudent } from "../../auth/ActiveStudent";
import { useGet } from "../../hooks/useLoad";
import { PageHeader } from "../../components/ui";
import { ErrorBanner, Loading } from "../../components/kit";
import { TimetableGrid } from "../../components/TimetableGrid";

function Grid({ path, faculty }: { path: string; faculty: boolean }) {
  const { data, loading, error } = useGet<any[]>(path);
  if (loading) return <Loading />;
  return (
    <>
      <ErrorBanner message={error} />
      <TimetableGrid slots={data ?? []} showFaculty={!faculty} showBatch={faculty} />
    </>
  );
}

export function MyTimetablePage() {
  const { hasRole } = useAuth();
  const isFaculty = hasRole("FACULTY") && !hasRole("STUDENT", "PARENT");
  return (
    <div>
      <PageHeader title="Timetable" subtitle={isFaculty ? "Your weekly teaching schedule." : "Your weekly class schedule. Today is highlighted."} />
      {isFaculty ? <Grid path="/timetable/my" faculty /> : <WithStudent>{(s) => <Grid key={s.id} path={`/timetable/my?studentId=${s.id}`} faculty={false} />}</WithStudent>}
    </div>
  );
}
