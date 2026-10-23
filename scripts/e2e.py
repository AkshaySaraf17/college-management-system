#!/usr/bin/env python3
"""
End-to-end API test: drives every module through its real workflow against a running stack
(./scripts/dev.sh start). Safe to re-run: every run creates its own uniquely named data.

    python3 scripts/e2e.py            # run everything
    python3 scripts/e2e.py -v         # print each request
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

BASE = os.environ.get("API", "http://localhost:8080/api")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, ".devdb-run", "backend.log")
VERBOSE = "-v" in sys.argv
RUN = uuid.uuid4().hex[:6]
TODAY = date.today()


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

passed, failed = 0, []
PARENT_PW = "Pw" + RUN + "x1!"
PARENT_PW2 = "Pw" + RUN + "y2!"
TEMP_PW = "Tp" + RUN + "z3!"


def call(method, path, body=None, token=None, expect=200, raw=False, headers=None):
    data = None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    if body is not None and not raw:
        data = json.dumps(body).encode()
    elif raw:
        data = body
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req) as r:
            status, payload = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, payload = e.code, e.read()
    try:
        parsed = json.loads(payload)
    except Exception:
        parsed = payload
    if VERBOSE:
        print(f"    {method} {path} -> {status}")
    return status, parsed


def check(name, cond, detail=""):
    global passed
    if cond:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed.append(name)
        print(f"  FAIL  {name}   {detail}")


def ok(name, method, path, body=None, token=None, expect=200):
    status, res = call(method, path, body, token)
    good = status == expect
    check(name, good, f"[{status}] {str(res)[:300]}" if not good else "")
    return res.get("data") if isinstance(res, dict) else res


def section(title):
    print(f"\n== {title}")


def otp_from_log(email, purpose):
    time.sleep(0.4)
    with open(LOG, errors="ignore") as f:
        matches = re.findall(rf"OTP for {re.escape(email)} \({purpose}\): (\d{{6}})", f.read())
    return matches[-1] if matches else None


def psql(sql):
    subprocess.run(["/opt/homebrew/opt/postgresql@16/bin/psql", "-h", "127.0.0.1", "-p", "5433", "-U", "college_app", "-d", "college_db", "-c", sql],
                   check=True, capture_output=True, env={**os.environ, "PGPASSWORD": ENV["DB_PASSWORD"]})


def login(email, password):
    status, res = call("POST", "/auth/login", {"email": email, "password": password})
    return res["data"]["accessToken"] if status == 200 else None


def main():
    # ------------------------------------------------------------------
    section("Auth & access control")
    admin = login(ENV.get("BOOTSTRAP_ADMIN_EMAIL", "admin@college.edu"), ENV["BOOTSTRAP_ADMIN_PASSWORD"])
    check("admin login", admin is not None)
    check("wrong password rejected", call("POST", "/auth/login", {"email": "admin@college.edu", "password": "nope"})[0] == 401)
    check("no token -> 401", call("GET", "/students")[0] == 401)
    check("public catalog needs no login", call("GET", "/courses")[0] == 200)

    staff = {}
    for role in ("LIBRARIAN", "ACCOUNTANT", "HOSTEL_WARDEN", "TRANSPORT_MANAGER", "PLACEMENT_OFFICER"):
        email = f"{role.lower()}{RUN}@college.edu"
        r = ok(f"admin creates {role} account", "POST", "/auth/admin/create-user", {"email": email, "firstName": role.title(), "lastName": RUN, "role": role}, admin)
        staff[role] = login(email, r["temporaryPassword"])
        check(f"{role} can login", staff[role] is not None)
    lib, acct, warden, transport, placement = (staff[k] for k in ("LIBRARIAN", "ACCOUNTANT", "HOSTEL_WARDEN", "TRANSPORT_MANAGER", "PLACEMENT_OFFICER"))
    check("admin cannot create users without admin role", call("POST", "/auth/admin/create-user", {"email": f"q{RUN}@e.com", "firstName": "a", "lastName": "b", "role": "FACULTY"}, lib)[0] == 403)

    reg_email = f"selfreg{RUN}@example.com"
    ok("self-register parent", "POST", "/auth/register", {"email": reg_email, "password": PARENT_PW, "firstName": "Pat", "lastName": "Parent", "role": "PARENT"})
    check("cannot login before email verified", call("POST", "/auth/login", {"email": reg_email, "password": PARENT_PW})[0] == 403)
    code = otp_from_log(reg_email, "EMAIL_VERIFICATION")
    check("OTP issued", code is not None)
    check("wrong OTP rejected", call("POST", "/auth/verify-email", {"email": reg_email, "code": "000000"})[0] == 400)
    ok("verify email with OTP", "POST", "/auth/verify-email", {"email": reg_email, "code": code})
    parent_tok = login(reg_email, PARENT_PW)
    check("parent can login after verification", parent_tok is not None)
    check("staff role cannot self-register", call("POST", "/auth/register", {"email": f"x{RUN}@e.com", "password": TEMP_PW, "firstName": "a", "lastName": "b", "role": "FACULTY"})[0] == 403)

    # ------------------------------------------------------------------
    section("Departments, courses, subjects")
    deps = ok("departments", "GET", "/departments", token=admin)
    cse = next(d for d in deps if d["code"] == "CSE")["id"]
    ay = f"{TODAY.year}-{TODAY.year + 1}"
    course = ok("create course (own data per run)", "POST", "/courses", {"departmentId": cse, "name": f"E2E Course {RUN}", "code": f"E{RUN}".upper(), "level": "UNDERGRADUATE",
                                                                       "durationYears": 1, "totalSemesters": 2, "totalSeats": 50}, admin)
    sems = ok("semesters auto-generated", "GET", f"/courses/{course['id']}/semesters", token=admin)
    check("2 semesters generated", len(sems) == 2)
    sem1 = sems[0]["id"]
    batch = ok("create batch", "POST", "/batches", {"courseId": course["id"], "name": ay, "startYear": TODAY.year, "endYear": TODAY.year + 1}, admin)["id"]
    sub_a = ok("create subject A", "POST", "/subjects", {"semesterId": sem1, "name": f"Algorithms {RUN}", "code": f"AL{RUN}", "credits": 4, "elective": False}, admin)
    sub_b = ok("create subject B", "POST", "/subjects", {"semesterId": sem1, "name": f"Databases {RUN}", "code": f"DB{RUN}", "credits": 3, "elective": False}, admin)
    check("duplicate subject code -> 409", call("POST", "/subjects", {"semesterId": sem1, "name": "x", "code": f"AL{RUN}", "credits": 1, "elective": False}, admin)[0] == 409)
    sub_a, sub_b = sub_a["id"], sub_b["id"]

    # ------------------------------------------------------------------
    section("Faculty")
    fac = []
    for i in (1, 2):
        r = ok(f"register faculty {i}", "POST", "/faculty", {"email": f"fac{i}{RUN}@college.edu", "firstName": f"Fac{i}", "lastName": RUN, "phone": "9000000000",
                                                           "departmentId": cse, "designation": "Assistant Professor", "qualification": "PhD", "dateOfJoining": "2024-06-01", "employmentType": "FULL_TIME"}, admin)
        fac.append({"id": r["faculty"]["id"], "token": login(f"fac{i}{RUN}@college.edu", r["temporaryPassword"])})
        check(f"faculty {i} can login", fac[-1]["token"] is not None)
    for sub in (sub_a, sub_b):
        ok("allocate subject to faculty 1", "POST", "/faculty/allocations", {"facultyId": fac[0]["id"], "subjectId": sub, "batchId": batch, "academicYear": ay}, admin)
    check("same subject can't be double-allocated", call("POST", "/faculty/allocations", {"facultyId": fac[1]["id"], "subjectId": sub_a, "batchId": batch, "academicYear": ay}, admin)[0] == 409)
    leave = ok("faculty applies for leave", "POST", f"/faculty/{fac[0]['id']}/leaves", {"leaveType": "UNPAID", "startDate": str(TODAY), "endDate": str(TODAY + timedelta(days=2)), "reason": "personal"}, fac[0]["token"])
    ok("approve leave", "PATCH", f"/faculty/leaves/{leave['id']}/approve", token=admin)
    check("leave cannot be decided twice", call("PATCH", f"/faculty/leaves/{leave['id']}/approve", token=admin)[0] == 409)
    check("faculty status not stuck on ON_LEAVE", ok("faculty profile", "GET", f"/faculty/{fac[0]['id']}", token=admin)["status"] == "ACTIVE")

    # ------------------------------------------------------------------
    section("Admissions -> enrollment")
    students = []
    for i, (gender, score) in enumerate([("FEMALE", 91.5), ("MALE", 78.0), ("MALE", 55.0)]):
        dob = f"2007-0{i + 3}-1{i + 1}"
        app = ok(f"apply #{i + 1}", "POST", "/admissions/apply", {"courseId": course["id"], "firstName": f"Stu{i + 1}", "lastName": RUN, "email": f"stu{i + 1}{RUN}@example.com",
                                                                "phone": "9876500000", "dateOfBirth": dob, "gender": gender, "address": "Pune", "guardianName": "Guard Ian",
                                                                "guardianPhone": "9876500001", "guardianEmail": f"guard{i + 1}{RUN}@example.com"})
        ok("review", "PATCH", f"/admissions/{app['id']}/review", {"entranceExamScore": score, "notes": "ok"}, admin)
        students.append({"app": app, "gender": gender, "dob": dob, "i": i + 1})
    check("applicant can track by number", call("GET", f"/admissions/track/{students[0]['app']['applicationNumber']}")[0] == 200)
    ok("generate merit list", "POST", f"/admissions/merit-list?courseId={course['id']}", token=admin)
    for s in students:
        ok("approve", "PATCH", f"/admissions/{s['app']['id']}/approve", token=admin)
        check("enroll blocked before fee", call("POST", f"/admissions/{s['app']['id']}/enroll", {"batchId": batch}, admin)[0] == 400)
        ok("record fee", "POST", f"/admissions/{s['app']['id']}/fee-payment", {"amount": 25000}, admin)
        res = ok("enroll", "POST", f"/admissions/{s['app']['id']}/enroll", {"batchId": batch}, admin)
        s["id"], s["roll"], s["email"] = res["student"]["id"], res["student"]["rollNumber"], res["student"]["email"]
        s["token"] = login(s["email"], res["temporaryPassword"])
        check(f"student {s['i']} can login", s["token"] is not None)

    # document upload (public) + verify
    boundary = "----e2e" + RUN
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"docType\"\r\n\r\nMARKSHEET_12\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"marks.txt\"\r\nContent-Type: text/plain\r\n\r\nhello marks\r\n--{boundary}--\r\n").encode()
    status, res = call("POST", f"/admissions/{students[0]['app']['id']}/documents/upload", body, raw=True, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    check("applicant uploads document without login", status == 200, str(res)[:200])
    if status == 200:
        doc = res["data"]
        ok("staff verifies document", "PATCH", f"/admissions/documents/{doc['id']}/verify", token=admin)
        fid = doc["fileUrl"].split("/")[-1]
        check("file download needs auth", call("GET", f"/files/{fid}")[0] == 401)
        check("staff can download file", call("GET", f"/files/{fid}", token=admin)[0] == 200)
    status, res = call("POST", "/admissions/x/documents/upload", b"", raw=True, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    check("bad application id is rejected", status in (400, 404))

    s1, s2, s3 = students
    # ------------------------------------------------------------------
    section("Parent portal & per-student access control")
    ok("parent links child with roll + DOB", "POST", "/parents/link", {"rollNumber": s1["roll"], "dateOfBirth": s1["dob"], "relation": "MOTHER"}, parent_tok)
    check("wrong DOB can't link", call("POST", "/parents/link", {"rollNumber": s2["roll"], "dateOfBirth": "1999-01-01"}, parent_tok)[0] == 400)
    kids = ok("parent lists children", "GET", "/parents/me/children", token=parent_tok)
    check("parent sees exactly the linked child", len(kids) == 1 and kids[0]["id"] == s1["id"])
    check("parent can view own child's attendance", call("GET", f"/attendance/student/{s1['id']}/summary", token=parent_tok)[0] == 200)
    check("parent blocked from other student", call("GET", f"/attendance/student/{s2['id']}/summary", token=parent_tok)[0] == 403)
    check("student blocked from classmate", call("GET", f"/attendance/student/{s1['id']}/summary", token=s2["token"])[0] == 403)
    check("student blocked from classmate profile", call("GET", f"/students/{s1['id']}", token=s2["token"])[0] == 403)
    check("student can view self", call("GET", "/students/me", token=s2["token"])[0] == 200)
    check("accountant can view admissions to record fees", call("GET", "/admissions", token=acct)[0] == 200)
    check("student cannot use admin endpoint", call("POST", "/departments", {"name": "x", "code": "x"}, s1["token"])[0] == 403)

    # ------------------------------------------------------------------
    section("Attendance")
    roster = ok("roster", "GET", f"/attendance/roster?batchId={batch}&subjectId={sub_a}&date={TODAY}&period=1", token=fac[0]["token"])
    mine = [r for r in roster if r["studentId"] in {s["id"] for s in students}]
    check("roster lists our students", len(mine) == 3)
    for period, absent in ((1, s3["id"]), (2, s3["id"]), (3, None)):
        recs = [{"studentId": r["studentId"], "status": "ABSENT" if r["studentId"] == absent else "PRESENT"} for r in roster]
        ok(f"allocated faculty marks period {period}", "POST", "/attendance/mark", {"subjectId": sub_a, "batchId": batch, "date": str(TODAY), "period": period, "topic": "Intro", "records": recs}, fac[0]["token"])
    check("non-allocated faculty cannot mark", call("POST", "/attendance/mark", {"subjectId": sub_a, "batchId": batch, "date": str(TODAY), "period": 1, "records": [{"studentId": s1["id"], "status": "PRESENT"}]}, fac[1]["token"])[0] == 403)
    check("future date rejected", call("POST", "/attendance/mark", {"subjectId": sub_a, "batchId": batch, "date": str(TODAY + timedelta(days=3)), "period": 1, "records": [{"studentId": s1["id"], "status": "PRESENT"}]}, admin)[0] == 400)
    sm = ok("student attendance summary", "GET", f"/attendance/student/{s3['id']}/summary", token=s3["token"])
    sub_row = next(x for x in sm["subjects"] if x["subjectId"] == sub_a)
    check("percentage computed (1 of 3 present = 33.3)", float(sub_row["percentage"]) == 33.3 and sub_row["belowThreshold"] is True, str(sub_row))
    bs = ok("batch summary", "GET", f"/attendance/batch-summary?batchId={batch}&subjectId={sub_a}", token=fac[0]["token"])
    check("batch summary flags low attendance", any(r["studentId"] == s3["id"] and r["belowThreshold"] for r in bs))
    notes = ok("absent student notified", "GET", "/notifications", token=s3["token"])
    check("absence notification delivered", any(n["type"] == "ATTENDANCE" for n in notes))
    ok("mark faculty attendance", "POST", "/attendance/faculty", {"facultyId": fac[0]["id"], "date": str(TODAY), "status": "PRESENT"}, admin)

    # ------------------------------------------------------------------
    section("Timetable")
    slot = {"batchId": batch, "subjectId": sub_a, "facultyId": fac[0]["id"], "dayOfWeek": 1, "startTime": "09:00:00", "endTime": "10:00:00", "room": f"R{RUN}", "academicYear": ay}
    ok("create slot", "POST", "/timetable", slot, admin)
    check("faculty clash -> 409", call("POST", "/timetable", {**slot, "subjectId": sub_b, "room": "OTHER1"}, admin)[0] == 409)
    check("room clash -> 409", call("POST", "/timetable", {**slot, "facultyId": fac[1]["id"], "subjectId": sub_b}, admin)[0] == 409)
    ok("non-overlapping slot ok", "POST", "/timetable", {**slot, "subjectId": sub_b, "startTime": "10:00:00", "endTime": "11:00:00"}, admin)
    check("student sees batch timetable", len(ok("my timetable", "GET", "/timetable/my", token=s1["token"])) >= 2)
    check("faculty sees own timetable", len(ok("faculty timetable", "GET", "/timetable/my", token=fac[0]["token"])) >= 2)

    # ------------------------------------------------------------------
    section("Examinations & results")
    exam = ok("create FINAL exam", "POST", "/exams", {"name": f"Semester 1 Finals {RUN}", "examType": "FINAL", "batchId": batch, "semesterId": sem1, "academicYear": ay,
                                                     "startDate": str(TODAY - timedelta(days=1)), "endDate": str(TODAY + timedelta(days=5))}, admin)["id"]
    paper_a = ok("schedule paper A (written)", "POST", f"/exams/{exam}/schedules", {"subjectId": sub_a, "examDate": str(TODAY), "startTime": "10:00:00", "endTime": "13:00:00", "room": "H1", "maxMarks": 100, "passMarks": 40, "online": False}, admin)["id"]
    paper_b = ok("schedule paper B (online)", "POST", f"/exams/{exam}/schedules", {"subjectId": sub_b, "examDate": str(TODAY), "startTime": "10:00:00", "endTime": "11:00:00", "maxMarks": 20, "passMarks": 8, "online": True, "durationMinutes": 30}, admin)["id"]
    check("duplicate paper for same subject -> 409", call("POST", f"/exams/{exam}/schedules", {"subjectId": sub_a, "examDate": str(TODAY), "startTime": "10:00:00", "endTime": "11:00:00", "maxMarks": 10, "passMarks": 5, "online": False}, admin)[0] == 409)
    for q in range(4):
        ok(f"add question {q + 1}", "POST", f"/exams/schedules/{paper_b}/questions", {"questionText": f"Q{q + 1}?", "optionA": "a", "optionB": "b", "optionC": "c", "optionD": "d", "correctOption": "B", "marks": 5}, fac[0]["token"])
    my_exams = ok("student sees hall-ticket data", "GET", "/exams/my", token=s1["token"])
    check("student sees both papers", len([e for e in my_exams if e["examName"].endswith(RUN)]) == 2)
    paper = ok("start online exam", "POST", f"/exams/schedules/{paper_b}/start", token=s1["token"])
    check("answers are not leaked in the paper", all("correctOption" not in q for q in paper["questions"]))
    answers = [{"questionId": q["id"], "selected": "B" if i < 3 else "A"} for i, q in enumerate(paper["questions"])]
    res = ok("submit online exam", "POST", f"/exams/schedules/{paper_b}/submit", {"answers": answers}, s1["token"])
    check("auto-graded 15/20", res["marksObtained"] in (15, 15.0) or float(res["marksObtained"]) == 15.0, str(res))
    check("cannot resubmit", call("POST", f"/exams/schedules/{paper_b}/submit", {"answers": answers}, s1["token"])[0] == 409)
    check("unrelated user can't see exam", call("GET", f"/exams/{exam}", token=lib)[0] == 403)
    check("parent of a batch student can see it", call("GET", f"/exams/{exam}", token=parent_tok)[0] == 200)

    sheet = ok("marks sheet (paper A)", "GET", f"/results/schedule/{paper_a}/sheet", token=fac[0]["token"])
    check("sheet has our students", len([r for r in sheet["rows"] if r["studentId"] in {s["id"] for s in students}]) == 3)
    ok("publish blocked while marks are missing", "POST", f"/results/exam/{exam}/publish", token=admin, expect=409)
    entries = []
    for r in sheet["rows"]:
        marks = {s1["id"]: 88, s2["id"]: 72, s3["id"]: 30}.get(r["studentId"], 50)
        entries.append({"studentId": r["studentId"], "marks": marks, "absent": False})
    check("marks above max rejected", call("PUT", f"/results/schedule/{paper_a}", {"entries": [{"studentId": s1["id"], "marks": 101, "absent": False}]}, fac[0]["token"])[0] == 400)
    ok("save marks paper A", "PUT", f"/results/schedule/{paper_a}", {"entries": entries}, fac[0]["token"])
    sheet_b = ok("marks sheet (paper B)", "GET", f"/results/schedule/{paper_b}/sheet", token=fac[0]["token"])
    entries_b = [{"studentId": r["studentId"], "marks": r["marksObtained"], "absent": r["marksObtained"] is None} for r in sheet_b["rows"]]
    ok("complete paper B marks", "PUT", f"/results/schedule/{paper_b}", {"entries": entries_b}, admin)
    check("student cannot see unpublished results", ok("results before publish", "GET", f"/results/student/{s1['id']}", token=s1["token"])["exams"] == [])
    ok("publish results", "POST", f"/results/exam/{exam}/publish", token=admin)
    check("cannot publish twice", call("POST", f"/results/exam/{exam}/publish", token=admin)[0] == 409)
    check("cannot edit marks after publish", call("PUT", f"/results/schedule/{paper_a}", {"entries": entries[:1]}, admin)[0] == 409)
    r1 = ok("student results", "GET", f"/results/student/{s1['id']}", token=s1["token"])
    grades = {x["subjectName"]: x for x in r1["exams"][0]["results"]}
    check("88/100 graded A+ (9 pts)", grades[f"Algorithms {RUN}"]["grade"] == "A+", str(grades))
    check("CGPA = (9*4 + 8*3)/7 = 8.57", r1["cgpa"] is not None and abs(float(r1["cgpa"]) - 8.57) < 0.01, str(r1["cgpa"]))
    check("SGPA written to academic history", any(h["sgpa"] is not None for h in r1["semesters"]))
    r3 = ok("failing student results", "GET", f"/results/student/{s3['id']}", token=s3["token"])
    check("30/100 is FAIL with grade F", any(x["resultStatus"] == "FAIL" and x["grade"] == "F" for x in r3["exams"][0]["results"]))
    check("failing student marked BACKLOG", any(h["status"] == "BACKLOG" for h in r3["semesters"]))
    summary = ok("exam summary", "GET", f"/results/exam/{exam}/summary", token=admin)
    check("summary lists both papers", len(summary) == 2)
    check("result notification delivered", any(n["type"] == "RESULT" for n in ok("notes", "GET", "/notifications", token=s1["token"])))

    # ------------------------------------------------------------------
    section("Fees & scholarships")
    ok("add tuition head", "POST", "/fees/structures", {"courseId": course["id"], "semesterId": sem1, "name": f"Tuition {RUN}", "amount": 40000}, acct)
    ok("add lab head", "POST", "/fees/structures", {"courseId": course["id"], "semesterId": sem1, "name": f"Lab {RUN}", "amount": 5000}, acct)
    gen = ok("generate invoices for batch", "POST", "/fees/invoices/generate", {"batchId": batch, "semesterId": sem1, "title": f"Sem1 Fees {RUN}", "dueDate": str(TODAY + timedelta(days=30))}, acct)
    check("invoices created for all active students in batch", gen["created"] >= 3, str(gen))
    gen2 = ok("regenerate is idempotent", "POST", "/fees/invoices/generate", {"batchId": batch, "semesterId": sem1, "title": f"Sem1 Fees {RUN}", "dueDate": str(TODAY + timedelta(days=30))}, acct)
    check("no duplicates created", gen2["created"] == 0)
    fees = ok("student fees", "GET", f"/fees/student/{s1['id']}", token=s1["token"])
    inv = next(i for i in fees["invoices"] if i["title"] == f"Sem1 Fees {RUN}")
    check("invoice totals tuition + lab = 45000", float(inv["totalAmount"]) == 45000.0)
    check("overpayment rejected", call("POST", f"/fees/invoices/{inv['id']}/pay-online", {"amount": 99999}, s1["token"])[0] == 400)
    p1 = ok("student pays 15000 online", "POST", f"/fees/invoices/{inv['id']}/pay-online", {"amount": 15000}, s1["token"])
    check("balance now 30000", float(p1["balance"]) == 30000.0)
    s2_inv = next(i for i in ok("s2 fees", "GET", f"/fees/student/{s2['id']}", token=s2["token"])["invoices"] if i["title"] == f"Sem1 Fees {RUN}")
    check("student cannot pay classmate's invoice", call("POST", f"/fees/invoices/{s2_inv['id']}/pay-online", {"amount": 10}, s1["token"])[0] == 403)
    p2 = ok("accountant records remaining cash", "POST", f"/fees/invoices/{inv['id']}/pay", {"amount": 30000, "method": "CASH"}, acct)
    check("invoice now PAID", [i for i in ok("fees again", "GET", f"/fees/student/{s1['id']}", token=s1["token"])["invoices"] if i["id"] == inv["id"]][0]["status"] == "PAID")
    check("cannot pay a paid invoice", call("POST", f"/fees/invoices/{inv['id']}/pay", {"amount": 1, "method": "CASH"}, acct)[0] == 409)
    rc = ok("receipt", "GET", f"/fees/payments/{p2['paymentId']}/receipt", token=s1["token"])
    check("receipt has number", str(rc["receiptNumber"]).startswith("RCT-"))
    check("receipt hidden from other students", call("GET", f"/fees/payments/{p2['paymentId']}/receipt", token=s2["token"])[0] == 403)
    ok("fee summary", "GET", "/fees/summary", token=acct)

    scheme = ok("create 50% scholarship", "POST", "/scholarships/schemes", {"name": f"Merit {RUN}", "description": "Top performers", "discountType": "PERCENT", "discountValue": 50, "minCgpa": 8.0}, acct)["id"]
    check("CGPA below minimum is rejected", call("POST", "/scholarships/applications", {"schemeId": scheme, "statement": "please"}, s3["token"])[0] == 400)
    app_id = ok("student applies", "POST", "/scholarships/applications", {"schemeId": scheme, "statement": "I worked hard"}, s1["token"])["id"]
    check("duplicate application -> 409", call("POST", "/scholarships/applications", {"schemeId": scheme}, s1["token"])[0] == 409)
    ok("extra invoice for scholarship student", "POST", "/fees/invoices", {"studentId": s1["id"], "title": f"Exam fee {RUN}", "amount": 2000, "dueDate": str(TODAY + timedelta(days=10))}, acct)
    dec = ok("approve scholarship", "PATCH", f"/scholarships/applications/{app_id}/decide", {"approve": True, "remarks": "well done"}, acct)
    check("50% of the open 2000 invoice = 1000 discount", float(dec["discountApplied"]) == 1000.0, str(dec))
    check("cannot decide twice", call("PATCH", f"/scholarships/applications/{app_id}/decide", {"approve": False}, acct)[0] == 409)
    ok("waive invoice", "POST", f"/fees/invoices/{s2_inv['id']}/waive", token=admin)

    # ------------------------------------------------------------------
    section("Payroll")
    ok("set salary", "PUT", f"/payroll/structures/{fac[0]['id']}", {"basic": 60000, "hra": 12000, "allowances": 3000, "deductions": 2000}, acct)
    gen = ok("generate payslips", "POST", "/payroll/generate", {"month": TODAY.month, "year": TODAY.year}, acct)
    check("payslip generated", gen["generated"] >= 1)
    slips = ok("faculty sees own payslips", "GET", "/payroll/payslips/me", token=fac[0]["token"])
    slip = slips[0]
    check("3 unpaid-leave days deducted (60000/30*3 = 6000)", slip["unpaidLeaveDays"] == 3 and float(slip["leaveDeduction"]) == 6000.0, str(slip))
    check("net = 60000+12000+3000-2000-6000 = 67000", float(slip["netPay"]) == 67000.0)
    ok("mark paid", "PATCH", f"/payroll/payslips/{slip['id']}/pay", token=acct)
    check("faculty can't read payroll admin list", call("GET", f"/payroll/payslips?month={TODAY.month}&year={TODAY.year}", token=fac[0]["token"])[0] == 403)

    # ------------------------------------------------------------------
    section("Library")
    book = ok("add book (2 copies)", "POST", "/library/books", {"isbn": f"978{RUN}", "title": f"Clean Code {RUN}", "author": "R. Martin", "category": "Software", "totalCopies": 2, "shelfLocation": "A1"}, lib)["id"]
    check("search finds the book", any(b["id"] == book for b in ok("search", "GET", f"/library/books?q=clean code {RUN}".replace(" ", "%20"), token=s1["token"])))
    mem = ok("member lookup by roll number", "GET", f"/library/members/lookup?q={s1['roll']}", token=lib)
    check("student loan limit is 3", mem["loanLimit"] == 3)
    iss = ok("issue book to student", "POST", "/library/issues", {"bookId": book, "member": s1["roll"], "days": 14}, lib)
    check("duplicate copy blocked", call("POST", "/library/issues", {"bookId": book, "member": s1["roll"]}, lib)[0] == 409)
    ok("renew", "POST", f"/library/issues/{iss['id']}/renew", token=lib)
    check("student sees own loans", any(i["id"] == iss["id"] for i in ok("my loans", "GET", "/library/issues/my", token=s1["token"])))
    psql(f"UPDATE book_issues SET due_on = current_date - 5 WHERE id = {iss['id']}")
    check("overdue shows computed fine of 10", any(float(i["currentFine"]) == 10.0 for i in ok("overdue", "GET", "/library/issues?status=OVERDUE", token=lib) if i["id"] == iss["id"]))
    check("overdue book can't be renewed", call("POST", f"/library/issues/{iss['id']}/renew", token=lib)[0] == 409)
    ret = ok("return overdue book", "POST", f"/library/issues/{iss['id']}/return", token=lib)
    check("fine = 5 days x 2 = 10", float(ret["fine"]) == 10.0 and ret["daysLate"] == 5, str(ret))
    check("fine blocks next borrow", call("POST", "/library/issues", {"bookId": book, "member": s1["roll"]}, lib)[0] == 409)
    ok("pay fine", "POST", f"/library/issues/{iss['id']}/pay-fine", token=lib)
    ok("can borrow again after paying", "POST", "/library/issues", {"bookId": book, "member": s1["roll"]}, lib)
    check("copies tracked (1 of 2 available)", [b for b in ok("books", "GET", f"/library/books?q={RUN}", token=lib) if b["id"] == book][0]["availableCopies"] == 1)
    ok("library stats", "GET", "/library/stats", token=lib)
    check("accountant cannot add library books", call("POST", "/library/books", {"title": "x", "author": "y", "totalCopies": 1}, acct)[0] == 403)
    check("student cannot issue books", call("POST", "/library/issues", {"bookId": book, "member": s2["roll"]}, s1["token"])[0] == 403)

    # ------------------------------------------------------------------
    section("Hostel & transport")
    boys = ok("add boys hostel", "POST", "/hostel/hostels", {"name": f"Aryabhata {RUN}", "hostelType": "BOYS"}, warden)["id"]
    room = ok("add room (cap 1)", "POST", "/hostel/rooms", {"hostelId": boys, "roomNumber": f"101{RUN}", "capacity": 1, "feePerTerm": 15000}, warden)["id"]
    check("girl can't be placed in boys hostel", call("POST", "/hostel/allocations", {"student": s1["roll"], "roomId": room}, warden)[0] == 400)
    al = ok("allocate boy", "POST", "/hostel/allocations", {"student": s2["roll"], "roomId": room}, warden)
    check("full room rejects second student", call("POST", "/hostel/allocations", {"student": s3["roll"], "roomId": room}, warden)[0] == 409)
    check("student sees allocation", ok("my hostel", "GET", "/hostel/my", token=s2["token"])["allocated"] is True)
    comp = ok("student raises complaint", "POST", "/hostel/complaints", {"subject": "Broken fan", "description": "Room 101"}, s2["token"])
    check("non-resident can't complain", call("POST", "/hostel/complaints", {"subject": "x"}, s1["token"])[0] == 400)
    ok("warden resolves complaint", "PATCH", f"/hostel/complaints/{comp['id']}", {"status": "RESOLVED", "resolution": "Replaced"}, warden)
    ok("vacate", "POST", f"/hostel/allocations/{al['id']}/vacate", token=warden)

    route = ok("add route", "POST", "/transport/routes", {"name": f"Route {RUN}", "startPoint": "Campus", "endPoint": "City", "feePerTerm": 8000}, transport)["id"]
    stop = ok("add stop", "POST", "/transport/stops", {"routeId": route, "name": "Main Square", "pickupTime": "07:30:00", "seq": 1}, transport)["id"]
    check("no vehicle -> cannot allocate", call("POST", "/transport/allocations", {"student": s1["roll"], "routeId": route, "stopId": stop}, transport)[0] == 409)
    ok("add bus (cap 1)", "POST", "/transport/vehicles", {"registrationNo": f"MH12{RUN}", "capacity": 1, "driverName": "Ravi", "driverPhone": "900", "routeId": route}, transport)
    ok("allocate rider", "POST", "/transport/allocations", {"student": s1["roll"], "routeId": route, "stopId": stop}, transport)
    check("bus full", call("POST", "/transport/allocations", {"student": s2["roll"], "routeId": route, "stopId": stop}, transport)[0] == 409)
    check("student sees route", ok("my transport", "GET", "/transport/my", token=s1["token"])["allocated"] is True)

    # ------------------------------------------------------------------
    section("Placement")
    comp_id = ok("add company", "POST", "/placement/companies", {"name": f"Acme {RUN}", "industry": "Software", "website": "https://acme.example", "contactEmail": "hr@acme.example"}, placement)["id"]
    drive = ok("create drive (min CGPA 8)", "POST", "/placement/drives", {"companyId": comp_id, "title": f"SDE {RUN}", "description": "Backend", "packageLpa": 12.5, "driveDate": str(TODAY + timedelta(days=20)),
                                                                          "lastApplyDate": str(TODAY + timedelta(days=10)), "minCgpa": 8.0}, placement)["id"]
    drives = ok("student lists drives with eligibility", "GET", "/placement/drives", token=s1["token"])
    d = next(x for x in drives if x["id"] == drive)
    check("CGPA 8.57 is eligible", d["eligible"] is True)
    d3 = next(x for x in ok("s3 drives", "GET", "/placement/drives", token=s3["token"]) if x["id"] == drive)
    check("failing student is ineligible with reason", d3["eligible"] is False and d3["ineligibleReason"])
    ok("eligible student applies", "POST", f"/placement/drives/{drive}/apply", token=s1["token"])
    check("duplicate application -> 409", call("POST", f"/placement/drives/{drive}/apply", token=s1["token"])[0] == 409)
    check("ineligible student rejected", call("POST", f"/placement/drives/{drive}/apply", token=s3["token"])[0] == 400)
    apps = ok("officer sees applicants", "GET", f"/placement/drives/{drive}/applications", token=placement)
    ok("select student", "PATCH", f"/placement/applications/{apps[0]['id']}", {"status": "SELECTED", "remarks": "Offer"}, placement)
    st = ok("placement stats", "GET", "/placement/stats", token=placement)
    check("stats count the placed student", st["studentsPlaced"] >= 1 and float(st["highestPackage"]) >= 12.5)

    # ------------------------------------------------------------------
    section("LMS, announcements, notifications")
    ok("faculty shares material", "POST", "/lms/materials", {"subjectId": sub_a, "batchId": batch, "title": "Lecture 1", "linkUrl": "https://example.com/l1"}, fac[0]["token"])
    check("non-allocated faculty can't share", call("POST", "/lms/materials", {"subjectId": sub_a, "batchId": batch, "title": "x", "linkUrl": "https://e.com"}, fac[1]["token"])[0] == 403)
    check("student sees material", len(ok("materials", "GET", f"/lms/materials?subjectId={sub_a}", token=s1["token"])) >= 1)
    asg = ok("post assignment", "POST", "/lms/assignments", {"subjectId": sub_a, "batchId": batch, "title": f"Sorting essay {RUN}", "description": "2 pages", "dueDate": str(TODAY + timedelta(days=3)), "maxMarks": 20}, fac[0]["token"])["id"]
    ok("student submits", "POST", f"/lms/assignments/{asg}/submit", {"content": "Quick sort is..."}, s1["token"])
    check("empty submission rejected", call("POST", f"/lms/assignments/{asg}/submit", {}, s2["token"])[0] == 400)
    subs = ok("faculty lists submissions", "GET", f"/lms/assignments/{asg}/submissions", token=fac[0]["token"])
    sub_row = next(x for x in subs if x["studentId"] == s1["id"])
    check("marks above max rejected", call("PATCH", f"/lms/submissions/{sub_row['submissionId']}/grade", {"marks": 99}, fac[0]["token"])[0] == 400)
    ok("grade submission", "PATCH", f"/lms/submissions/{sub_row['submissionId']}/grade", {"marks": 18, "feedback": "Good"}, fac[0]["token"])
    check("graded submission is locked", call("POST", f"/lms/assignments/{asg}/submit", {"content": "edit"}, s1["token"])[0] == 409)
    mine_asg = ok("student assignment list", "GET", "/lms/assignments/my", token=s1["token"])
    check("student sees grade", any(a["title"].endswith(RUN) and a["marks"] is not None for a in mine_asg))

    pub = ok("post public notice", "POST", "/announcements", {"title": f"Admissions open {RUN}", "body": "Apply now", "audience": "ALL", "isPublic": True}, admin)
    check("public notice visible without login", any(a["title"].endswith(RUN) for a in call("GET", "/announcements/public")[1]["data"]))
    check("faculty cannot post public notice", call("POST", "/announcements", {"title": "x", "body": "y", "isPublic": True, "batchId": batch}, fac[0]["token"])[0] == 403)
    ok("faculty posts to own batch", "POST", "/announcements", {"title": f"Class test {RUN}", "body": "Friday", "audience": "STUDENTS", "batchId": batch}, fac[0]["token"])
    check("student sees announcements", len(ok("announcements", "GET", "/announcements", token=s1["token"])) >= 2)
    bc = ok("broadcast to parents", "POST", "/notifications/broadcast", {"audience": "PARENTS", "title": f"PTM {RUN}", "message": "Saturday"}, admin)
    check("broadcast reached recipients", bc["recipients"] >= 1)
    check("parent got the broadcast", any(n["title"].endswith(RUN) for n in ok("parent notes", "GET", "/notifications", token=parent_tok)))
    unread = ok("unread count", "GET", "/notifications/unread-count", token=s1["token"])["count"]
    check("student has unread notifications", unread > 0)
    ok("mark all read", "POST", "/notifications/read-all", token=s1["token"])
    check("unread cleared", ok("unread", "GET", "/notifications/unread-count", token=s1["token"])["count"] == 0)

    # ------------------------------------------------------------------
    section("AI analytics, reports, faculty performance")
    an = ok("analyse struggling student", "GET", f"/analytics/student/{s3['id']}", token=admin)
    a = an["analysis"]
    check("risk score computed from real data", a["risk_score"] > 30 and a["risk_level"] in ("MEDIUM", "HIGH"), str(a)[:300])
    check("factors are explained", len(a["factors"]) >= 2 and a["recommendations"])
    good = ok("analyse strong student", "GET", f"/analytics/student/{s1['id']}", token=s1["token"])["analysis"]
    check("strong student scores lower risk", good["risk_score"] < a["risk_score"], f"{good['risk_score']} vs {a['risk_score']}")
    risk = ok("batch at-risk ranking", "GET", f"/analytics/at-risk?batchId={batch}", token=fac[0]["token"])
    ours = [r for r in risk if r["id"] in {s["id"] for s in students}]
    check("ranking puts failing student above strong one", ours.index(next(r for r in ours if r["id"] == s3["id"])) < ours.index(next(r for r in ours if r["id"] == s1["id"])))
    check("student can't see analytics of classmate", call("GET", f"/analytics/student/{s1['id']}", token=s3["token"])[0] == 403)

    ov = ok("report overview", "GET", "/reports/overview", token=admin)
    check("overview has counts", ov["activeStudents"] >= 3)
    for ds in ("students", "fees", "attendance", "results"):
        status, _ = call("GET", f"/reports/export/{ds}", token=admin)
        check(f"CSV export: {ds}", status == 200)
    for ep in ("enrollment", "admissions-funnel", "attendance", "fees", "results"):
        ok(f"report {ep}", "GET", f"/reports/{ep}", token=admin)
    check("students can't read reports", call("GET", "/reports/overview", token=s1["token"])[0] == 403)
    perf = ok("faculty performance", "GET", f"/faculty/{fac[0]['id']}/performance", token=fac[0]["token"])
    check("performance shows classes held", perf["totalClassesHeld"] >= 3 and perf["assignmentsPosted"] >= 1)
    check("faculty can't see colleague's report", call("GET", f"/faculty/{fac[0]['id']}/performance", token=fac[1]["token"])[0] == 403)

    # ------------------------------------------------------------------
    section("User administration & sessions")
    users = ok("list users", "GET", f"/users?q={RUN}", token=admin)
    target = next(u for u in users if u["email"] == s2["email"])
    ok("suspend user", "PATCH", f"/users/{target['id']}/status", {"status": "SUSPENDED"}, admin)
    check("suspended user's existing token stops working immediately", call("GET", "/students/me", token=s2["token"])[0] == 401)
    check("suspended user cannot login", login(s2["email"], "whatever") is None)
    ok("reactivate", "PATCH", f"/users/{target['id']}/status", {"status": "ACTIVE"}, admin)
    rp = ok("reset password", "POST", f"/users/{target['id']}/reset-password", token=admin)
    check("login with new temp password", login(s2["email"], rp["temporaryPassword"]) is not None)
    check("student can't list users", call("GET", "/users", token=s1["token"])[0] == 403)
    ok("change own password", "POST", "/users/me/change-password", {"currentPassword": PARENT_PW, "newPassword": PARENT_PW2}, parent_tok)
    check("old password no longer works", login(reg_email, PARENT_PW) is None)
    ok("enable 2FA", "PATCH", "/users/me/two-factor", {"enabled": True}, parent_tok)
    status, res = call("POST", "/auth/login", {"email": reg_email, "password": PARENT_PW2})
    check("2FA login asks for OTP", status == 200 and res["data"]["otpRequired"] is True)
    code = otp_from_log(reg_email, "LOGIN_2FA")
    status, res = call("POST", "/auth/verify-login-otp", {"email": reg_email, "code": code})
    check("2FA OTP completes login", status == 200 and res["data"]["accessToken"])
    ok("sign out everywhere", "POST", "/users/me/logout-all", token=parent_tok)

    # ------------------------------------------------------------------
    print(f"\n{passed} passed, {len(failed)} failed")
    for f in failed:
        print("  -", f)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
