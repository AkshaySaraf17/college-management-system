import { useState } from "react";
import { api, type Row } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, Card, Field, Input, PageHeader, Select, StatusBadge } from "../../components/ui";
import { DataTable, Notice, Stat, Tabs, fmtDate, money } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

function Catalog({ manage }: { manage: boolean }) {
  const [q, setQ] = useState("");
  const { data, loading, reload } = useGet<Row[]>(`/library/books?q=${encodeURIComponent(q)}`);
  const n = useNotice();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Input placeholder="Search by title, author or ISBN" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 w-full" />
        <Notice error={n.error} success={n.success} />
        <DataTable loading={loading} rows={data ?? []} empty="No books found."
          columns={[
            { key: "title", label: "Book", render: (b) => <div><p className="font-medium text-slate-900">{b.title}</p><p className="text-xs text-slate-500">{b.author}{b.category ? ` · ${b.category}` : ""}</p></div> },
            { key: "shelfLocation", label: "Shelf" },
            { key: "available", label: "Available", render: (b) => <span className={b.availableCopies === 0 ? "font-medium text-red-600" : ""}>{b.availableCopies} / {b.totalCopies}</span> },
            ...(manage ? [{ key: "a", label: "", render: (b: Row) => <button className="text-sm text-red-600 hover:underline" onClick={() => { if (confirm(`Remove "${b.title}"?`)) n.run(() => api.delete(`/library/books/${b.id}`), "Removed.", reload); }}>Remove</button> }] : []),
          ]} />
      </div>
      {manage && (
        <FormCard title="Add a book" busy={n.busy} submitLabel="Add book"
          fields={[{ name: "title", label: "Title", required: true }, { name: "author", label: "Author", required: true }, { name: "isbn", label: "ISBN" }, { name: "publisher", label: "Publisher" },
            { name: "category", label: "Category" }, { name: "totalCopies", label: "Copies", type: "number", min: 1, defaultValue: 1, required: true }, { name: "shelfLocation", label: "Shelf location" }]}
          onSubmit={(v) => n.run(() => api.post("/library/books", v), "Book added.", reload)} />
      )}
    </div>
  );
}

function Desk() {
  const books = useGet<Row[]>("/library/books");
  const [member, setMember] = useState("");
  const [info, setInfo] = useState<Row | null>(null);
  const n = useNotice();
  const lookup = () => n.run(async () => setInfo((await api.get(`/library/members/lookup?q=${encodeURIComponent(member)}`)).data.data), undefined);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Issue a book</h2>
        <Notice error={n.error} success={n.success} />
        <div className="mb-3 flex items-end gap-2">
          <div className="flex-1"><Field label="Member (roll no., employee code or email)"><Input value={member} onChange={(e) => { setMember(e.target.value); setInfo(null); }} /></Field></div>
          <Button variant="secondary" disabled={!member || n.busy} onClick={lookup}>Look up</Button>
        </div>
        {info && (
          <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <strong>{info.name}</strong> · {info.activeLoans}/{info.loanLimit} books out{Number(info.unpaidFines) > 0 && <span className="text-red-600"> · unpaid fines {money(info.unpaidFines)}</span>}
          </p>
        )}
        <FormCard plain busy={n.busy} submitLabel="Issue book"
          fields={[{ name: "bookId", label: "Book", type: "select", required: true, options: (books.data ?? []).filter((b) => b.availableCopies > 0).map((b) => ({ value: b.id, label: `${b.title} (${b.availableCopies} left)` })) },
            { name: "days", label: "Loan period (days)", type: "number", defaultValue: 14, min: 1 }]}
          onSubmit={(v) => n.run(() => api.post("/library/issues", { ...v, member }), "Book issued.", books.reload)} />
      </Card>
      <Card><Loans embedded /></Card>
    </div>
  );
}

