# College Management System

A web application for running a college: admissions, students, faculty, courses, attendance, timetables, exams and results, fees, library, hostel, transport, placements, assignments and notices. It has a Spring Boot API, a React front end, a PostgreSQL database and a small Python service for student performance analysis.

Screenshots and fuller documentation are in [`docs/`](docs/):

- [Project documentation](docs/PROJECT_DOCUMENTATION.md)
- [Status report](docs/STATUS_REPORT.md)
- [Screenshots](docs/screenshots/)

![Student dashboard](docs/screenshots/04-student-dashboard.png)

## Modules

| Module | Summary |
|---|---|
| Authentication and roles | Registration, email OTP, login, optional two-factor, password reset, JWT with refresh tokens, 12 roles, user administration |
| Admissions | Public application and document upload, review, merit list, fee, enrollment (creates the student login, roll number and ID card number) |
| Students | Profile, guardians, academic history, documents, printable ID card and bonafide certificate |
| Faculty | Registration, subject allocation, leave, attendance, payroll, teaching report |
| Courses and departments | Departments, courses, semesters, subjects and credits, batches, academic calendar |
| Attendance | Period-wise marking, subject and daily views, 75% flag, notifications to student and parents |
| Timetable | Weekly schedule with faculty, batch and room clash checks |
| Exams and results | Exam schedules, hall tickets, timed online MCQ exams, marks entry, grading, SGPA and CGPA, transcript |
| Fees and scholarships | Fee heads, batch invoicing, part payments, receipts, waivers, scholarship schemes that discount open invoices |
| Library | Catalog, issue, return, renew, loan limits, overdue fines |
| Hostel and transport | Rooms and allocation with capacity checks, complaints, bus routes, stops and riders |
| Placements | Companies, drives, eligibility by CGPA and course, applicants, statistics |
| Learning (LMS) | Study materials, assignments, submissions, grading |
| Notifications | Alerts from the other modules, announcements, public notices, broadcasts |
| Performance analysis | Risk score and next-exam forecast per student, ranked per batch |
| Reports | Dashboards per role, charts, CSV export |

The web app is responsive and can be installed on a phone from the browser (Add to Home Screen). There are no native Android or iOS apps.

## Requirements

- Java 17 (newer JDKs are not supported by the Lombok version used here)
- Maven 3.9+
- Node.js 20+
- Python 3.10+
- PostgreSQL 16

## Running locally

The quickest way is the helper script, which starts a private PostgreSQL instance on port 5433, the API, the analysis service and the front end:

```bash
export JAVA_HOME=/path/to/jdk-17
./scripts/dev.sh start
```

On first run it generates a database password, a JWT secret and an administrator password and stores them in `.devdb-run/dev.env` (ignored by git). The administrator login is printed when the script starts. Open http://localhost:5173.

Useful commands:

```bash
./scripts/dev.sh status
./scripts/dev.sh stop
./scripts/dev.sh restart-backend
./scripts/dev.sh reset-db        # deletes all local data and re-runs migrations
python3 scripts/seed_demo.py     # loads a sample college and prints the demo logins
python3 scripts/e2e.py           # runs the end-to-end test suite
```

If you pulled a newer version and the API refuses to start because of a migration checksum, run `./scripts/dev.sh reset-db` (development data only).

### Running without the helper script

1. Create a PostgreSQL database and user, or run `docker compose up -d` after copying `.env.example` to `.env` and setting `POSTGRES_PASSWORD`.
2. Export the variables listed in `.env.example`. `JWT_SECRET` must be a base64 string of at least 32 random bytes (`openssl rand -base64 48`). `BOOTSTRAP_ADMIN_PASSWORD` creates the first Super Admin when none exists.
3. API: `cd backend && mvn spring-boot:run` (port 8080, Swagger UI at `/docs`).
4. Analysis service: `cd ai-service && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn main:app --port 8000`.
5. Front end: `cd frontend && npm install && npm run dev` (port 5173, proxies `/api` to the API).

## Configuration

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Database connection |
| `JWT_SECRET` | Token signing key (required) |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | First administrator account |
| `CORS_ORIGINS` | Allowed browser origins |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` | SMTP server for OTP emails |
| `UPLOAD_DIR` | Where uploaded files are stored |
| `AI_SERVICE_URL` | Address of the analysis service |
| `OTP_LOG_CODES` | Development only: write OTP codes to the log. Leave unset in production |

## Project layout

```
backend/      Spring Boot API, Flyway migrations
frontend/     React and TypeScript application
ai-service/   FastAPI analysis service
scripts/      dev.sh, seed_demo.py, e2e.py
docs/         documentation and screenshots
```

## Known limitations

- Online fee payment uses a demo gateway that always succeeds. No payment provider is connected.
- The performance analysis is a fixed weighted formula plus a straight-line forecast of recent exam scores. It is not a trained model.
- Notifications are shown in the app only. Emails are sent only for OTP codes, and only if SMTP is configured. There is no SMS.
- Uploaded files are stored on local disk and can be downloaded by any signed-in user who has the file's identifier.
- The system serves a single college.
- Role changes take effect at the user's next sign-in. Suspending a user takes effect immediately.
