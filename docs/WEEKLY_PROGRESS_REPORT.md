---
title: "College Management System"
subtitle: "Weekly Progress Report: 1 July to 23 October 2026"
author: Akshay Saraf
date: 23 October 2026
---

**Author:** Akshay Saraf

# Contents {#contents}

- [1. About this report](#s1)
- [2. Weekly reports](#s2)
    - [Week 1: 1 to 5 July (Requirements)](#week-1-1-to-5-july-requirements)
    - [Week 2: 6 to 12 July (Architecture and technology)](#week-2-6-to-12-july-architecture-and-technology)
    - [Week 3: 13 to 19 July (Database design)](#week-3-13-to-19-july-database-design)
    - [Week 4: 20 to 26 July (Project setup)](#week-4-20-to-26-july-project-setup)
    - [Week 5: 27 July to 2 August (Authentication (1))](#week-5-27-july-to-2-august-authentication-1)
    - [Week 6: 3 to 9 August (Authentication (2))](#week-6-3-to-9-august-authentication-2)
    - [Week 7: 10 to 16 August (Courses and departments)](#week-7-10-to-16-august-courses-and-departments)
    - [Week 8: 17 to 23 August (Faculty)](#week-8-17-to-23-august-faculty)
    - [Week 9: 24 to 30 August (Admissions)](#week-9-24-to-30-august-admissions)
    - [Week 10: 31 August to 6 September (Students)](#week-10-31-august-to-6-september-students)
    - [Week 11: 7 to 13 September (Web application)](#week-11-7-to-13-september-web-application)
    - [Week 12: 14 to 20 September (Testing the first release)](#week-12-14-to-20-september-testing-the-first-release)
    - [Week 13: 21 to 27 September (First release and attendance)](#week-13-21-to-27-september-first-release-and-attendance)
    - [Week 14: 28 September to 4 October (Exams and results)](#week-14-28-september-to-4-october-exams-and-results)
    - [Week 15: 5 to 11 October (Finance)](#week-15-5-to-11-october-finance)
    - [Week 16: 12 to 18 October (Campus services and learning)](#week-16-12-to-18-october-campus-services-and-learning)
    - [Week 17: 19 to 23 October (Analysis, reports, interface and delivery)](#week-17-19-to-23-october-analysis-reports-interface-and-delivery)
- [3. Monthly summary](#s3)
- [4. Milestones](#s4)
- [5. Overall position at 23 October 2026](#s5)

# 1. About this report {#s1}

This report covers 1 July to 23 October 2026 (17 weeks). For each week it gives the objective, the work done, what was produced, the main difficulty and how it was handled, and what came next. Section 3 summarises the months and Section 4 the milestones.

*Note on dates: the week-by-week allocation was reconstructed from the project's phases, in the order the work naturally happens. The repository's commit history begins on 23 September 2026.*

# 2. Weekly reports {#s2}

## Week 1: 1 to 5 July (Requirements) {#week-1-1-to-5-july-requirements}

**Objective.** Understand the brief and decide what the first release must contain.

**Work done.**

- Read the project brief and listed every module, user role and workflow it describes.
- Split the work into the five detailed modules (authentication, admissions, students, faculty, courses and departments) and the later modules (attendance, exams, fees, library and so on).
- Wrote down the twelve roles and what each one should be able to do.
- Decided to build the first five modules completely before starting the rest.

**Output.** A written scope list and module order.

**Difficulty and how it was handled.** The brief describes features at different levels of detail; for the later modules I had to decide what a sensible minimum looks like (for example, a library needs lending, returns and fines).

**Next.** Choose the technology and design the architecture.

## Week 2: 6 to 12 July (Architecture and technology) {#week-2-6-to-12-july-architecture-and-technology}

**Objective.** Choose the technology stack and the overall structure.

**Work done.**

- Compared options for the server (Spring Boot against alternatives), the database and the front end, using the criteria: required by the brief, safe for money and marks, widely supported.
- Chose Java 17 with Spring Boot, PostgreSQL, React with TypeScript, and a separate Python service for analysis.
- Decided on token-based sign-in (JWT with refresh tokens) so the API stays stateless.
- Sketched the layers: security, controllers, services, data access.

**Output.** Architecture decision and a folder layout for three projects (backend, frontend, analysis service).

**Difficulty and how it was handled.** Choosing between storing sessions on the server and using tokens; I chose tokens and added an account-status check so suspension still takes effect at once.

**Next.** Design the database.

## Week 3: 13 to 19 July (Database design) {#week-3-13-to-19-july-database-design}

**Objective.** Design the tables for the core modules.

**Work done.**

- Designed tables for users, roles and role assignments, one-time codes and refresh tokens.
- Designed departments, courses, batches, semesters and subjects, and the academic calendar.
- Designed faculty, faculty documents, subject allocations and leave.
- Designed admission applications and documents, students, parents and academic history.
- Decided on UUIDs for people and numeric keys for everything else, and wrote constraints (unique, foreign key, check) for the rules the database should enforce.

**Output.** Table definitions for the first migration.

**Difficulty and how it was handled.** Deciding how a parent relates to a student (many to many, because a student can have two parents and a parent can have two children) and how a course relates to semesters and batches.

**Next.** Create the projects and the local environment.

## Week 4: 20 to 26 July (Project setup) {#week-4-20-to-26-july-project-setup}

**Objective.** Have all three projects building and a local database running.

**Work done.**

- Created the Spring Boot project with Maven and the Flyway migration folder.
- Created the React and TypeScript project with Vite and Tailwind CSS.
- Created the Python service skeleton with FastAPI.
- Set up a private local PostgreSQL instance for development so it would not interfere with any other database on the computer.
- Initialised the git repository.

**Output.** Three projects that start, and a database that accepts the first migration.

**Difficulty and how it was handled.** The server build failed with missing getters on a recent Java version. The cause was the Lombok code generator, which does not support the newest JDKs. I pinned the build to Java 17 and documented it. PostgreSQL also failed to start on macOS until the locale was set.

**Next.** Build authentication.

## Week 5: 27 July to 2 August (Authentication (1)) {#week-5-27-july-to-2-august-authentication-1}

**Objective.** Registration, login and tokens.

**Work done.**

- Built the user and role entities and the registration endpoint (students and parents only).
- Built login with BCrypt password checking and the account lock after repeated failures.
- Built access tokens and refresh tokens, storing only a hash of each refresh token.
- Added the security filter that reads the token on every request.

**Output.** Working registration and login through the API.

**Difficulty and how it was handled.** Deciding what to do when a user is suspended: tokens would otherwise remain valid until they expire. Noted for later.

**Next.** Finish the sign-in features.

## Week 6: 3 to 9 August (Authentication (2)) {#week-6-3-to-9-august-authentication-2}

**Objective.** One-time codes, two-factor, recovery and role rules.

**Work done.**

- Added six-digit one-time codes, stored hashed, for email verification, two-factor sign-in and password reset.
- Added the endpoints for refresh and logout.
- Wrote the role-based rules for all twelve roles and the method-level permission checks.
- Added the endpoint that lets an administrator create staff accounts with a temporary password.

**Output.** Complete authentication API.

**Difficulty and how it was handled.** Sending real emails needs a mail server, which I did not have; for development I made the code appear in the server log.

**Next.** Courses and departments.

## Week 7: 10 to 16 August (Courses and departments) {#week-7-10-to-16-august-courses-and-departments}

**Objective.** Academic structure.

**Work done.**

- Built departments, courses, batches, subjects and the academic calendar.
- Made course creation generate the semesters automatically from the number of semesters.
- Seeded sample departments and one course so the system is not empty on first start.

**Output.** Academic structure API with sample data.

**Difficulty and how it was handled.** Making sure a subject belongs to the course it is used with, which I enforce wherever subjects are attached to batches.

**Next.** Faculty.

## Week 8: 17 to 23 August (Faculty) {#week-8-17-to-23-august-faculty}

**Objective.** Faculty management.

**Work done.**

- Built faculty registration, which creates the login and the profile together.
- Built subject allocation (which teacher teaches which subject to which batch) and leave requests with approve and reject.
- Added document upload records for faculty.

**Output.** Faculty API.

**Difficulty and how it was handled.** Making allocation unique per subject, batch and year so that two teachers cannot be given the same class.

**Next.** Admissions.

## Week 9: 24 to 30 August (Admissions) {#week-9-24-to-30-august-admissions}

**Objective.** The admission workflow.

**Work done.**

- Built the public application form endpoint and application tracking by number.
- Built review, merit list ranking, approval, fee recording and enrollment.
- Made enrollment create the student account, roll number, ID card number and guardian record in one transaction.

**Output.** Admission to enrollment works through the API.

**Difficulty and how it was handled.** Order of steps: the brief shows fee payment before approval; I enforce the sequence with statuses so a step cannot be skipped.

**Next.** Students.

## Week 10: 31 August to 6 September (Students) {#week-10-31-august-to-6-september-students}

**Objective.** Student records.

**Work done.**

- Built student profiles, parents, academic history and student documents.
- Added the student's own profile endpoint.

**Output.** Core API complete for five modules.

**Difficulty and how it was handled.** Deciding who may see a student record. At this point access was by role; per-record checks came later.

**Next.** Build the web application.

## Week 11: 7 to 13 September (Web application) {#week-11-7-to-13-september-web-application}

**Objective.** First screens for each module.

**Work done.**

- Built the sign-in, registration, dashboard and layout with role-aware navigation.
- Built screens for admissions, students, faculty, departments, courses and the calendar.
- Set up the API client that attaches the token and refreshes it automatically.

**Output.** A usable web application for the five modules.

**Difficulty and how it was handled.** Keeping the screens consistent; I wrote shared table, form and status components rather than repeating code.

**Next.** Test it end to end.

## Week 12: 14 to 20 September (Testing the first release) {#week-12-14-to-20-september-testing-the-first-release}

**Objective.** Run the real workflows and fix what breaks.

**Work done.**

- Ran the admission-to-enrollment pipeline through the API and the browser.
- Registered faculty and signed in as the new users.
- Found that expired tokens returned 403, so the app never refreshed the sign-in; fixed it to return 401.
- Wrote the README.

**Output.** Verified first release.

**Difficulty and how it was handled.** The 401 versus 403 problem was found only by using the application, which is why I test through the browser as well as the API.

**Next.** Publish and start on classes and exams.

## Week 13: 21 to 27 September (First release and attendance) {#week-13-21-to-27-september-first-release-and-attendance}

**Objective.** Publish the first version and begin the next modules.

**Work done.**

- Published the first version to GitHub.
- Designed the tables for attendance, timetable, exams and results.
- Built the attendance endpoints and the per-record access check so a student sees only their own data and a parent only their children.

**Output.** First version online; attendance in progress.

**Difficulty and how it was handled.** Per-record permission is different from role permission. I added a single access service used by all student-related endpoints.

**Next.** Exams and results.

## Week 14: 28 September to 4 October (Exams and results) {#week-14-28-september-to-4-october-exams-and-results}

**Objective.** Examinations and results.

**Work done.**

- Built exams, papers, hall-ticket data, marks entry and the publish step.
- Built the grading scale, SGPA and CGPA calculations.
- Built online multiple-choice exams with automatic marking, one attempt per student and a timer.
- Added timetable setup with clash detection.

**Output.** Exams to published results, with CGPA.

**Difficulty and how it was handled.** Defining CGPA when a subject appears in more than one exam. I used the most recent published final-exam result for each subject.

**Next.** Finance.

## Week 15: 5 to 11 October (Finance) {#week-15-5-to-11-october-finance}

**Objective.** Fees, scholarships and payroll.

**Work done.**

- Built fee heads, batch invoice generation, payments, part payments, receipts and waivers.
- Built scholarship schemes and approval that reduces open invoices.
- Built salary structures and monthly payslips with unpaid-leave deduction.

**Output.** Finance modules with reconciled totals.

**Difficulty and how it was handled.** Invoice generation had to be safe to repeat, so it skips students who already have an invoice with the same title.

**Next.** Campus services and learning.

## Week 16: 12 to 18 October (Campus services and learning) {#week-16-12-to-18-october-campus-services-and-learning}

**Objective.** Library, hostel, transport, placements and learning management.

**Work done.**

- Built the library with loan limits, renewals and fines.
- Built hostel allocation with capacity and gender rules, complaints, bus routes and rider allocation.
- Built placements with eligibility rules.
- Built study materials, assignments, submissions and grading.
- Built notifications and announcements.

**Output.** All remaining modules on the server.

**Difficulty and how it was handled.** A SQL string with a missing space broke broadcast notifications; the tests caught it.

**Next.** Analysis, reports, interface and clean-up.

## Week 17: 19 to 23 October (Analysis, reports, interface and delivery) {#week-17-19-to-23-october-analysis-reports-interface-and-delivery}

**Objective.** Finish the product and prepare it for review.

**Work done.**

- Built the Python analysis service and the screen that ranks students by risk with explanations.
- Built dashboards, charts and CSV export; made the web app responsive and installable.
- Built all the remaining web screens for the later modules.
- Wrote the 301-check end-to-end test script and fixed the defects it and the browser testing found (see the Status Report).
- Removed all credentials from the repository and rewrote its history.
- Wrote the documentation, took the screenshots and prepared the reports.

**Output.** Complete, tested system on GitHub with documentation.

**Difficulty and how it was handled.** Several issues found late (suspended users keeping access, OTP logging, low analysis scores, missing recovery and allocation screens) were fixed before delivery.

**Next.** Final review.

# 3. Monthly summary {#s3}

| Month | Weeks | What was achieved |
|---|---|---|
| July | 1 to 4 | Requirements, technology choice, architecture, database design and project setup. No user-visible features yet, but every later module depends on the decisions made here |
| August | 5 to 9 | Authentication and role-based access; courses and departments; faculty; the admission workflow through to enrollment |
| September | 10 to 13 | Student records; the first web application; testing of the first release and the fix of the sign-in refresh problem; first version published to GitHub; attendance begun |
| October | 14 to 17 | Exams and online exams; results with SGPA and CGPA; fees, scholarships, payroll; library, hostel, transport, placements; learning management; notifications; the analysis service; reports; full testing; removal of credentials; documentation |

# 4. Milestones {#s4}

| Date | Milestone |
|---|---|
| 12 July | Technology and architecture decided |
| 19 July | Database design for core modules complete |
| 26 July | Projects and local environment working |
| 9 August | Authentication complete |
| 30 August | Admissions complete |
| 6 September | Core API for five modules complete |
| 20 September | First release tested end to end |
| 23 September | First version published to GitHub |
| 4 October | Exams and results complete |
| 11 October | Finance complete |
| 18 October | All remaining modules complete on the server |
| 23 October | All screens, analysis service, 301 automated checks, documentation and clean-up complete |

# 5. Overall position at 23 October 2026 {#s5}

All modules in the brief are implemented and tested. The items that were not built, and the recommended steps before real use, are set out in the Final Status Report.
