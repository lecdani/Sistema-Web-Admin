import type { Assignment } from '@/shared/types';
import type { User } from '@/shared/types';

function normId(v: string | undefined | null): string {
  return String(v ?? '').trim().toLowerCase();
}

/** Asignación pertenece al vendedor (por userId legacy o por salesRouteId del usuario). */
export function assignmentBelongsToUser(a: Assignment, user: User): boolean {
  if (a.userId != null && String(a.userId) === String(user.id)) return true;
  const routeId = String(user.salesRouteId ?? '').trim();
  if (routeId && a.salesRouteId && String(a.salesRouteId) === routeId) return true;
  return false;
}

/** Tienda ya asignada a otra ruta u otro vendedor (no a este usuario). */
export function storeAssignedToSomeoneElse(
  assignments: Assignment[],
  storeId: string,
  user: User
): boolean {
  const sid = String(storeId).trim();
  return assignments.some((a) => {
    if (String(a.storeId) !== sid) return false;
    return !assignmentBelongsToUser(a, user);
  });
}

/** Tienda ya enlazada a otra ruta (asignaciones actuales solo por routeId). */
export function storeAssignedToOtherRoute(
  assignments: Assignment[],
  storeId: string,
  currentRouteId: string
): boolean {
  const sid = normId(storeId);
  const rid = normId(currentRouteId);
  if (!sid || !rid) return false;
  return assignments.some((a) => {
    if (normId(a.storeId) !== sid) return false;
    const ar = normId(a.salesRouteId);
    return ar !== '' && ar !== rid;
  });
}

export function assignmentsForRoute(assignments: Assignment[], routeId: string): Assignment[] {
  const r = normId(routeId);
  return assignments.filter((a) => normId(a.salesRouteId) === r);
}
