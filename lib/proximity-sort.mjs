/** Sort display rows only. Missing scores stay last in either direction. */
export function sortProximity(rows, metric = 'score', direction = 'desc') {
  return [...rows].sort((a, b) => {
    const x = a[metric], y = b[metric];
    const missingX = x == null || !Number.isFinite(x);
    const missingY = y == null || !Number.isFinite(y);
    if (missingX || missingY) return missingX === missingY ? a.id - b.id : missingX ? 1 : -1;
    return (direction === 'asc' ? x - y : y - x) || a.id - b.id;
  });
}
