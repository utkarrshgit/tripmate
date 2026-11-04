/* Admin-only reads through /api/v1/admin. */
import { call } from "./authApi";

/** How the local models performed over the last `days`: totals, per agent and model, and recent runs. */
export async function aiActivity(days = 7) {
  return (await call("GET", `/admin/ai-activity?days=${days}`)).data;
}
