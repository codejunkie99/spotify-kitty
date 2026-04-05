export interface OffsetPage<T> {
  items: T[];
  total: number;
}

export async function collectOffsetPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<OffsetPage<T>>,
  limit: number,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  let total = Infinity;

  while (items.length < total) {
    const page = await fetchPage(offset, limit);
    total = page.total;
    if (page.items.length === 0) break;
    items.push(...page.items);
    offset += page.items.length;
  }

  return items;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error(`chunk size must be positive, received ${size}`);
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