function Loans({ embedded }: { embedded?: boolean }) {
  const [status, setStatus] = useState("ACTIVE");
  const [q, setQ] = useState("");
  const { data, loading, reload } = useGet<Row[]>(`/library/issues?status=${status}&q=${encodeURIComponent(q)}`);
  const n = useNotice();
  return (
    <div>
      {embedded && <h2 className="mb-3 text-sm font-semibold text-slate-900">Loans</h2>}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>{["ACTIVE", "OVERDUE", "FINES", "RETURNED"].map((s) => <option key={s} value={s}>{s === "FINES" ? "Unpaid fines" : s[0] + s.slice(1).toLowerCase()}</option>)}</Select>
        <Input placeholder="Search book or member" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Notice error={n.error} success={n.success} />
      <DataTable loading={loading} rows={data ?? []} empty="No loans in this view."
        columns={[
          { key: "title", label: "Book", render: (i) => <div><p className="font-medium">{i.title}</p><p className="text-xs text-slate-500">{i.memberName}</p></div> },
          { key: "dueOn", label: "Due", render: (i) => <span className={i.overdue ? "font-medium text-red-600" : ""}>{fmtDate(i.dueOn)}</span> },
          { key: "fine", label: "Fine", render: (i) => (Number(i.currentFine) > 0 ? <span>{money(i.currentFine)} {i.returnedOn && (i.finePaid ? <StatusBadge status="ACTIVE" label="Paid" /> : <StatusBadge status="REJECTED" label="Unpaid" />)}</span> : "-") },
          { key: "a", label: "", render: (i) => (
            <div className="flex flex-col items-start gap-1 text-xs">
              {!i.returnedOn && <button className="font-medium text-indigo-600 hover:underline" onClick={() => n.run(() => api.post(`/library/issues/${i.id}/return`), "Returned.", reload)}>Return</button>}
              {!i.returnedOn && !i.overdue && <button className="text-slate-700 hover:underline" onClick={() => n.run(() => api.post(`/library/issues/${i.id}/renew`), "Renewed for 7 days.", reload)}>Renew</button>}
              {Number(i.fineAmount) > 0 && !i.finePaid && <button className="text-green-700 hover:underline" onClick={() => n.run(() => api.post(`/library/issues/${i.id}/pay-fine`), "Fine recorded as paid.", reload)}>Mark fine paid</button>}
            </div>
          ) },
        ]} />
    </div>
  );
}

function MyLoans() {
  const { data, loading } = useGet<Row[]>("/library/issues/my");
  return <DataTable loading={loading} rows={data ?? []} empty="You have no borrowing history."
    columns={[{ key: "title", label: "Book" }, { key: "issuedOn", label: "Issued", render: (i) => fmtDate(i.issuedOn) }, { key: "dueOn", label: "Due", render: (i) => fmtDate(i.dueOn) },
      { key: "returnedOn", label: "Returned", render: (i) => (i.returnedOn ? fmtDate(i.returnedOn) : i.overdue ? "Overdue" : "On loan") }, { key: "fine", label: "Fine", render: (i) => (Number(i.currentFine) > 0 ? money(i.currentFine) : "-") }]} />;
}

export function LibraryPage() {
  const { hasRole } = useAuth();
  const librarian = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "LIBRARIAN");
  const stats = useGet<Row>(librarian ? "/library/stats" : null);
  return (
    <div>
      <PageHeader title="Library" subtitle="Search the catalog; librarians issue, renew and return books and track fines (2.00 per late day)." />
      {stats.data && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Titles" value={stats.data.titles} /><Stat label="Copies" value={stats.data.totalCopies} /><Stat label="On loan" value={stats.data.onLoan} />
          <Stat label="Overdue" value={stats.data.overdue} tone={Number(stats.data.overdue) > 0 ? "bad" : "good"} /><Stat label="Unpaid fines" value={money(stats.data.unpaidFines)} />
        </div>
      )}
      <Tabs tabs={[
        { id: "catalog", label: "Catalog", content: <Catalog manage={librarian} /> },
        ...(librarian ? [{ id: "desk", label: "Issue & return desk", content: <Desk /> }, { id: "loans", label: "All loans", content: <Loans /> }] : [{ id: "mine", label: "My loans", content: <MyLoans /> }]),
      ]} />
    </div>
  );
}
