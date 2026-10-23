import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, unwrap } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { CalendarEvent } from "../../api/types";
import { Button, Card, ErrorText, Field, Input, PageHeader, Select } from "../../components/ui";

const initialForm = { title: "", description: "", eventType: "GENERAL", startDate: "", endDate: "" };

export function CalendarPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "HOD");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await unwrap<CalendarEvent[]>(api.get("/calendar-events"));
      setEvents(data.sort((a, b) => a.startDate.localeCompare(b.startDate)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/calendar-events", form);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader title="Academic Calendar" subtitle="Holidays, exams, and semester milestones." />
      <ErrorText message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">{e.title}</td>
                  <td className="px-4 py-3">{e.eventType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{e.startDate}</td>
                  <td className="px-4 py-3">{e.endDate}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No events scheduled.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {canManage && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Add event</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Field label="Title"><Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
              <Field label="Type">
                <Select value={form.eventType} onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}>
                  <option value="GENERAL">General</option>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="EXAM">Exam</option>
                  <option value="SEMESTER_START">Semester start</option>
                  <option value="SEMESTER_END">Semester end</option>
                </Select>
              </Field>
              <Field label="Start date"><Input type="date" required value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
              <Field label="End date"><Input type="date" required value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></Field>
              <Field label="Description"><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
              <Button type="submit">Add event</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
