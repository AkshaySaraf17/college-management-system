-- =====================================================================
-- College Management System - Core schema
-- Covers: Module 1 (Auth & Roles), Module 2 (Admission), Module 3 (Student),
--         Module 4 (Faculty), Module 5 (Course & Department)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Module 1: Users & Roles (RBAC)
-- ---------------------------------------------------------------------

CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(40) NOT NULL UNIQUE,
    description VARCHAR(255)
);

INSERT INTO roles (name, description) VALUES
    ('SUPER_ADMIN', 'Full control over the platform across colleges'),
    ('COLLEGE_ADMIN', 'Administers a single college'),
    ('PRINCIPAL', 'Head of the institution'),
    ('HOD', 'Head of Department'),
    ('FACULTY', 'Teaching staff'),
    ('STUDENT', 'Enrolled student'),
    ('PARENT', 'Parent/guardian of a student'),
    ('ACCOUNTANT', 'Manages fees and finance'),
    ('LIBRARIAN', 'Manages library operations'),
    ('PLACEMENT_OFFICER', 'Manages placement activities'),
    ('HOSTEL_WARDEN', 'Manages hostel operations'),
    ('TRANSPORT_MANAGER', 'Manages transport operations');

CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 VARCHAR(255) NOT NULL UNIQUE,
    phone                 VARCHAR(20),
    password_hash         VARCHAR(255) NOT NULL,
    first_name            VARCHAR(100) NOT NULL,
    last_name             VARCHAR(100) NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_status CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DISABLED'))
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE otp_codes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    VARCHAR(30) NOT NULL, -- EMAIL_VERIFICATION, LOGIN_2FA, PASSWORD_RESET
    code_hash  VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Module 5: Department & Course Management
-- ---------------------------------------------------------------------

CREATE TABLE departments (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    code        VARCHAR(20) NOT NULL UNIQUE,
    hod_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    established_year INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
    id              BIGSERIAL PRIMARY KEY,
    department_id   BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    name            VARCHAR(150) NOT NULL,
    code            VARCHAR(20) NOT NULL UNIQUE,
    level           VARCHAR(20) NOT NULL DEFAULT 'UNDERGRADUATE', -- UNDERGRADUATE, POSTGRADUATE, DIPLOMA
    duration_years  NUMERIC(3,1) NOT NULL,
    total_semesters INT NOT NULL,
    total_seats     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_course_level CHECK (level IN ('UNDERGRADUATE','POSTGRADUATE','DIPLOMA'))
);

CREATE TABLE batches (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL, -- e.g. 2025-2029
    start_year  INT NOT NULL,
    end_year    INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, name)
);

CREATE TABLE semesters (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    number      INT NOT NULL,
    name        VARCHAR(50) NOT NULL,
    UNIQUE (course_id, number)
);

