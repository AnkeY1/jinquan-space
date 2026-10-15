export type Visibility = 'draft' | 'preview' | 'public';
export function getVisibleContent<T extends { data: { visibility: Visibility } }>(
  items: T[],
  mode: 'preview' | 'public' = __SITE_MODE__,
): T[] {
  return items.filter(
    ({ data }) =>
      data.visibility === 'public' || (mode === 'preview' && data.visibility === 'preview'),
  );
}
