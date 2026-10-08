const rupeeFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function rupees(value) {
  return `₹${rupeeFormatter.format(Math.round(Number(value) || 0))}`;
}

export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