CREATE TABLE subjects (
    id            BIGSERIAL PRIMARY KEY,
    semester_id   BIGINT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,
    code          VARCHAR(20) NOT NULL UNIQUE,
    credits       NUMERIC(3,1) NOT NULL,
    is_elective   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE academic_calendar_events (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    event_type  VARCHAR(30) NOT NULL DEFAULT 'GENERAL', -- HOLIDAY, EXAM, SEMESTER_START, SEMESTER_END, GENERAL
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    department_id BIGINT REFERENCES departments(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Module 4: Faculty Management
-- ---------------------------------------------------------------------

CREATE TABLE faculties (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_code       VARCHAR(30) NOT NULL UNIQUE,
    department_id       BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    designation         VARCHAR(100), -- Assistant Professor, Associate Professor, Professor, HOD
    qualification       VARCHAR(255),
    date_of_joining     DATE NOT NULL,
    employment_type     VARCHAR(20) NOT NULL DEFAULT 'FULL_TIME', -- FULL_TIME, PART_TIME, VISITING
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ON_LEAVE, RESIGNED, TERMINATED
    documents_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_employment_type CHECK (employment_type IN ('FULL_TIME','PART_TIME','VISITING')),
    CONSTRAINT chk_faculty_status CHECK (status IN ('ACTIVE','ON_LEAVE','RESIGNED','TERMINATED'))
);

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_hod_faculty
    FOREIGN KEY (hod_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE faculty_documents (
    id           BIGSERIAL PRIMARY KEY,
    faculty_id   UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    doc_type     VARCHAR(50) NOT NULL, -- RESUME, DEGREE_CERTIFICATE, ID_PROOF, EXPERIENCE_LETTER
    file_url     VARCHAR(500) NOT NULL,
    verified     BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE faculty_subject_allocations (
    id           BIGSERIAL PRIMARY KEY,
    faculty_id   UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    subject_id   BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    batch_id     BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    academic_year VARCHAR(9) NOT NULL, -- e.g. 2025-2026
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (subject_id, batch_id, academic_year)
);

CREATE TABLE faculty_leaves (
    id           BIGSERIAL PRIMARY KEY,
    faculty_id   UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    leave_type   VARCHAR(30) NOT NULL DEFAULT 'CASUAL', -- CASUAL, SICK, EARNED, UNPAID
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    reason       TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_leave_status CHECK (status IN ('PENDING','APPROVED','REJECTED'))
);

-- ---------------------------------------------------------------------
-- Module 2: Admission Management
-- ---------------------------------------------------------------------

CREATE TABLE admission_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number  VARCHAR(30) NOT NULL UNIQUE,
    course_id           BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(20) NOT NULL,
    date_of_birth       DATE NOT NULL,
    gender              VARCHAR(20),
    address             TEXT,
    guardian_name       VARCHAR(150),
    guardian_phone      VARCHAR(20),
    guardian_email      VARCHAR(255),
    prior_education     TEXT, -- JSON array: [{level, board, institution, percentage, year}]
    entrance_exam_score NUMERIC(6,2),
    merit_score         NUMERIC(6,2),
    merit_rank          INT,
    status              VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    review_notes        TEXT,
    reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    admission_fee_paid  BOOLEAN NOT NULL DEFAULT FALSE,
    admission_fee_amount NUMERIC(10,2),
    enrolled_student_id UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_admission_status CHECK (status IN
        ('SUBMITTED','DOCUMENTS_PENDING','UNDER_REVIEW','SHORTLISTED','MERIT_LISTED',
         'APPROVED','REJECTED','FEE_PENDING','ENROLLED','WITHDRAWN'))
);

CREATE TABLE admission_documents (
    id             BIGSERIAL PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,
    doc_type       VARCHAR(50) NOT NULL, -- PHOTO, MARKSHEET_10, MARKSHEET_12, ID_PROOF, TRANSFER_CERTIFICATE
    file_url       VARCHAR(500) NOT NULL,
    verified       BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Module 3: Student Management
-- ---------------------------------------------------------------------

CREATE TABLE students (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    admission_id      UUID UNIQUE REFERENCES admission_applications(id) ON DELETE SET NULL,
    roll_number       VARCHAR(30) NOT NULL UNIQUE,
    id_card_number    VARCHAR(30) NOT NULL UNIQUE,
    course_id         BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    batch_id          BIGINT NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    current_semester_id BIGINT REFERENCES semesters(id) ON DELETE SET NULL,
    date_of_birth     DATE NOT NULL,
    gender            VARCHAR(20),
    blood_group       VARCHAR(5),
    address           TEXT,
    status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ON_LEAVE, GRADUATED, EXPELLED, WITHDRAWN
    admitted_on       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_student_status CHECK (status IN ('ACTIVE','ON_LEAVE','GRADUATED','EXPELLED','WITHDRAWN'))
);

ALTER TABLE admission_applications
    ADD CONSTRAINT fk_admission_enrolled_student
    FOREIGN KEY (enrolled_student_id) REFERENCES students(id) ON DELETE SET NULL;

CREATE TABLE parents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    relation    VARCHAR(20) NOT NULL DEFAULT 'GUARDIAN', -- FATHER, MOTHER, GUARDIAN
    phone       VARCHAR(20) NOT NULL,
    email       VARCHAR(255),
    occupation  VARCHAR(150),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_parent_relation CHECK (relation IN ('FATHER','MOTHER','GUARDIAN'))
);

CREATE TABLE student_parents (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id  UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (student_id, parent_id)
);

CREATE TABLE student_academic_history (
    id          BIGSERIAL PRIMARY KEY,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id BIGINT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, BACKLOG
    sgpa        NUMERIC(4,2),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, semester_id),
    CONSTRAINT chk_history_status CHECK (status IN ('IN_PROGRESS','COMPLETED','BACKLOG'))
);

CREATE TABLE student_documents (
    id          BIGSERIAL PRIMARY KEY,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    doc_type    VARCHAR(50) NOT NULL, -- PHOTO, ID_PROOF, MARKSHEET, CERTIFICATE
    file_url    VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_courses_department ON courses(department_id);
CREATE INDEX idx_subjects_semester ON subjects(semester_id);
CREATE INDEX idx_faculties_department ON faculties(department_id);
CREATE INDEX idx_admission_status ON admission_applications(status);
CREATE INDEX idx_admission_course ON admission_applications(course_id);
CREATE INDEX idx_students_course ON students(course_id);
CREATE INDEX idx_students_batch ON students(batch_id);
