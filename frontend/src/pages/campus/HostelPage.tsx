import { api, type Row } from "../../api/client";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Button, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, Notice, Stat, Tabs, fmtDate, money } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

export function HostelPage() {
  const hostels = useGet<Row[]>("/hostel/hostels");
  const rooms = useGet<Row[]>("/hostel/rooms");
  const allocations = useGet<Row[]>("/hostel/allocations?status=ACTIVE");
  const complaints = useGet<Row[]>("/hostel/complaints");
  const n = useNotice();
  const refresh = () => { hostels.reload(); rooms.reload(); allocations.reload(); };
  const totals = (hostels.data ?? []).reduce((a, h) => ({ cap: a.cap + Number(h.capacity), occ: a.occ + Number(h.occupied) }), { cap: 0, occ: 0 });

  return (
    <div>
      <PageHeader title="Hostel" subtitle="Hostels, rooms, allocations and resident complaints." />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Hostels" value={(hostels.data ?? []).length} /><Stat label="Beds" value={totals.cap} /><Stat label="Residents" value={totals.occ} />
        <Stat label="Open complaints" value={(complaints.data ?? []).filter((c) => c.status !== "RESOLVED").length} tone={(complaints.data ?? []).some((c) => c.status === "OPEN") ? "warn" : "good"} />
      </div>
      <Notice error={n.error} success={n.success} />
      <Tabs tabs={[
        { id: "alloc", label: "Allocation", content: (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DataTable rows={allocations.data ?? []} empty="No students are currently allocated."
                columns={[
                  { key: "studentName", label: "Resident", render: (a) => <div><p className="font-medium">{a.studentName}</p><p className="font-mono text-xs text-slate-500">{a.rollNumber}</p></div> },
                  { key: "room", label: "Room", render: (a) => `${a.hostelName} · ${a.roomNumber}` }, { key: "fromDate", label: "Since", render: (a) => fmtDate(a.fromDate) },
                  { key: "a", label: "", render: (a) => <button className="text-sm text-red-600 hover:underline" onClick={() => { if (confirm(`Vacate ${a.studentName}?`)) n.run(() => api.post(`/hostel/allocations/${a.id}/vacate`), "Vacated.", refresh); }}>Vacate</button> },
                ]} />
            </div>
            <FormCard title="Allocate a room" busy={n.busy} submitLabel="Allocate"
              fields={[{ name: "student", label: "Student roll number", required: true },
                { name: "roomId", label: "Room", type: "select", required: true, options: (rooms.data ?? []).filter((r) => r.occupied < r.capacity).map((r) => ({ value: r.id, label: `${r.hostelName} ${r.roomNumber} (${r.capacity - r.occupied} free, ${r.hostelType.toLowerCase()})` })) }]}
              onSubmit={(v) => n.run(() => api.post("/hostel/allocations", v), "Room allocated.", refresh)} />
          </div>) },
        { id: "rooms", label: "Hostels & rooms", content: (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <DataTable rows={hostels.data ?? []} columns={[{ key: "name", label: "Hostel" }, { key: "hostelType", label: "Type" }, { key: "rooms", label: "Rooms" }, { key: "occ", label: "Occupied / capacity", render: (h) => `${h.occupied} / ${h.capacity}` },
                { key: "a", label: "", render: (h) => <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/hostel/hostels/${h.id}`), "Removed.", refresh)}>Remove</button> }]} />
              <DataTable rows={rooms.data ?? []} columns={[{ key: "hostelName", label: "Hostel" }, { key: "roomNumber", label: "Room" }, { key: "capacity", label: "Beds" }, { key: "occupied", label: "Occupied" }, { key: "feePerTerm", label: "Fee / term", render: (r) => money(r.feePerTerm) },
                { key: "a", label: "", render: (r) => <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/hostel/rooms/${r.id}`), "Removed.", refresh)}>Remove</button> }]} />
            </div>
            <div className="space-y-4">
              <FormCard title="Add hostel" busy={n.busy} submitLabel="Add hostel" fields={[{ name: "name", label: "Name", required: true }, { name: "hostelType", label: "Type", type: "select", required: true, options: [{ value: "BOYS", label: "Boys" }, { value: "GIRLS", label: "Girls" }] }]}
                onSubmit={(v) => n.run(() => api.post("/hostel/hostels", v), "Hostel added.", refresh)} />
              <FormCard title="Add room" busy={n.busy} submitLabel="Add room"
                fields={[{ name: "hostelId", label: "Hostel", type: "select", required: true, options: (hostels.data ?? []).map((h) => ({ value: h.id, label: h.name })) }, { name: "roomNumber", label: "Room number", required: true },
                  { name: "capacity", label: "Beds", type: "number", min: 1, required: true, defaultValue: 2 }, { name: "feePerTerm", label: "Fee per term", type: "number", step: "0.01" }]}
                onSubmit={(v) => n.run(() => api.post("/hostel/rooms", v), "Room added.", refresh)} />
            </div>
          </div>) },
        { id: "complaints", label: "Complaints", content: (
          <DataTable rows={complaints.data ?? []} empty="No complaints."
            columns={[
              { key: "studentName", label: "Student", render: (c) => <div><p>{c.studentName}</p><p className="font-mono text-xs text-slate-500">{c.rollNumber}</p></div> },
              { key: "subject", label: "Complaint", render: (c) => <div><p className="font-medium">{c.subject}</p><p className="text-xs text-slate-500">{c.description}</p></div> },
              { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
              { key: "a", label: "", render: (c) => c.status !== "RESOLVED" && (
                <div className="flex gap-2">
                  {c.status === "OPEN" && <Button variant="secondary" onClick={() => n.run(() => api.patch(`/hostel/complaints/${c.id}`, { status: "IN_PROGRESS" }), undefined, complaints.reload)}>Start</Button>}
                  <Button onClick={() => { const resolution = prompt("How was it resolved?") ?? ""; n.run(() => api.patch(`/hostel/complaints/${c.id}`, { status: "RESOLVED", resolution }), "Resolved.", complaints.reload); }}>Resolve</Button>
                </div>) },
            ]} />) },
      ]} />
    </div>
  );
}
