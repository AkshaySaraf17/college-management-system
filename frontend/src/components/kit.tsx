import { useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { ErrorText, SuccessText, Spinner } from "./ui";

// ---------- formatting ----------

export const money = (v: unknown) =>
  v === null || v === undefined || v === "" ? "-" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v));

export const fmtDate = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const fmtTime = (v: unknown) => (v ? String(v).slice(0, 5) : "-");

export const pct = (v: unknown) => (v === null || v === undefined ? "-" : `${Number(v).toFixed(1)}%`);

export const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ---------- layout primitives ----------

export function Notice({ error, success }: { error: string | null; success: string | null }) {
  if (!error && !success) return null;
  return (
    <div className="mb-3 space-y-2" role="status">
      <ErrorText message={error} />
      <SuccessText message={success} />
    </div>
  );
}

export function Loading({ what = "Loading" }: { what?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <Spinner /> {what}...
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">{children}</p>;
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const colors = { default: "text-slate-900", good: "text-green-700", warn: "text-amber-600", bad: "text-red-600" } as const;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${colors[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${props.className ?? ""}`}
    />
  );
}

export function Tabs({ tabs, initial }: { tabs: { id: string; label: string; content: ReactNode }[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              t.id === current.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current?.content}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  empty = "Nothing here yet.",
  rowKey,
  loading,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey?: (row: T, index: number) => string | number;
  loading?: boolean;
}) {
  if (loading) return <Loading />;
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : (row.id ?? i)} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-top ${c.className ?? ""}`}>
                  {c.render ? c.render(row) : (row[c.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal bar list, each value scaled against `max` (defaults to the largest value). */
export function Bars({ items, max, format = (v: number) => String(v), tone = "indigo" }: {
  items: { label: string; value: number | null }[];
  max?: number;
  format?: (v: number) => string;
  tone?: "indigo" | "green" | "amber";
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value ?? 0));
  const color = { indigo: "bg-indigo-500", green: "bg-green-500", amber: "bg-amber-500" }[tone];
  if (items.length === 0) return <Empty>No data yet.</Empty>;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="text-sm">
          <div className="mb-0.5 flex justify-between gap-2">
            <span className="truncate text-slate-700">{it.label}</span>
            <span className="shrink-0 font-medium text-slate-900">{it.value === null ? "-" : format(it.value)}</span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div className={`h-2 rounded ${color}`} style={{ width: `${Math.min(100, ((it.value ?? 0) / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const c = level === "HIGH" ? "bg-red-100 text-red-800" : level === "MEDIUM" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{level}</span>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  return message ? <ErrorText message={message} /> : null;
}

/** Prints just the element with class `print-area` (everything else is hidden by the print stylesheet in index.css). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 print:hidden">
      {label}
    </button>
  );
}
