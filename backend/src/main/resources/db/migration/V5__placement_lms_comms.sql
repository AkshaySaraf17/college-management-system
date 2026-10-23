-- Placement, LMS, announcements, notifications, files

CREATE TABLE stored_files (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name VARCHAR(255) NOT NULL,
    content_type  VARCHAR(100),
    size_bytes    BIGINT NOT NULL,
    storage_name  VARCHAR(100) NOT NULL,
    uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE companies (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL UNIQUE,
    industry      VARCHAR(100),
    website       VARCHAR(200),
    contact_email VARCHAR(255)
);

CREATE TABLE placement_drives (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    package_lpa     NUMERIC(6,2),
    drive_date      DATE NOT NULL,
    last_apply_date DATE NOT NULL,
    min_cgpa        NUMERIC(3,1),
    course_id       BIGINT REFERENCES courses(id) ON DELETE SET NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','COMPLETED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE placement_applications (
    id         BIGSERIAL PRIMARY KEY,
    drive_id   BIGINT NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status     VARCHAR(12) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED','SHORTLISTED','INTERVIEW','SELECTED','REJECTED')),
    remarks    TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (drive_id, student_id)
);

CREATE TABLE course_materials (
    id          BIGSERIAL PRIMARY KEY,
    subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    batch_id    BIGINT REFERENCES batches(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    file_id     UUID REFERENCES stored_files(id) ON DELETE SET NULL,
    link_url    VARCHAR(500),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignments (
    id          BIGSERIAL PRIMARY KEY,
    subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    batch_id    BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    due_date    DATE NOT NULL,
    max_marks   INT NOT NULL DEFAULT 10,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignment_submissions (
    id            BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    content       TEXT,
    file_id       UUID REFERENCES stored_files(id) ON DELETE SET NULL,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    marks         NUMERIC(6,2),
    feedback      TEXT,
    graded_at     TIMESTAMPTZ,
    UNIQUE (assignment_id, student_id)
);

CREATE TABLE announcements (
    id         BIGSERIAL PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    body       TEXT NOT NULL,
    audience   VARCHAR(20) NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL','STUDENTS','FACULTY','PARENTS','STAFF')),
    batch_id   BIGINT REFERENCES batches(id) ON DELETE CASCADE,
    is_public  BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    message    TEXT NOT NULL,
    type       VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    link       VARCHAR(200),
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_assignments_batch ON assignments(batch_id);
CREATE INDEX idx_submissions_student ON assignment_submissions(student_id);
