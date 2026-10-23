# Project documentation

## 1. Overview

The College Management System covers the day-to-day work of a college for twelve kinds of users: super admin, college admin, principal, head of department, faculty, student, parent, accountant, librarian, placement officer, hostel warden and transport manager.

It consists of four parts:

| Part | Technology | Role |
|---|---|---|
| API | Java 17, Spring Boot 3, Spring Security, Spring Data JPA, Flyway | Business rules, authorization, persistence |
| Web app | React 19, TypeScript, Vite, Tailwind CSS | Role-based user interface, installable as a PWA |
| Database | PostgreSQL 16 | 58 tables created by versioned migrations |
| Analysis service | Python, FastAPI | Student risk score and score forecast |

## 2. Architecture

```
Browser (React) --/api--> Spring Boot API --> PostgreSQL
                              |
                              +--> FastAPI analysis service
```

- The web app talks only to the API. In development Vite proxies `/api` to port 8080.
- Authentication uses short-lived JWT access tokens (30 minutes) and rotating refresh tokens stored hashed. Each request also checks that the account is still active.
- Authorization is enforced on the server in two layers: endpoint rules by role, and record rules (a student sees only their own records, a parent only linked children, faculty only classes they are allocated to).
- The schema is owned by Flyway migrations in `backend/src/main/resources/db/migration`. Hibernate only validates it.
- The first modules (authentication, admissions, students, faculty, courses) use JPA entities. The later modules use SQL written for each screen through a small helper, because most of their screens are joins.

### Code organisation

```
backend/src/main/java/com/cms/backend/
  auth, user, security, config      accounts, tokens, security configuration
  admission, student, faculty,
  course, department                core academic records
  attendance, timetable, exam       classes, schedules, exams, results
  fee, scholarship, payroll         finance
  library, hostel, transport        campus services
  placement, lms, notification      placements, learning, communication
  ai, report                        analysis client, dashboards, exports
  common                            access checks, SQL helper, error handling
frontend/src/
  pages/    one folder per area (my, teach, admin, finance, campus, ...)
  components/, hooks/, auth/, api/  shared building blocks
```

## 3. Main workflows

**Admission to enrollment.** An applicant submits the public form and uploads documents, then tracks the application by number. Staff review it and record the entrance score. A merit list ranks reviewed applicants per course. After approval and fee payment, enrollment creates the student account, a roll number and an ID card number, and links the guardian.

**Attendance.** Faculty mark attendance per subject, batch, date and period. Only faculty allocated to that subject and batch can do so. Students and parents see subject-wise percentages; anything below 75% is flagged and absences generate notifications.

**Exams and results.** An exam belongs to a batch and semester and has one paper per subject. Papers can be written or online. Online papers are multiple choice, timed, and graded when submitted. Marks are entered per paper. Publishing is only allowed once every student has marks or an absence, assigns grades and grade points, and for final exams writes each student's SGPA. After publishing, marks cannot be edited. CGPA is credit-weighted over the latest final-exam result of each subject.

**Fees.** Fee heads are defined per course and semester. Invoices are generated for a whole batch and are not duplicated if generation is repeated. Payments can be partial. Approving a scholarship reduces the open invoices of that student.

**Library.** Members borrow within a loan limit. A late return creates a fine of 2.00 per day. A member with an overdue book or an unpaid fine cannot borrow again.

**Performance analysis.** The API collects a student's attendance, average marks, score history, assignment completion, backlogs and overdue fees and sends them to the analysis service. It returns a risk score from 0 to 100 where every point is attributed to a named factor, recommendations, and a straight-line forecast of the next exam percentage.

## 4. Roles and access

| Role | Main areas |
|---|---|
| Super admin, college admin | Everything, including users and roles |
| Principal | Academics, reports, announcements, finance views |
| HOD | Courses, exams, timetable, analytics, reports |
| Faculty | Attendance, marks, classroom, leave, payslips, own timetable |
| Student | Own attendance, results, fees, exams, assignments, library, hostel, transport, placements |
| Parent | The same views for linked children, after linking with roll number and date of birth |
| Accountant | Fees, scholarships, payroll, admission fees |
| Librarian | Catalog, issue and return |
| Hostel warden | Hostels, rooms, allocations, complaints |
| Transport manager | Routes, stops, vehicles, riders |
| Placement officer | Companies, drives, applicants |

Students and parents can register themselves. All other accounts are created by an administrator.

## 5. Running and testing

See the [README](../README.md) for setup. `python3 scripts/e2e.py` runs 301 checks against a running stack. They cover the workflows above and also confirm that forbidden actions are rejected: reading another student's records, using an endpoint without the role, paying an invoice twice, clashing timetable slots, editing published marks, and using the token of a suspended account.

## 6. Security notes

- No passwords or keys are stored in the repository. Local secrets are generated into an ignored file; deployments supply them through environment variables (see `.env.example`).
- Passwords are stored with BCrypt. OTP codes and refresh tokens are stored hashed.
- Five failed sign-ins lock an account for 15 minutes.
- All database access is parameterised. CSV exports neutralise spreadsheet formulas.
- Uploads are limited to 10 MB and to a fixed list of file types, and are stored under generated names.
- Links shared as study material must start with http or https.

## 7. Limitations

See "Known limitations" in the README.
