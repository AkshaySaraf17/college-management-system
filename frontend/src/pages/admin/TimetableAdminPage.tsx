import { useState } from "react";
import { api, type Row } from "../../api/client";
import { useBatches, useBatchSubjects } from "../../hooks/useCatalog";
import { useGet, useNotice } from "../../hooks/useLoad";
import { Card, Field, PageHeader, Select } from "../../components/ui";
import { DAYS, Empty, Notice } from "../../components/kit";
import { FormCard } from "../../components/FormCard";
import { TimetableGrid } from "../../components/TimetableGrid";

export function TimetableAdminPage() {
  const batches = useBatches();
  const [batchId, setBatchId] = useState("");
  const subjects = useBatchSubjects(batchId);
  const faculty = useGet<Row[]>("/faculty");
  const slots = useGet<Row[]>(batchId ? `/timetable?batchId=${batchId}` : null);
  const n = useNotice();
  const year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  return (
    <div>
      <PageHeader title="Timetable setup" subtitle="Build the weekly schedule. Clashes for the same faculty, batch or room are rejected automatically." />
      <Card className="mb-6 max-w-md">
        <Field label="Batch">
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batches.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </Card>
      {!batchId ? <Empty>Choose a batch to view and edit its timetable.</Empty> : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Notice error={n.error} success={n.success} />
            <TimetableGrid slots={slots.data ?? []} onDelete={(s) => n.run(() => api.delete(`/timetable/${s.id}`), "Slot removed.", slots.reload)} />
          </div>
          <FormCard title="Add a class" busy={n.busy} submitLabel="Add to timetable" key={batchId}
            fields={[
              { name: "subjectId", label: "Subject", type: "select", required: true, options: subjects.options },
              { name: "facultyId", label: "Faculty", type: "select", required: true, options: (faculty.data ?? []).map((f) => ({ value: f.id, label: `${f.fullName} (${f.employeeCode})` })) },
              { name: "dayOfWeek", label: "Day", type: "select", required: true, options: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: DAYS[d] })) },
              { name: "startTime", label: "Start", type: "time", required: true }, { name: "endTime", label: "End", type: "time", required: true },
              { name: "room", label: "Room", required: true }, { name: "academicYear", label: "Academic year", required: true, defaultValue: year },
            ]}
            onSubmit={(v) => n.run(() => api.post("/timetable", { ...v, batchId: Number(batchId), startTime: `${v.startTime}:00`.slice(0, 8), endTime: `${v.endTime}:00`.slice(0, 8) }), "Class added.", slots.reload)} />
        </div>
      )}
    </div>
  );
}
