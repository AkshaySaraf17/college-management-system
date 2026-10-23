#!/usr/bin/env python3
"""
Seeds a realistic demo college through the public API (so every rule is exercised), with fixed logins.
Safe to re-run: it stops if the demo data already exists.

    python3 scripts/seed_demo.py

All demo accounts share the password DEMO_PASSWORD from .devdb-run/dev.env (printed at the end).
"""
import json
import os
import random
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = os.environ.get("API", "http://localhost:8080/api")

def load_env():
    """Reads the git-ignored secrets file written by scripts/dev.sh (falls back to real environment variables)."""
    env = dict(os.environ)
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".devdb-run", "dev.env")
    if os.path.exists(path):
        for line in open(path):
            if "=" in line:
                k, v = line.rstrip("\n").split("=", 1)
                env.setdefault(k, v)
    return env


ENV = load_env()

PW = ENV["DEMO_PASSWORD"]
rng = random.Random(7)
TODAY = date.today()


def call(method, path, body=None, token=None, expect=(200,)):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            status, payload = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, payload = e.code, e.read()
    res = json.loads(payload) if payload else {}
    if status not in expect:
        sys.exit(f"FAILED {method} {path} -> {status}: {res.get('message', res)}")
    return res.get("data")


def login(email, password):
    try:
        return call("POST", "/auth/login", {"email": email, "password": password})["accessToken"]
    except SystemExit:
        return None


def set_demo_password(email, temp):
    tok = login(email, temp)
    call("POST", "/users/me/change-password", {"currentPassword": temp, "newPassword": PW}, tok)
    return login(email, PW)


def psql(sql):
    subprocess.run(["/opt/homebrew/opt/postgresql@16/bin/psql", "-h", "127.0.0.1", "-p", "5433", "-U", "college_app", "-d", "college_db", "-c", sql],
                   check=True, capture_output=True, env={**os.environ, "PGPASSWORD": ENV["DB_PASSWORD"]})


