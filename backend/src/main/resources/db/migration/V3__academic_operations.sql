-- Attendance, timetable, examinations, results

CREATE TABLE attendance_sessions (
    id           BIGSERIAL PRIMARY KEY,
    subject_id   BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    batch_id     BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    faculty_id   UUID REFERENCES faculties(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    period       INT NOT NULL DEFAULT 1,
    topic        VARCHAR(255),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (subject_id, batch_id, session_date, period)
);

CREATE TABLE attendance_records (
    id         BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status     VARCHAR(10) NOT NULL CHECK (status IN ('PRESENT','ABSENT','LATE','EXCUSED')),
    UNIQUE (session_id, student_id)
);

CREATE TABLE faculty_attendance (
    id         BIGSERIAL PRIMARY KEY,
    faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    att_date   DATE NOT NULL,
    status     VARCHAR(10) NOT NULL CHECK (status IN ('PRESENT','ABSENT','HALF_DAY','ON_LEAVE')),
    UNIQUE (faculty_id, att_date)
);

CREATE TABLE timetable_slots (
    id            BIGSERIAL PRIMARY KEY,
    batch_id      BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    subject_id    BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    faculty_id    UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    room          VARCHAR(30) NOT NULL,
    academic_year VARCHAR(9) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);

CREATE TABLE exams (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    exam_type     VARCHAR(20) NOT NULL CHECK (exam_type IN ('INTERNAL','MIDTERM','FINAL','ONLINE')),
    batch_id      BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    semester_id   BIGINT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    academic_year VARCHAR(9) NOT NULL,
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','ONGOING','COMPLETED','RESULTS_PUBLISHED')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exam_schedules (
    id               BIGSERIAL PRIMARY KEY,
    exam_id          BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id       BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    exam_date        DATE NOT NULL,
    start_time       TIME NOT NULL,
    end_time         TIME NOT NULL,
    room             VARCHAR(30),
    max_marks        INT NOT NULL,
    pass_marks       INT NOT NULL,
    is_online        BOOLEAN NOT NULL DEFAULT FALSE,
    duration_minutes INT,
    UNIQUE (exam_id, subject_id)
);

CREATE TABLE exam_questions (
    id             BIGSERIAL PRIMARY KEY,
    schedule_id    BIGINT NOT NULL REFERENCES exam_schedules(id) ON DELETE CASCADE,
    question_text  TEXT NOT NULL,
    option_a       VARCHAR(500) NOT NULL,
    option_b       VARCHAR(500) NOT NULL,
    option_c       VARCHAR(500),
    option_d       VARCHAR(500),
    correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
    marks          INT NOT NULL DEFAULT 1
);

CREATE TABLE exam_attempts (
    id           BIGSERIAL PRIMARY KEY,
    schedule_id  BIGINT NOT NULL REFERENCES exam_schedules(id) ON DELETE CASCADE,
    student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    score        NUMERIC(6,2),
    UNIQUE (schedule_id, student_id)
);

CREATE TABLE exam_answers (
    id              BIGSERIAL PRIMARY KEY,
    attempt_id      BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id     BIGINT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
    selected_option CHAR(1),
    UNIQUE (attempt_id, question_id)
);

CREATE TABLE results (
    id             BIGSERIAL PRIMARY KEY,
    schedule_id    BIGINT NOT NULL REFERENCES exam_schedules(id) ON DELETE CASCADE,
    student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(6,2),
    absent         BOOLEAN NOT NULL DEFAULT FALSE,
    grade          VARCHAR(3),
    grade_points   NUMERIC(3,1),
    result_status  VARCHAR(10) CHECK (result_status IN ('PASS','FAIL','ABSENT')),
    UNIQUE (schedule_id, student_id)
);

CREATE INDEX idx_att_sessions_batch ON attendance_sessions(batch_id, subject_id);
CREATE INDEX idx_att_records_student ON attendance_records(student_id);
CREATE INDEX idx_timetable_batch ON timetable_slots(batch_id);
CREATE INDEX idx_timetable_faculty ON timetable_slots(faculty_id);
CREATE INDEX idx_results_student ON results(student_id);
