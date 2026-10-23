import type { Row } from "../api/client";
import { DAYS, Empty, fmtTime } from "./kit";

/** Weekly timetable: one card per weekday that has classes, so it reads well on phones too. */
export function TimetableGrid({ slots, showBatch, showFaculty = true, onDelete }: {
  slots: Row[];
  showBatch?: boolean;
  showFaculty?: boolean;
  onDelete?: (slot: Row) => void;
}) {
  if (slots.length === 0) return <Empty>No classes scheduled yet.</Empty>;
  const today = ((new Date().getDay() + 6) % 7) + 1;
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => slots.some((s) => s.dayOfWeek === d));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {days.map((d) => (
        <div key={d} className={`rounded-lg border bg-white p-4 shadow-sm ${d === today ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"}`}>
          <p className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900">
            {DAYS[d]}
            {d === today && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">Today</span>}
          </p>
          <ul className="divide-y divide-slate-100">
            {slots
              .filter((s) => s.dayOfWeek === d)
              .map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{s.subjectName}</p>
                    <p className="text-xs text-slate-500">
                      {fmtTime(s.startTime)} - {fmtTime(s.endTime)} · Room {s.room}
                      {showFaculty && ` · ${s.facultyName}`}
                      {showBatch && ` · ${s.batchName}`}
                    </p>
                  </div>
                  {onDelete && (
                    <button className="text-xs text-red-600 hover:underline" onClick={() => onDelete(s)}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
