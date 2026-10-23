import type { Row } from "../api/client";
import { useGet } from "./useLoad";

export function useBatches() {
  const g = useGet<Row[]>("/catalog/batches");
  const options = (g.data ?? []).map((b) => ({ value: b.id as number, label: `${b.courseCode} · ${b.name}` }));
  return { ...g, options };
}

export function useBatchSubjects(batchId: string | number | null | undefined) {
  const g = useGet<Row[]>(batchId ? `/catalog/batches/${batchId}/subjects` : null);
  const options = (g.data ?? []).map((s) => ({ value: s.id as number, label: `${s.name} (${s.code})` }));
  return { ...g, options };
}

export function useTeaching() {
  return useGet<Row[]>("/catalog/teaching");
}
