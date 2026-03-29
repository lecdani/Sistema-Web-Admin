import type { Assignment } from '@/shared/types';
import type { User } from '@/shared/types';

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
  const sid = String(storeId).trim();
  const rid = String(currentRouteId).trim();
  if (!sid || !rid) return false;
  return assignments.some((a) => {
    if (String(a.storeId) !== sid) return false;
    const ar = String(a.salesRouteId ?? '').trim();
    return ar !== '' && ar !== rid;
  });
}

export function assignmentsForRoute(assignments: Assignment[], routeId: string): Assignment[] {
  const r = String(routeId).trim();
  return assignments.filter((a) => String(a.salesRouteId ?? '').trim() === r);
}
