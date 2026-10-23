-- Sample departments, one course, its semesters and a batch so the system is not empty on first run.
-- The first administrator account is created at startup from BOOTSTRAP_ADMIN_* (see AdminBootstrap).

INSERT INTO departments (name, code, established_year) VALUES
    ('Computer Science & Engineering', 'CSE', 2005),
    ('Electronics & Communication Engineering', 'ECE', 2005),
    ('Mechanical Engineering', 'MECH', 2000);

INSERT INTO courses (department_id, name, code, level, duration_years, total_semesters, total_seats)
SELECT id, 'B.Tech Computer Science & Engineering', 'BTECH-CSE', 'UNDERGRADUATE', 4, 8, 120
FROM departments WHERE code = 'CSE';

INSERT INTO semesters (course_id, number, name)
SELECT c.id, s.n, 'Semester ' || s.n
FROM courses c CROSS JOIN generate_series(1, 8) AS s(n)
WHERE c.code = 'BTECH-CSE';

INSERT INTO batches (course_id, name, start_year, end_year)
SELECT id, '2025-2029', 2025, 2029 FROM courses WHERE code = 'BTECH-CSE';
