-- Fees, scholarships, payroll, library, hostel, transport

CREATE TABLE fee_structures (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    semester_id BIGINT REFERENCES semesters(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    amount      NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fee_invoices (
    id             BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title          VARCHAR(200) NOT NULL,
    total_amount   NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    discount       NUMERIC(10,2) NOT NULL DEFAULT 0,
    paid_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
    due_date       DATE NOT NULL,
    status         VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PARTIAL','PAID','WAIVED')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fee_payments (
    id             BIGSERIAL PRIMARY KEY,
    invoice_id     BIGINT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
    amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method         VARCHAR(10) NOT NULL CHECK (method IN ('CASH','CARD','UPI','ONLINE','BANK')),
    reference      VARCHAR(100),
    receipt_number VARCHAR(30) NOT NULL UNIQUE,
    paid_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE scholarship_schemes (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    description    TEXT,
    discount_type  VARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT','FIXED')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_cgpa       NUMERIC(3,1),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scholarship_applications (
    id               BIGSERIAL PRIMARY KEY,
    scheme_id        BIGINT NOT NULL REFERENCES scholarship_schemes(id) ON DELETE CASCADE,
    student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    statement        TEXT,
    status           VARCHAR(10) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED','APPROVED','REJECTED')),
    remarks          TEXT,
    discount_applied NUMERIC(10,2),
    applied_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at       TIMESTAMPTZ,
    UNIQUE (scheme_id, student_id)
);

CREATE TABLE salary_structures (
    faculty_id UUID PRIMARY KEY REFERENCES faculties(id) ON DELETE CASCADE,
    basic      NUMERIC(10,2) NOT NULL,
    hra        NUMERIC(10,2) NOT NULL DEFAULT 0,
    allowances NUMERIC(10,2) NOT NULL DEFAULT 0,
    deductions NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE payslips (
    id               BIGSERIAL PRIMARY KEY,
    faculty_id       UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    month            INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year             INT NOT NULL,
    basic            NUMERIC(10,2) NOT NULL,
    hra              NUMERIC(10,2) NOT NULL,
    allowances       NUMERIC(10,2) NOT NULL,
    deductions       NUMERIC(10,2) NOT NULL,
    unpaid_leave_days INT NOT NULL DEFAULT 0,
    leave_deduction  NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_pay          NUMERIC(10,2) NOT NULL,
    status           VARCHAR(10) NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED','PAID')),
    UNIQUE (faculty_id, month, year)
);

CREATE TABLE books (
    id               BIGSERIAL PRIMARY KEY,
    isbn             VARCHAR(20),
    title            VARCHAR(255) NOT NULL,
    author           VARCHAR(200) NOT NULL,
    publisher        VARCHAR(200),
    category         VARCHAR(100),
    total_copies     INT NOT NULL CHECK (total_copies >= 0),
    available_copies INT NOT NULL CHECK (available_copies >= 0),
    shelf_location   VARCHAR(50),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE book_issues (
    id          BIGSERIAL PRIMARY KEY,
    book_id     BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    member_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_on   DATE NOT NULL DEFAULT CURRENT_DATE,
    due_on      DATE NOT NULL,
    returned_on DATE,
    renewals    INT NOT NULL DEFAULT 0,
    fine_amount NUMERIC(8,2) NOT NULL DEFAULT 0,
    fine_paid   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE hostels (
    id        BIGSERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL UNIQUE,
    hostel_type VARCHAR(10) NOT NULL CHECK (hostel_type IN ('BOYS','GIRLS')),
    warden_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE hostel_rooms (
    id          BIGSERIAL PRIMARY KEY,
    hostel_id   BIGINT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    capacity    INT NOT NULL CHECK (capacity > 0),
    fee_per_term NUMERIC(10,2) NOT NULL DEFAULT 0,
    UNIQUE (hostel_id, room_number)
);

CREATE TABLE hostel_allocations (
    id         BIGSERIAL PRIMARY KEY,
    room_id    BIGINT NOT NULL REFERENCES hostel_rooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    to_date    DATE,
    status     VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','VACATED'))
);
CREATE UNIQUE INDEX uq_hostel_active_student ON hostel_allocations(student_id) WHERE status = 'ACTIVE';

CREATE TABLE hostel_complaints (
    id          BIGSERIAL PRIMARY KEY,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject     VARCHAR(200) NOT NULL,
    description TEXT,
    status      VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
    resolution  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transport_routes (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    start_point VARCHAR(150) NOT NULL,
    end_point   VARCHAR(150) NOT NULL,
    fee_per_term NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE transport_stops (
    id          BIGSERIAL PRIMARY KEY,
    route_id    BIGINT NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    pickup_time TIME NOT NULL,
    seq         INT NOT NULL DEFAULT 1
);

CREATE TABLE vehicles (
    id              BIGSERIAL PRIMARY KEY,
    registration_no VARCHAR(30) NOT NULL UNIQUE,
    capacity        INT NOT NULL CHECK (capacity > 0),
    driver_name     VARCHAR(100),
    driver_phone    VARCHAR(20),
    route_id        BIGINT REFERENCES transport_routes(id) ON DELETE SET NULL
);

CREATE TABLE transport_allocations (
    id         BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id   BIGINT NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    stop_id    BIGINT REFERENCES transport_stops(id) ON DELETE SET NULL,
    from_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    status     VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CANCELLED'))
);
CREATE UNIQUE INDEX uq_transport_active_student ON transport_allocations(student_id) WHERE status = 'ACTIVE';

CREATE INDEX idx_fee_invoices_student ON fee_invoices(student_id);
CREATE INDEX idx_book_issues_member ON book_issues(member_id);
CREATE INDEX idx_books_title ON books(lower(title));