def main():
    admin = login(ENV.get("BOOTSTRAP_ADMIN_EMAIL", "admin@college.edu"), ENV["BOOTSTRAP_ADMIN_PASSWORD"]) or sys.exit("Cannot log in as the bootstrap admin. Is the backend running?")
    if login("student@college.edu", PW):
        print("Demo data already present. Logins are listed in README.md.")
        return
    print("Seeding demo college...")

    # ---- staff accounts -------------------------------------------------
    tokens = {}
    for role, email, first in [("ACCOUNTANT", "accountant@college.edu", "Anita"), ("LIBRARIAN", "librarian@college.edu", "Leena"), ("HOSTEL_WARDEN", "warden@college.edu", "Wasim"),
                               ("TRANSPORT_MANAGER", "transport@college.edu", "Tarun"), ("PLACEMENT_OFFICER", "placement@college.edu", "Pooja"), ("PRINCIPAL", "principal@college.edu", "Dr. Meera"),
                               ("HOD", "hod@college.edu", "Dr. Sanjay")]:
        call("POST", "/auth/admin/create-user", {"email": email, "firstName": first, "lastName": "Demo", "role": role, "temporaryPassword": PW}, admin)
        tokens[role] = login(email, PW)

    # ---- academics ------------------------------------------------------
    course = next(c for c in call("GET", "/courses", token=admin) if c["code"] == "BTECH-CSE")
    sems = call("GET", f"/courses/{course['id']}/semesters", token=admin)
    sem1 = sems[0]["id"]
    batch = call("GET", f"/courses/{course['id']}/batches", token=admin)[0]["id"]
    existing = {s["code"]: s["id"] for s in call("GET", f"/semesters/{sem1}/subjects", token=admin)}
    subjects = {}
    for code, name, credits in [("CS101", "Programming Fundamentals", 4), ("MA101", "Engineering Mathematics", 4), ("PH101", "Engineering Physics", 3), ("CS102", "Digital Logic Design", 3)]:
        subjects[code] = existing.get(code) or call("POST", "/subjects", {"semesterId": sem1, "name": name, "code": code, "credits": credits, "elective": False}, admin)["id"]

    deps = {d["code"]: d["id"] for d in call("GET", "/departments", token=admin)}
    faculty = {}
    for key, email, first, last, subs in [("priya", "faculty@college.edu", "Priya", "Nair", ["CS101", "CS102"]), ("rahul", "faculty2@college.edu", "Rahul", "Verma", ["MA101", "PH101"])]:
        r = call("POST", "/faculty", {"email": email, "firstName": first, "lastName": last, "phone": "9000000001", "departmentId": deps["CSE"], "designation": "Assistant Professor",
                                      "qualification": "M.Tech, PhD", "dateOfJoining": "2023-07-01", "employmentType": "FULL_TIME"}, admin)
        tok = set_demo_password(email, r["temporaryPassword"])
        faculty[key] = {"id": r["faculty"]["id"], "token": tok}
        for s in subs:
            call("POST", "/faculty/allocations", {"facultyId": r["faculty"]["id"], "subjectId": subjects[s], "batchId": batch, "academicYear": f"{TODAY.year}-{TODAY.year + 1}"}, admin)
    hod_id = call("GET", "/users?q=hod@college.edu", token=admin)[0]["id"]
    call("PATCH", f"/departments/{deps['CSE']}/hod", {"userId": hod_id}, admin)

    ay = f"{TODAY.year}-{TODAY.year + 1}"
    slots = [(1, "CS101", "priya", "09:00:00", "10:00:00", "A-101"), (1, "MA101", "rahul", "10:00:00", "11:00:00", "A-102"), (2, "CS102", "priya", "09:00:00", "10:00:00", "A-101"),
             (2, "PH101", "rahul", "11:00:00", "12:00:00", "Lab-2"), (3, "CS101", "priya", "10:00:00", "11:00:00", "A-101"), (3, "MA101", "rahul", "09:00:00", "10:00:00", "A-102"),
             (4, "PH101", "rahul", "09:00:00", "10:00:00", "A-102"), (4, "CS102", "priya", "10:00:00", "11:00:00", "A-101"), (5, "CS101", "priya", "09:00:00", "11:00:00", "Lab-1")]
    for day, sub, fac, start, end, room in slots:
        call("POST", "/timetable", {"batchId": batch, "subjectId": subjects[sub], "facultyId": faculty[fac]["id"], "dayOfWeek": day, "startTime": start, "endTime": end, "room": room, "academicYear": ay}, admin)

    # ---- admissions -> students -----------------------------------------
    people = [("Aarav", "Sharma", "MALE", "2007-03-14"), ("Diya", "Patel", "FEMALE", "2007-06-02"), ("Kabir", "Singh", "MALE", "2007-01-21"),
              ("Meera", "Iyer", "FEMALE", "2007-09-09"), ("Rohan", "Gupta", "MALE", "2007-11-30"), ("Sana", "Khan", "FEMALE", "2007-05-17")]
    students = []
    for i, (first, last, gender, dob) in enumerate(people):
        email = "student@college.edu" if i == 0 else f"student{i + 1}@college.edu"
        app = call("POST", "/admissions/apply", {"courseId": course["id"], "firstName": first, "lastName": last, "email": email, "phone": f"98765000{i:02d}", "dateOfBirth": dob, "gender": gender,
                                                  "address": f"{10 + i} Residency Road, Pune", "guardianName": f"{last} Senior", "guardianPhone": "9876599999", "guardianEmail": f"{last.lower()}.parent@example.com"})
        call("PATCH", f"/admissions/{app['id']}/review", {"entranceExamScore": round(92 - i * 5.5, 1), "notes": "Documents verified"}, admin)
        students.append({"app": app, "first": first, "dob": dob, "email": email, "gender": gender})
    call("POST", f"/admissions/merit-list?courseId={course['id']}", token=admin)
    for s in students:
        call("PATCH", f"/admissions/{s['app']['id']}/approve", token=admin)
        call("POST", f"/admissions/{s['app']['id']}/fee-payment", {"amount": 10000}, admin)
        r = call("POST", f"/admissions/{s['app']['id']}/enroll", {"batchId": batch}, admin)
        s["id"], s["roll"] = r["student"]["id"], r["student"]["rollNumber"]
        s["token"] = set_demo_password(s["email"], r["temporaryPassword"])

    # ---- parent -----------------------------------------------------------
    call("POST", "/auth/admin/create-user", {"email": "parent@college.edu", "firstName": "Rajesh", "lastName": "Sharma", "role": "PARENT", "temporaryPassword": PW}, admin)
    parent = login("parent@college.edu", PW)
    call("POST", "/parents/link", {"rollNumber": students[0]["roll"], "dateOfBirth": students[0]["dob"], "relation": "FATHER"}, parent)

    # ---- attendance: ~3 weeks of classes; student #5 (Rohan) attends poorly -
    classes = []
    d = TODAY - timedelta(days=21)
    while d <= TODAY:
        if d.weekday() < 5:
            for slot_day, sub, fac, *_ in slots:
                if slot_day == d.weekday() + 1:
                    classes.append((d, sub, fac))
        d += timedelta(days=1)
    for d, sub, fac in classes:
        recs = []
        for s in students:
            weak = s["first"] == "Rohan"
            absent = rng.random() < (0.45 if weak else 0.06)
            recs.append({"studentId": s["id"], "status": "ABSENT" if absent else ("LATE" if rng.random() < 0.05 else "PRESENT")})
        call("POST", "/attendance/mark", {"subjectId": subjects[sub], "batchId": batch, "date": str(d), "period": 1, "topic": "Lecture", "records": recs}, faculty[fac]["token"])

    # ---- exams: midterm + final (both published) + an online quiz for today -
    def run_exam(name, kind, start, end, sched_date, base):
        exam = call("POST", "/exams", {"name": name, "examType": kind, "batchId": batch, "semesterId": sem1, "academicYear": ay, "startDate": str(start), "endDate": str(end)}, admin)["id"]
        for code in ("CS101", "MA101", "PH101", "CS102"):
            sid = call("POST", f"/exams/{exam}/schedules", {"subjectId": subjects[code], "examDate": str(sched_date), "startTime": "10:00:00", "endTime": "13:00:00", "room": "Hall-1", "maxMarks": 100, "passMarks": 40, "online": False}, admin)["id"]
            entries = []
            for s in students:
                skill = {"Aarav": 18, "Diya": 14, "Kabir": 4, "Meera": 9, "Rohan": -22, "Sana": 6}[s["first"]]
                marks = max(8, min(99, base + skill + rng.randint(-6, 6)))
                entries.append({"studentId": s["id"], "marks": marks, "absent": False})
            call("PUT", f"/results/schedule/{sid}", {"entries": entries}, faculty["priya"]["token"] if code in ("CS101", "CS102") else faculty["rahul"]["token"])
        call("POST", f"/results/exam/{exam}/publish", token=admin)

    run_exam("Mid-term Examination", "MIDTERM", TODAY - timedelta(days=40), TODAY - timedelta(days=35), TODAY - timedelta(days=38), 58)
    run_exam("Semester 1 Final Examination", "FINAL", TODAY - timedelta(days=15), TODAY - timedelta(days=10), TODAY - timedelta(days=12), 60)

    quiz = call("POST", "/exams", {"name": "Programming Quiz (online)", "examType": "ONLINE", "batchId": batch, "semesterId": sem1, "academicYear": ay, "startDate": str(TODAY), "endDate": str(TODAY + timedelta(days=3))}, admin)["id"]
    qs = call("POST", f"/exams/{quiz}/schedules", {"subjectId": subjects["CS101"], "examDate": str(TODAY), "startTime": "14:00:00", "endTime": "15:00:00", "maxMarks": 10, "passMarks": 4, "online": True, "durationMinutes": 20}, admin)["id"]
    for text, opts, ans in [("Which keyword declares a constant in C?", ["var", "const", "let", "static final"], "B"), ("What is the output of 5 / 2 in C with integers?", ["2.5", "3", "2", "Error"], "C"),
                            ("Which header provides printf?", ["stdlib.h", "stdio.h", "string.h", "math.h"], "B"), ("Array indices in C start at?", ["0", "1", "-1", "Depends"], "A"),
                            ("Which operator gives the address of a variable?", ["*", "&", "->", "%"], "B")]:
        call("POST", f"/exams/schedules/{qs}/questions", {"questionText": text, "optionA": opts[0], "optionB": opts[1], "optionC": opts[2], "optionD": opts[3], "correctOption": ans, "marks": 2}, faculty["priya"]["token"])

    # ---- fees & scholarships ------------------------------------------------
    acct = tokens["ACCOUNTANT"]
    call("POST", "/fees/structures", {"courseId": course["id"], "semesterId": sem1, "name": "Tuition", "amount": 55000}, acct)
    call("POST", "/fees/structures", {"courseId": course["id"], "semesterId": sem1, "name": "Laboratory", "amount": 6000}, acct)
    call("POST", "/fees/invoices/generate", {"batchId": batch, "semesterId": sem1, "title": "Semester 1 Fees", "dueDate": str(TODAY + timedelta(days=20))}, acct)
    for i, s in enumerate(students):
        inv = next(x for x in call("GET", f"/fees/student/{s['id']}", token=s["token"])["invoices"] if x["title"] == "Semester 1 Fees")
        if i in (0, 1):
            call("POST", f"/fees/invoices/{inv['id']}/pay", {"amount": 61000, "method": "UPI", "reference": "DEMO-UPI"}, acct)
        elif i == 2:
            call("POST", f"/fees/invoices/{inv['id']}/pay", {"amount": 30000, "method": "CASH"}, acct)
    call("POST", "/fees/invoices", {"studentId": students[4]["id"], "title": "Exam re-evaluation fee", "amount": 1500, "dueDate": str(TODAY - timedelta(days=6))}, acct)
    call("POST", "/scholarships/schemes", {"name": "Merit Scholarship", "description": "25% fee waiver for students with CGPA 8.0 or above.", "discountType": "PERCENT", "discountValue": 25, "minCgpa": 8.0}, acct)
    call("POST", "/scholarships/schemes", {"name": "Need-based Grant", "description": "Fixed support for families facing financial hardship.", "discountType": "FIXED", "discountValue": 10000}, acct)
    sch = call("GET", "/scholarships/schemes", token=acct)
    app_id = call("POST", "/scholarships/applications", {"schemeId": next(x["id"] for x in sch if x["name"] == "Need-based Grant"), "statement": "My family's income has reduced this year."}, students[2]["token"])["id"]
    call("PATCH", f"/scholarships/applications/{app_id}/decide", {"approve": True, "remarks": "Approved by committee"}, acct)
    # Diya may or may not meet the 8.0 CGPA bar depending on the generated marks; either outcome is fine for a demo.
    call("POST", "/scholarships/applications", {"schemeId": next(x["id"] for x in sch if x["name"] == "Merit Scholarship"), "statement": "Consistent top performer."}, students[1]["token"], expect=(200, 400))

    for key, basic in (("priya", 62000), ("rahul", 58000)):
        call("PUT", f"/payroll/structures/{faculty[key]['id']}", {"basic": basic, "hra": basic * 0.2, "allowances": 4000, "deductions": 3500}, acct)
    call("POST", "/payroll/generate", {"month": TODAY.month, "year": TODAY.year}, acct)

    # ---- library, hostel, transport ----------------------------------------
    lib = tokens["LIBRARIAN"]
    books = [("Introduction to Algorithms", "Cormen et al.", "Computer Science", 3), ("Clean Code", "Robert C. Martin", "Software Engineering", 2), ("The C Programming Language", "Kernighan & Ritchie", "Programming", 4),
             ("Digital Design", "M. Morris Mano", "Electronics", 3), ("Engineering Mathematics", "K. A. Stroud", "Mathematics", 5), ("Concepts of Physics", "H. C. Verma", "Physics", 4),
             ("Operating System Concepts", "Silberschatz", "Computer Science", 2), ("Database System Concepts", "Korth", "Computer Science", 2), ("Discrete Mathematics", "Rosen", "Mathematics", 3),
             ("Computer Networks", "Tanenbaum", "Computer Science", 2)]
    ids = {}
    for i, (title, author, cat, copies) in enumerate(books):
        ids[title] = call("POST", "/library/books", {"isbn": f"978-81-{1000 + i}", "title": title, "author": author, "category": cat, "totalCopies": copies, "shelfLocation": f"{cat[0]}{i + 1}"}, lib)["id"]
    call("POST", "/library/issues", {"bookId": ids["Clean Code"], "member": students[0]["roll"], "days": 14}, lib)
    call("POST", "/library/issues", {"bookId": ids["The C Programming Language"], "member": students[0]["roll"], "days": 14}, lib)
    od = call("POST", "/library/issues", {"bookId": ids["Digital Design"], "member": students[4]["roll"], "days": 14}, lib)
    psql(f"UPDATE book_issues SET issued_on = current_date - 25, due_on = current_date - 11 WHERE id = {od['id']}")

    wd = tokens["HOSTEL_WARDEN"]
    boys = call("POST", "/hostel/hostels", {"name": "Vivekananda Hall", "hostelType": "BOYS"}, wd)["id"]
    girls = call("POST", "/hostel/hostels", {"name": "Sarojini Hall", "hostelType": "GIRLS"}, wd)["id"]
    rooms = {}
    for h, prefix in ((boys, "B"), (girls, "G")):
        for n in (101, 102, 103):
            rooms[f"{prefix}{n}"] = call("POST", "/hostel/rooms", {"hostelId": h, "roomNumber": f"{prefix}-{n}", "capacity": 2, "feePerTerm": 24000}, wd)["id"]
    call("POST", "/hostel/allocations", {"student": students[0]["roll"], "roomId": rooms["B101"]}, wd)
    call("POST", "/hostel/allocations", {"student": students[2]["roll"], "roomId": rooms["B101"]}, wd)
    call("POST", "/hostel/allocations", {"student": students[1]["roll"], "roomId": rooms["G101"]}, wd)
    call("POST", "/hostel/complaints", {"subject": "Wi-Fi not working in room", "description": "Signal drops every evening."}, students[0]["token"])

    tm = tokens["TRANSPORT_MANAGER"]
    r1 = call("POST", "/transport/routes", {"name": "Route 1 - Kothrud", "startPoint": "Kothrud Depot", "endPoint": "College Campus", "feePerTerm": 9000}, tm)["id"]
    r2 = call("POST", "/transport/routes", {"name": "Route 2 - Hadapsar", "startPoint": "Hadapsar Gadital", "endPoint": "College Campus", "feePerTerm": 11000}, tm)["id"]
    stops = {}
    for route, name, t in ((r1, "Kothrud Depot", "07:15:00"), (r1, "Karve Road", "07:30:00"), (r2, "Hadapsar Gadital", "07:00:00"), (r2, "Magarpatta", "07:20:00")):
        stops[name] = call("POST", "/transport/stops", {"routeId": route, "name": name, "pickupTime": t, "seq": 1}, tm)["id"]
    call("POST", "/transport/vehicles", {"registrationNo": "MH12 AB 1001", "capacity": 40, "driverName": "Ramesh Patil", "driverPhone": "9822000001", "routeId": r1}, tm)
    call("POST", "/transport/vehicles", {"registrationNo": "MH12 CD 2002", "capacity": 3, "driverName": "Suresh Jadhav", "driverPhone": "9822000002", "routeId": r2}, tm)
    call("POST", "/transport/allocations", {"student": students[3]["roll"], "routeId": r1, "stopId": stops["Karve Road"]}, tm)
    call("POST", "/transport/allocations", {"student": students[5]["roll"], "routeId": r2, "stopId": stops["Magarpatta"]}, tm)

    # ---- placement ----------------------------------------------------------
    po = tokens["PLACEMENT_OFFICER"]
    c1 = call("POST", "/placement/companies", {"name": "Infosys", "industry": "IT Services", "website": "https://www.infosys.com", "contactEmail": "campus@infosys.example"}, po)["id"]
    c2 = call("POST", "/placement/companies", {"name": "Zoho", "industry": "Software Products", "website": "https://www.zoho.com", "contactEmail": "campus@zoho.example"}, po)["id"]
    d1 = call("POST", "/placement/drives", {"companyId": c1, "title": "Systems Engineer", "description": "Entry-level engineering role.", "packageLpa": 6.5, "driveDate": str(TODAY + timedelta(days=30)), "lastApplyDate": str(TODAY + timedelta(days=20))}, po)["id"]
    d2 = call("POST", "/placement/drives", {"companyId": c2, "title": "Member Technical Staff", "description": "Product engineering. High CGPA preferred.", "packageLpa": 12, "driveDate": str(TODAY + timedelta(days=40)), "lastApplyDate": str(TODAY + timedelta(days=25)), "minCgpa": 7.5}, po)["id"]
    call("POST", f"/placement/drives/{d1}/apply", token=students[0]["token"])
    call("POST", f"/placement/drives/{d1}/apply", token=students[1]["token"])
    apps = call("GET", f"/placement/drives/{d1}/applications", token=po)
    call("PATCH", f"/placement/applications/{apps[0]['id']}", {"status": "SELECTED", "remarks": "Offer letter issued"}, po)

    # ---- LMS & communications ----------------------------------------------
    ft = faculty["priya"]["token"]
    call("POST", "/lms/materials", {"subjectId": subjects["CS101"], "batchId": batch, "title": "Lecture 1 - Introduction to C", "description": "Slides and reading list", "linkUrl": "https://www.learn-c.org/"}, ft)
    call("POST", "/lms/materials", {"subjectId": subjects["CS101"], "batchId": batch, "title": "Practice problem set 1", "linkUrl": "https://www.hackerrank.com/domains/c"}, ft)
    a1 = call("POST", "/lms/assignments", {"subjectId": subjects["CS101"], "batchId": batch, "title": "Assignment 1: Pointers and arrays", "description": "Explain pointer arithmetic with 3 examples.", "dueDate": str(TODAY - timedelta(days=5)), "maxMarks": 20}, ft)["id"]
    call("POST", "/lms/assignments", {"subjectId": subjects["CS101"], "batchId": batch, "title": "Assignment 2: Recursion", "description": "Write a recursive solution for the Tower of Hanoi.", "dueDate": str(TODAY + timedelta(days=7)), "maxMarks": 20}, ft)
    for s in students[:4]:
        call("POST", f"/lms/assignments/{a1}/submit", {"content": f"{s['first']}'s answer: pointers hold addresses, and arithmetic scales by element size..."}, s["token"])
    for sub in call("GET", f"/lms/assignments/{a1}/submissions", token=ft):
        if sub["submissionId"]:
            call("PATCH", f"/lms/submissions/{sub['submissionId']}/grade", {"marks": rng.randint(12, 19), "feedback": "Good explanation; add more examples."}, ft)
    call("POST", "/announcements", {"title": "Admissions open for 2026-27", "body": "Applications for B.Tech programmes are now open. Apply online and track your status with your application number.", "audience": "ALL", "isPublic": True}, admin)
    call("POST", "/announcements", {"title": "Mid-semester break", "body": "Classes will remain suspended next Friday for the annual sports day.", "audience": "ALL"}, admin)
    call("POST", "/announcements", {"title": "Programming quiz today at 2 PM", "body": "An online MCQ quiz (20 minutes) opens today. Find it under Exams & hall tickets.", "audience": "STUDENTS", "batchId": batch}, ft)
    call("POST", "/calendar-events", {"title": "Annual Sports Day", "description": "Campus-wide sports events", "eventType": "GENERAL", "startDate": str(TODAY + timedelta(days=9)), "endDate": str(TODAY + timedelta(days=9))}, admin)
    call("POST", "/calendar-events", {"title": "Semester 2 begins", "eventType": "SEMESTER_START", "startDate": str(TODAY + timedelta(days=45)), "endDate": str(TODAY + timedelta(days=45))}, admin)

    print(f"Done. Demo logins (password: {PW}):")
    for email, role in [("student@college.edu", "Student (Aarav Sharma)"), ("student5@college.edu", "Student (Rohan Gupta - at risk)"), ("parent@college.edu", "Parent of Aarav"), ("faculty@college.edu", "Faculty (Priya Nair)"),
                        ("faculty2@college.edu", "Faculty (Rahul Verma)"), ("hod@college.edu", "HOD"), ("principal@college.edu", "Principal"), ("accountant@college.edu", "Accountant"),
                        ("librarian@college.edu", "Librarian"), ("warden@college.edu", "Hostel warden"), ("transport@college.edu", "Transport manager"), ("placement@college.edu", "Placement officer")]:
        print(f"  {email:26} {role}")
    print(f"  {ENV.get('BOOTSTRAP_ADMIN_EMAIL', 'admin@college.edu'):26} Super admin (password in .devdb-run/dev.env)")


if __name__ == "__main__":
    main()
