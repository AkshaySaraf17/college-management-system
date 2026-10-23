export type Role =
  | "SUPER_ADMIN"
  | "COLLEGE_ADMIN"
  | "PRINCIPAL"
  | "HOD"
  | "FACULTY"
  | "STUDENT"
  | "PARENT"
  | "ACCOUNTANT"
  | "LIBRARIAN"
  | "PLACEMENT_OFFICER"
  | "HOSTEL_WARDEN"
  | "TRANSPORT_MANAGER";

export interface AuthUser {
  email: string;
  fullName: string;
  roles: Role[];
}

export interface Department {
  id: number;
  name: string;
  code: string;
  hodUserId: string | null;
  establishedYear: number | null;
}

export interface Course {
  id: number;
  departmentId: number;
  departmentName: string;
  name: string;
  code: string;
  level: "UNDERGRADUATE" | "POSTGRADUATE" | "DIPLOMA";
  durationYears: number;
  totalSemesters: number;
  totalSeats: number;
}

export interface Batch {
  id: number;
  courseId: number;
  name: string;
  startYear: number;
  endYear: number;
}

export interface Semester {
  id: number;
  courseId: number;
  number: number;
  name: string;
}

export interface Subject {
  id: number;
  semesterId: number;
  name: string;
  code: string;
  credits: number;
  elective: boolean;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  eventType: "HOLIDAY" | "EXAM" | "SEMESTER_START" | "SEMESTER_END" | "GENERAL";
  startDate: string;
  endDate: string;
  departmentId: number | null;
}

export type AdmissionStatus =
  | "SUBMITTED"
  | "DOCUMENTS_PENDING"
  | "UNDER_REVIEW"
  | "SHORTLISTED"
  | "MERIT_LISTED"
  | "APPROVED"
  | "REJECTED"
  | "FEE_PENDING"
  | "ENROLLED"
  | "WITHDRAWN";

export interface Admission {
  id: string;
  applicationNumber: string;
  courseId: number;
  courseName: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  status: AdmissionStatus;
  entranceExamScore: number | null;
  meritScore: number | null;
  meritRank: number | null;
  admissionFeePaid: boolean;
  admissionFeeAmount: number | null;
  enrolledStudentId: string | null;
  reviewNotes: string | null;
}

export interface Student {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  rollNumber: string;
  idCardNumber: string;
  courseId: number;
  courseName: string;
  batchId: number;
  batchName: string;
  currentSemesterId: number | null;
  currentSemesterName: string | null;
  dateOfBirth: string;
  gender: string | null;
  bloodGroup: string | null;
  address: string | null;
  status: "ACTIVE" | "ON_LEAVE" | "GRADUATED" | "EXPELLED" | "WITHDRAWN";
  admittedOn: string;
}

export interface ParentInfo {
  id: string;
  fullName: string;
  relation: "FATHER" | "MOTHER" | "GUARDIAN";
  phone: string;
  email: string | null;
  occupation: string | null;
  primaryContact: boolean;
}

export interface AcademicHistory {
  id: number;
  semesterId: number;
  semesterName: string;
  status: "IN_PROGRESS" | "COMPLETED" | "BACKLOG";
  sgpa: number | null;
}

export interface Faculty {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  employeeCode: string;
  departmentId: number | null;
  departmentName: string | null;
  designation: string | null;
  qualification: string | null;
  dateOfJoining: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "VISITING";
  status: "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "TERMINATED";
  documentsVerified: boolean;
}

export interface FacultyLeave {
  id: number;
  facultyId: string;
  leaveType: "CASUAL" | "SICK" | "EARNED" | "UNPAID";
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface SubjectAllocation {
  id: number;
  facultyId: string;
  subjectId: number;
  subjectName: string;
  batchId: number;
  batchName: string;
  academicYear: string;
}
