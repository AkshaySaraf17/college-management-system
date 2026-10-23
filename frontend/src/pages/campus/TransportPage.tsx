import { api, type Row } from "../../api/client";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Card, PageHeader } from "../../components/ui";
import { DataTable, Empty, Notice, Stat, Tabs, fmtTime, money } from "../../components/kit";
import { FormCard } from "../../components/FormCard";

export function TransportPage() {
  const routes = useGet<Row[]>("/transport/routes");
  const allocations = useGet<Row[]>("/transport/allocations");
  const n = useNotice();
  const refresh = () => { routes.reload(); allocations.reload(); };
  const list = routes.data ?? [];
  const stops = list.flatMap((r) => r.stops.map((s: Row) => ({ ...s, routeId: r.id, routeName: r.name })));

  return (
    <div>
      <PageHeader title="Transport" subtitle="Routes, stops, vehicles and rider allocation (limited by seats on the route's buses)." />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Routes" value={list.length} /><Stat label="Buses" value={list.reduce((a, r) => a + r.vehicles.length, 0)} />
        <Stat label="Seats" value={list.reduce((a, r) => a + Number(r.seats), 0)} /><Stat label="Riders" value={list.reduce((a, r) => a + Number(r.riders), 0)} />
      </div>
      <Notice error={n.error} success={n.success} />
      <Tabs tabs={[
        { id: "routes", label: "Routes & vehicles", content: (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {list.length === 0 && <Empty>No routes yet.</Empty>}
              {list.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between">
                    <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.startPoint} to {r.endPoint} · {money(r.feePerTerm)} / term · {r.riders}/{r.seats} seats used</p></div>
                    <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.delete(`/transport/routes/${r.id}`), "Route removed.", refresh)}>Remove</button>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div><p className="mb-1 text-xs font-semibold uppercase text-slate-400">Stops</p>{r.stops.length === 0 ? <p className="text-slate-400">None</p> : r.stops.map((s: Row) => <p key={s.id}>{fmtTime(s.pickupTime)} · {s.name}</p>)}</div>
                    <div><p className="mb-1 text-xs font-semibold uppercase text-slate-400">Vehicles</p>{r.vehicles.length === 0 ? <p className="text-slate-400">None</p> : r.vehicles.map((v: Row) => <p key={v.id}>{v.registrationNo} · {v.capacity} seats · {v.driverName}</p>)}</div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="space-y-4">
              <FormCard title="Add route" busy={n.busy} submitLabel="Add route" fields={[{ name: "name", label: "Name", required: true }, { name: "startPoint", label: "From", required: true }, { name: "endPoint", label: "To", required: true }, { name: "feePerTerm", label: "Fee per term", type: "number", step: "0.01" }]}
                onSubmit={(v) => n.run(() => api.post("/transport/routes", v), "Route added.", refresh)} />
              <FormCard title="Add stop" busy={n.busy} submitLabel="Add stop" fields={[{ name: "routeId", label: "Route", type: "select", required: true, options: list.map((r) => ({ value: r.id, label: r.name })) }, { name: "name", label: "Stop", required: true }, { name: "pickupTime", label: "Pickup time", type: "time", required: true }, { name: "seq", label: "Order", type: "number", defaultValue: 1 }]}
                onSubmit={(v) => n.run(() => api.post("/transport/stops", { ...v, pickupTime: `${v.pickupTime}:00`.slice(0, 8) }), "Stop added.", refresh)} />
              <FormCard title="Add vehicle" busy={n.busy} submitLabel="Add vehicle" fields={[{ name: "registrationNo", label: "Registration no.", required: true }, { name: "capacity", label: "Seats", type: "number", min: 1, required: true }, { name: "driverName", label: "Driver" }, { name: "driverPhone", label: "Driver phone" }, { name: "routeId", label: "Route", type: "select", options: list.map((r) => ({ value: r.id, label: r.name })) }]}
                onSubmit={(v) => n.run(() => api.post("/transport/vehicles", v), "Vehicle added.", refresh)} />
            </div>
          </div>) },
        { id: "riders", label: "Rider allocation", content: (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DataTable rows={allocations.data ?? []} empty="No students use the bus yet."
                columns={[
                  { key: "studentName", label: "Student", render: (a) => <div><p className="font-medium">{a.studentName}</p><p className="font-mono text-xs text-slate-500">{a.rollNumber}</p></div> },
                  { key: "routeName", label: "Route" }, { key: "stopName", label: "Stop", render: (a) => (a.stopName ? `${a.stopName} · ${fmtTime(a.pickupTime)}` : "-") },
                  { key: "a", label: "", render: (a) => <button className="text-sm text-red-600 hover:underline" onClick={() => n.run(() => api.post(`/transport/allocations/${a.id}/cancel`), "Cancelled.", refresh)}>Cancel</button> },
                ]} />
            </div>
            <FormCard title="Allocate a rider" busy={n.busy} submitLabel="Allocate"
              fields={[{ name: "student", label: "Student roll number", required: true }, { name: "routeId", label: "Route", type: "select", required: true, options: list.map((r) => ({ value: r.id, label: `${r.name} (${Number(r.seats) - Number(r.riders)} seats free)` })) },
                { name: "stopId", label: "Stop", type: "select", options: stops.map((s) => ({ value: s.id, label: `${s.routeName} · ${s.name}` })) }]}
              onSubmit={(v) => n.run(() => api.post("/transport/allocations", v), "Rider allocated.", refresh)} />
          </div>) },
      ]} />
    </div>
  );
}
