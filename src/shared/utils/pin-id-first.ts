/** Normaliza id para comparar GUID u otros strings sin depender de mayúsculas. */
export function normalizeListId(v: string | undefined | null): string {
  return String(v ?? '').trim().toLowerCase();
}

/**
 * Mueve el elemento cuyo `id` coincide con `prioritizeId` al inicio de la lista.
 * No elimina filas; solo reordena para que el usuario vea primero lo que acaba de tocar.
 *
 * En el admin, tras crear o editar en tablas (usuarios, tiendas, productos, pedidos, rutas, etc.),
 * suele llamarse sobre el resultado de `fetchAll` antes de hacer `setState`.
 */
export function pinIdFirst<T extends { id: string }>(list: T[], prioritizeId?: string | null): T[] {
  if (prioritizeId == null || String(prioritizeId).trim() === '') return list;
  const target = normalizeListId(prioritizeId);
  const i = list.findIndex((x) => normalizeListId(x.id) === target);
  if (i <= 0) return list;
  const copy = [...list];
  const [row] = copy.splice(i, 1);
  return [row, ...copy];
}
