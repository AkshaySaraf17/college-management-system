import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import type { Role } from "./api/types";

import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { ProfilePage } from "./pages/ProfilePage";

import { ApplyPage } from "./pages/admissions/ApplyPage";
import { TrackPage } from "./pages/admissions/TrackPage";
import { AdmissionsListPage } from "./pages/admissions/AdmissionsListPage";
import { AdmissionDetailPage } from "./pages/admissions/AdmissionDetailPage";

import { StudentsListPage } from "./pages/students/StudentsListPage";
import { StudentDetailPage } from "./pages/students/StudentDetailPage";

import { FacultyListPage } from "./pages/faculty/FacultyListPage";
import { FacultyDetailPage } from "./pages/faculty/FacultyDetailPage";
import { FacultyRegisterPage } from "./pages/faculty/FacultyRegisterPage";

import { DepartmentsPage } from "./pages/academics/DepartmentsPage";
import { CoursesPage } from "./pages/academics/CoursesPage";
import { CourseDetailPage } from "./pages/academics/CourseDetailPage";
import { CalendarPage } from "./pages/academics/CalendarPage";

import { MyAttendancePage } from "./pages/my/MyAttendancePage";
import { MyTimetablePage } from "./pages/my/MyTimetablePage";
import { MyExamsPage } from "./pages/my/MyExamsPage";
import { TakeExamPage } from "./pages/my/TakeExamPage";
import { MyResultsPage } from "./pages/my/MyResultsPage";
import { MyFeesPage } from "./pages/my/MyFeesPage";
import { MyLearningPage } from "./pages/my/MyLearningPage";
import { MyCampusPage } from "./pages/my/MyCampusPage";
import { MyScholarshipsPage } from "./pages/my/MyScholarshipsPage";
import { MyDocumentsPage, StaffStudentDocumentsPage } from "./pages/my/MyDocumentsPage";
import { LinkChildPage } from "./pages/my/LinkChildPage";
import { ReceiptPage } from "./pages/print/ReceiptPage";

import { MarkAttendancePage } from "./pages/teach/MarkAttendancePage";
import { MarksEntryPage } from "./pages/teach/MarksEntryPage";
import { ClassroomPage } from "./pages/teach/ClassroomPage";
import { PayslipsPage } from "./pages/teach/PayslipsPage";
import { FacultyPerformancePage } from "./pages/teach/FacultyPerformancePage";

import { UsersPage } from "./pages/admin/UsersPage";
import { TimetableAdminPage } from "./pages/admin/TimetableAdminPage";
import { ExamsAdminPage, ExamDetailPage } from "./pages/admin/ExamsAdminPage";
import { ReportsPage } from "./pages/admin/ReportsPage";
import { AnalyticsPage } from "./pages/admin/AnalyticsPage";
import { CommunicationsPage } from "./pages/admin/CommunicationsPage";

import { FeesAdminPage } from "./pages/finance/FeesAdminPage";
import { ScholarshipsAdminPage } from "./pages/finance/ScholarshipsAdminPage";
import { PayrollAdminPage } from "./pages/finance/PayrollAdminPage";

import { LibraryPage } from "./pages/campus/LibraryPage";
import { HostelPage } from "./pages/campus/HostelPage";
import { TransportPage } from "./pages/campus/TransportPage";
import { PlacementPage } from "./pages/campus/PlacementPage";

const ADMINS: Role[] = ["SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL"];
const ACADEMIC: Role[] = [...ADMINS, "HOD"];
const TEACHING: Role[] = [...ACADEMIC, "FACULTY"];
const STUDENT_DATA: Role[] = [...TEACHING, "ACCOUNTANT"];
const FAMILY: Role[] = ["STUDENT", "PARENT"];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/track" element={<TrackPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/receipt/:paymentId" element={<ReceiptPage />} />
              <Route path="/students/me" element={<StudentDetailPage />} />
              <Route path="/faculty/me" element={<FacultyDetailPage />} />

              <Route element={<ProtectedRoute roles={[...FAMILY, "FACULTY"]} />}>
                <Route path="/my/timetable" element={<MyTimetablePage />} />
              </Route>
              <Route element={<ProtectedRoute roles={FAMILY} />}>
                <Route path="/my/attendance" element={<MyAttendancePage />} />
                <Route path="/my/exams" element={<MyExamsPage />} />
                <Route path="/my/results" element={<MyResultsPage />} />
                <Route path="/my/learning" element={<MyLearningPage />} />
                <Route path="/my/fees" element={<MyFeesPage />} />
                <Route path="/my/scholarships" element={<MyScholarshipsPage />} />
                <Route path="/my/campus" element={<MyCampusPage />} />
                <Route path="/my/documents" element={<MyDocumentsPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={["STUDENT"]} />}>
                <Route path="/my/exams/:scheduleId/take" element={<TakeExamPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={["PARENT"]} />}>
                <Route path="/link-child" element={<LinkChildPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={TEACHING} />}>
                <Route path="/teach/attendance" element={<MarkAttendancePage />} />
                <Route path="/teach/marks" element={<MarksEntryPage />} />
                <Route path="/teach/classroom" element={<ClassroomPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={["FACULTY"]} />}>
                <Route path="/me/payslips" element={<PayslipsPage />} />
                <Route path="/faculty/me/performance" element={<FacultyPerformancePage />} />
              </Route>

              <Route element={<ProtectedRoute roles={STUDENT_DATA} />}>
                <Route path="/students" element={<StudentsListPage />} />
                <Route path="/students/:id" element={<StudentDetailPage />} />
                <Route path="/students/:id/documents" element={<StaffStudentDocumentsPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={ACADEMIC} />}>
                <Route path="/faculty" element={<FacultyListPage />} />
                <Route path="/faculty/:id" element={<FacultyDetailPage />} />
                <Route path="/faculty/:id/performance" element={<FacultyPerformancePage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/courses/:id" element={<CourseDetailPage />} />
                <Route path="/admin/exams" element={<ExamsAdminPage />} />
                <Route path="/admin/exams/:id" element={<ExamDetailPage />} />
                <Route path="/admin/timetable" element={<TimetableAdminPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={["SUPER_ADMIN", "COLLEGE_ADMIN"]} />}>
                <Route path="/faculty/register" element={<FacultyRegisterPage />} />
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={[...ACADEMIC, "ACCOUNTANT"]} />}>
                <Route path="/admissions" element={<AdmissionsListPage />} />
                <Route path="/admissions/:id" element={<AdmissionDetailPage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={ADMINS} />}>
                <Route path="/admin/communications" element={<CommunicationsPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={[...ADMINS, "ACCOUNTANT"]} />}>
                <Route path="/finance/fees" element={<FeesAdminPage />} />
                <Route path="/finance/scholarships" element={<ScholarshipsAdminPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={["SUPER_ADMIN", "COLLEGE_ADMIN", "ACCOUNTANT"]} />}>
                <Route path="/finance/payroll" element={<PayrollAdminPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={["SUPER_ADMIN", "COLLEGE_ADMIN", "HOSTEL_WARDEN"]} />}>
                <Route path="/hostel" element={<HostelPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={["SUPER_ADMIN", "COLLEGE_ADMIN", "TRANSPORT_MANAGER"]} />}>
                <Route path="/transport" element={<TransportPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={["SUPER_ADMIN", "COLLEGE_ADMIN", "PLACEMENT_OFFICER", "STUDENT"]} />}>
                <Route path="/placement" element={<PlacementPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
