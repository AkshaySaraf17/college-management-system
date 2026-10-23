---
title: "College Management System"
subtitle: "Final Project Status Report"
author: Akshay Saraf
date: 23 October 2026
---

**Author:** Akshay Saraf  
**Repository:** https://github.com/AkshaySaraf17/college-management-system  
**Report date:** 23 October 2026

# Contents {#contents}

- [1. Executive summary](#s1)
- [2. How to read this report](#s2)
- [3. Requirements traceability](#s3)
    - [3.1 Module 1: User authentication and role management](#s3-1)
    - [3.2 Module 2: Admission management](#s3-2)
    - [3.3 Module 3: Student management](#s3-3)
    - [3.4 Module 4: Faculty management](#s3-4)
    - [3.5 Module 5: Course and department management](#s3-5)
    - [3.6 Other modules in the brief](#s3-6)
- [4. Module status and evidence](#s4)
- [5. Testing summary](#s5)
    - [5.1 Automated tests](#s5-1)
    - [5.2 Browser testing by role](#s5-2)
    - [5.3 Interactions performed by hand in a browser](#s5-3)
    - [5.4 Not tested](#s5-4)
- [6. Defects found and fixed](#s6)
- [7. Security summary](#s7)
- [8. What was not done](#s8)
- [9. Risks and recommendations](#s9)
- [10. Pre-deployment checklist](#s10)
- [11. Deliverables](#s11)

# 1. Executive summary {#s1}

The College Management System is complete and working. Every module in the project brief has been built end to end: database, server logic and user interface. The system was exercised with 301 automated checks (all passing) and by opening every screen for every one of the twelve roles in a real browser.

| Measure | Result |
|---|---|
| Modules requested | 17 areas plus mobile access (listed in Section 3) |
| Modules delivered | All, with the exceptions in Section 8 |
| Database | 58 tables, 5 migrations |
| Server code | About 150 Java classes, 8,600 lines including SQL and configuration |
| Web application | About 70 source files, 6,200 lines |
| API endpoints | About 140 |
| Automated end-to-end checks | 301 run, 301 passed, 0 failed |
| User roles verified in a browser | 12 of 12 |
| Screenshots in the documentation | 48 |
| Known security issues open | None critical; limitations listed in Section 7 |
| Source code | https://github.com/AkshaySaraf17/college-management-system |

**Overall status: complete, with the limitations in Section 8.** The system is ready to be demonstrated and reviewed. It needs the steps in Section 10 before it is used with real data.

# 2. How to read this report {#s2}

Section 3 compares the brief with what was delivered, item by item. Section 4 gives the status of each module with the evidence. Section 5 summarises testing. Section 6 lists the defects found and fixed during the project. Section 7 summarises security. Section 8 lists what was not done. Sections 9 and 10 give risks, recommendations and the deployment checklist. Section 11 lists the deliverables.

Status words used: **Complete** (works end to end through the user interface), **Complete (API only)** (works in the server but there is no screen for it), **Partial** (part of the requirement is met) and **Not done**.

# 3. Requirements traceability {#s3}

This table follows the project brief and its module descriptions.

## 3.1 Module 1: User authentication and role management {#s3-1}

| Requirement | Status | Notes |
|---|---|---|
| User registration | Complete | Students and parents register themselves; other roles are created by an administrator |
| Login and logout | Complete | JWT access and refresh tokens |
| OTP verification | Complete | Six-digit emailed code, valid 10 minutes |
| Password recovery | Complete | Forgot-password screen with an emailed code |
| Email verification | Complete | Required before a self-registered account can sign in |
| Two-factor authentication | Complete | Optional, switched on in Profile and security |
| Role-based access control | Complete | 12 roles; enforced by role and by record on the server |
| Session management | Complete | List of active sessions, sign out everywhere, immediate lock-out on suspension |
| Admin approval step (if required) | Partial | Staff accounts are created by administrators, so they are approved by construction; there is no separate approval queue for self-registered students and parents, who activate by verifying their email |
| 12 roles | Complete | Super Admin, College Admin, Principal, HOD, Faculty, Student, Parent, Accountant, Librarian, Placement Officer, Hostel Warden, Transport Manager |

## 3.2 Module 2: Admission management {#s3-2}

| Requirement | Status | Notes |
|---|---|---|
| Online admission form | Complete | Public, no account needed |
| Document upload | Complete | Applicant uploads without signing in; staff download and verify |
| Application review | Complete | Staff review and record notes |
| Entrance exam management | Partial | The entrance score is recorded and used for ranking. Scheduling an entrance test is not built |
| Merit list generation | Complete | Ranks reviewed applicants per course |
| Admission approval | Complete | |
| Student enrollment | Complete | Creates the account, roll number, ID card number and guardian record |
| Admission fee collection | Complete | Recorded by the accountant or an administrator; enrollment is blocked until it is recorded |
| Application tracking by applicants | Complete | By application number |

## 3.3 Module 3: Student management {#s3-3}

| Requirement | Status | Notes |
|---|---|---|
| Student profile | Complete | Viewing. Editing personal details (blood group, address) exists in the API only |
| Academic history | Complete | SGPA written when a final exam is published |
| Personal and parent information | Complete | Guardian created at enrollment; parents can link children |
| Attendance | Complete | |
| Internal marks | Complete | Internal and midterm exams are supported and shown in results |
| Semester records | Complete | |
| Student ID card | Complete | Printable |
| Certificates | Partial | Bonafide certificate only |
| Student dashboard (attendance, results, fees, assignments, notifications, timetable, LMS) | Complete | |

## 3.4 Module 4: Faculty management {#s3-4}

| Requirement | Status | Notes |
|---|---|---|
| Faculty registration | Complete | Creates the login and profile |
| Document verification | Complete (API only) | Upload and verify endpoints exist; there is no screen yet |
| Department assignment | Complete | Chosen at registration. Changing it later is API only |
| Subject allocation | Complete | Screen on the faculty page |
| Faculty attendance | Complete (API only) | Endpoints exist and feed the performance report; there is no marking screen yet |
| Leave management | Complete | Apply, approve or reject, with notifications |
| Payroll integration | Complete | Salary structures and monthly payslips with unpaid-leave deduction |
| Performance reports | Complete | Activity report from attendance, results, assignments and leave |

## 3.5 Module 5: Course and department management {#s3-5}

| Requirement | Status | Notes |
|---|---|---|
| Department creation | Complete | Assigning a head of department is API only |
| Course creation | Complete | |
| Semester management | Complete | Created automatically from the course's number of semesters |
| Subject management and credit allocation | Complete | |
| Academic calendar | Complete | |
| Batch management | Complete | |

## 3.6 Other modules in the brief {#s3-6}

| Requirement | Status | Notes |
|---|---|---|
| Attendance management | Complete | |
| Timetable management | Complete | With clash detection |
| Examination management and online exams | Complete | Written and online multiple-choice papers |
| Result management, automatic publishing | Complete | Grades, SGPA and CGPA calculated on publishing |
| Fee management, digital collection | Complete | Online payment is a demonstration gateway |
| Scholarship management | Complete | |
| Library management | Complete | Book reservations are not built |
| Hostel management | Complete | |
| Transport management | Complete | |
| Placement management | Complete | |
| Learning management system | Complete | Materials, assignments, grading. No quizzes outside the exam module, no discussion forum |
| Notifications and communication | Complete | In application only; no SMS or push |
| AI-based student performance analysis | Complete | Fixed weighted formula and straight-line forecast, not a trained model |
| Reports and analytics dashboard | Complete | Charts and CSV export |
| Mobile application, Android and iOS | Partial | Responsive web application, installable as a PWA. No native apps |
| Improve communication between college, students and parents | Complete | Parents have their own accounts and notifications |

# 4. Module status and evidence {#s4}

"Checks" are automated end-to-end checks from `scripts/e2e.py`. "Browser" means the screens were opened and used in a real browser.

| Module | Status | Evidence |
|---|---|---|
| Authentication and users | Complete | 22 checks for sign-in, codes, access and 14 for user administration and sessions; Browser |
| Courses, subjects, batches | Complete | 8 checks; Browser |
| Faculty | Complete | 12 checks; Browser |
| Admissions | Complete | 28 checks; Browser: public form, upload, staff workflow |
| Students and parents | Complete | 11 checks; Browser |
| Attendance | Complete | 14 checks; Browser: marking and student views |
| Timetable | Complete | 8 checks; Browser: adding a class |
| Exams and results | Complete | 40 checks; Browser: taking an online exam, results, CGPA |
| Fees and scholarships | Complete | 30 checks; Browser: all fee screens as accountant and student |
| Payroll | Complete | 8 checks; Browser |
| Library | Complete | 23 checks; Browser: desk and loans |
| Hostel and transport | Complete | 19 checks; Browser |
| Placements | Complete | 13 checks; Browser |
| Learning, announcements, notifications | Complete | 28 checks; Browser |
| Performance analysis, reports | Complete | 23 checks; Browser: ranking and explanation |
| Mobile access | Partial | Browser at phone width; manifest and service worker present |

# 5. Testing summary {#s5}

## 5.1 Automated tests {#s5-1}

The test script was run repeatedly against a freshly created database and against a database that already contained data from earlier runs. The final result was **301 checks passed, 0 failed**. The checks cover correct behaviour and, equally, refusals: reading another student's records, calling an endpoint without the right role, paying a paid invoice, overpaying, timetable clashes, editing published marks, starting an exam twice, and using the token of a suspended account.

## 5.2 Browser testing by role {#s5-2}

| Role | Screens opened | Result |
|---|---|---|
| Student | 16 | No errors |
| Parent | Dashboard, child switcher, linked-child data | No errors |
| Faculty | 13 | No errors |
| HOD | 15 | No errors |
| Principal | 16 | No errors |
| Accountant | 10 | One error found and fixed (admissions list) |
| Librarian | Dashboard, catalog, desk, loans | No errors |
| Hostel warden, transport manager, placement officer | All their screens | No errors |
| Super admin | 16 | No errors |

## 5.3 Interactions performed by hand in a browser {#s5-3}

Signing in; marking attendance (absent student notified); taking an online exam and receiving an automatic mark (8 out of 10); adding a timetable class; applying for admission and uploading a document without signing in; viewing that application as an accountant; allocating a subject to a teacher (and seeing a duplicate refused); and checking the phone layout at 375 px width.

## 5.4 Not tested {#s5-4}

Individual class-level unit tests, automated browser tests and load or volume tests were not written.

# 6. Defects found and fixed {#s6}

| # | Problem | Impact | Fix |
|---|---|---|---|
| 1 | Expired or invalid tokens returned 403 | The web app never refreshed the sign-in | Return 401 for unauthenticated requests |
| 2 | Starting an online exam twice at the same moment raised a conflict | Red error on the exam page | Insert ignores a duplicate |
| 3 | Missing space in a SQL text block | Broadcast notifications failed | Corrected; test added |
| 4 | Approving a leave marked the teacher as permanently on leave | Wrong status | Leave no longer changes status; one decision per request |
| 5 | Accountants could see admissions but the list was denied | Page showed "Access denied" | Accountants allowed to view admissions |
| 6 | Suspended users kept access until the token expired (up to 30 minutes) | Security | Status checked on every request |
| 7 | One-time codes were logged in every environment | Security | Logged only when explicitly enabled |
| 8 | Risk score too low for a clearly struggling student (58, Medium) | Misleading analysis | Thresholds made steeper (now 70, High) |
| 9 | Duplicate React key on the librarian dashboard | Console warning | Fixed |
| 10 | Status badges showed borrowed words ("Active" for "Present") | Confusing labels | Badges now accept their own label |
| 11 | No screen to allocate subjects to faculty | Workflow blocked in the UI | Screen added |
| 12 | No screen for password recovery | Users could not recover accounts | Screen added |
| 13 | Credentials in the repository (default admin password, token key, database password) | Security | Removed; secrets generated locally or supplied by environment; history rewritten |

# 7. Security summary {#s7}

| Area | Status |
|---|---|
| Passwords | BCrypt; lock-out after 5 failures |
| Tokens | Short-lived access tokens; single-use hashed refresh tokens; account status checked every request |
| Authorization | Role rules on endpoints and per-record checks (student, parent, allocated faculty) |
| Injection | Parameterised SQL; CSV export neutralises formulas |
| Uploads | Type whitelist, 10 MB limit, random names |
| Secrets in the repository | None. `.env.example` has blank placeholders |
| Transport security | Not applied by the application; HTTPS must be provided by the deployment |
| Known limits | Any signed-in user who has a file's identifier can download it; role changes apply at next sign-in; no rate limiting beyond the sign-in lock-out |

# 8. What was not done {#s8}

| Item | Reason or note |
|---|---|
| Native Android and iOS apps | Not feasible to build and test alongside the rest; replaced by an installable web app |
| Real online payment | No payment provider account; the demonstration gateway always succeeds |
| SMS and push notifications | Not in scope; notifications are in-app and email is used for one-time codes only |
| Trained machine-learning model | No labelled historical data; a documented formula is used instead |
| Entrance test scheduling | Only the entrance score is recorded and ranked |
| Screens for faculty document verification, faculty attendance, department head assignment, editing student personal details | The server features exist; the screens are not built |
| Book reservations, discussion forums | Not requested in detail |
| Multi-college support | One college per installation |
| Object storage and virus scanning for uploads | Files are stored on local disk |
| Unit tests, automated browser tests, load tests | Only end-to-end API tests and manual browser checks |

# 9. Risks and recommendations {#s9}

| Risk | Likelihood | Effect | Recommendation |
|---|---|---|---|
| Uploaded files lost with the server's disk | Medium | Loss of documents | Use backed-up object storage |
| A person with a file identifier can download it | Low | Disclosure | Add per-file permission checks before using real documents |
| Reliance on emailed codes without a mail server | High if not configured | Users cannot activate | Configure SMTP before launch |
| Performance with large data | Unknown | Slow reports | Run a load test; add indexes as needed |
| Misreading the risk score as a prediction | Medium | Unfair treatment | Train staff that it is a prompt for a conversation, not a verdict |
| Single server | Medium | Downtime | Run more than one API instance behind a load balancer; the API is stateless |

# 10. Pre-deployment checklist {#s10}

1. Supply `JWT_SECRET`, database credentials and the first administrator password through the environment.
2. Configure SMTP; leave `OTP_LOG_CODES` unset.
3. Serve the application over HTTPS and set `CORS_ORIGINS` to the real address.
4. Use a managed PostgreSQL with backups.
5. Move uploads to backed-up storage.
6. Replace the sample data (do not run the seed script in production).
7. Change the first administrator's password after signing in.
8. Run `scripts/e2e.py` against a staging copy before go-live.

# 11. Deliverables {#s11}

| Deliverable | Location |
|---|---|
| Source code | https://github.com/AkshaySaraf17/college-management-system |
| README with setup and run instructions | `README.md` in the repository |
| Project documentation with screenshots | `docs/PROJECT_DOCUMENTATION.md`, and the Word and PDF documents |
| Final status report | This document |
| Weekly progress report | `Akshay Saraf - Weekly Progress Report` (Word and PDF) |
| Screenshots | `docs/screenshots/` (48 images) |
| Test script | `scripts/e2e.py` |
| Sample data script | `scripts/seed_demo.py` |

Prepared by Akshay Saraf, 23 October 2026.
