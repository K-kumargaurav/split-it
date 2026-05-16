import { revalidateTag } from "next/cache";

/**
 * Invalidates the cached dashboard data for one or more users.
 * Call this after any mutation that affects balances, expenses, or settlements.
 */
export function invalidateDashboard(...userIds: string[]): void {
  for (const id of userIds) {
    revalidateTag(`dashboard-${id}`);
  }
}
