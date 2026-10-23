import { useState, type FormEvent } from "react";
import { Button, Card, Field, Input, Select } from "./ui";
import { Textarea } from "./kit";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "email" | "select" | "textarea" | "checkbox" | "password";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  step?: string;
  min?: number;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  span?: 1 | 2;
}

type Values = Record<string, any>;

function initial(fields: FieldDef[]): Values {
  return Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === "checkbox" ? false : "")]));
}

/** Declarative form: numbers become numbers, blank optional fields are omitted, and it resets after a successful submit. */
export function FormCard({
  title,
  fields,
  onSubmit,
  submitLabel = "Save",
  busy,
  columns = 1,
  plain,
}: {
  title?: string;
  fields: FieldDef[];
  onSubmit: (values: Values) => Promise<unknown>;
  submitLabel?: string;
  busy?: boolean;
  columns?: 1 | 2;
  plain?: boolean;
}) {
  const [values, setValues] = useState<Values>(() => initial(fields));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body: Values = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === "checkbox") body[f.name] = !!v;
      else if (v === "" || v === undefined) continue;
      else if (f.type === "number" || (f.type === "select" && f.options?.every((o) => typeof o.value === "number"))) body[f.name] = Number(v);
      else body[f.name] = v;
    }
    const result = await onSubmit(body);
    if (result !== undefined) setValues(initial(fields));
  }

  const set = (name: string, v: any) => setValues((s) => ({ ...s, [name]: v }));

  const form = (
    <form onSubmit={handleSubmit} className={`grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {fields.map((f) => (
        <div key={f.name} className={f.span === 2 ? "sm:col-span-2" : ""}>
          {f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
              {f.label}
            </label>
          ) : (
            <Field label={f.label + (f.required ? " *" : "")}>
              {f.type === "select" ? (
                <Select required={f.required} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">{f.placeholder ?? "Select..."}</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea rows={3} required={f.required} placeholder={f.placeholder} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <Input
                  type={f.type ?? "text"}
                  required={f.required}
                  step={f.step}
                  min={f.min}
                  placeholder={f.placeholder}
                  value={values[f.name]}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </Field>
          )}
        </div>
      ))}
      <div className={columns === 2 ? "sm:col-span-2" : ""}>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );

  if (plain) return form;
  return (
    <Card>
      {title && <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>}
      {form}
    </Card>
  );
}
