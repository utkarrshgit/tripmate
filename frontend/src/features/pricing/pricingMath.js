/*
 * Exact totals mix live quotes with the plan's estimates: transport and stay
 * come from the price check (when available); food and activities stay estimated.
 */

export const cheapestIndex = (quotes) => (quotes?.length ? 0 : -1); // the API returns quotes sorted by price

export function exactTotal(plan, response, selection) {
  const est = plan.cost_breakdown ?? {};
  const transportQuote = response?.transport?.[selection.transport];
  const stayQuote = response?.stays?.[selection.stay];
  const parts = {
    transport: { value: transportQuote?.price ?? est.transport ?? 0, exact: Boolean(transportQuote) },
    hotel: { value: stayQuote?.price ?? est.hotel ?? 0, exact: Boolean(stayQuote) },
    food: { value: est.food ?? 0, exact: false },
    activities: { value: est.activities ?? 0, exact: false },
  };
  const total = Object.values(parts).reduce((sum, p) => sum + p.value, 0);
  return { parts, total };
}
