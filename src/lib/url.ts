export function normalizeBase(base: string): string {
  if (!/^\/[A-Za-z0-9/_-]*\/?$/.test(base) || base.includes('//') || base.includes('..'))
    throw new Error('无效站点路径');
  const parts = base.split('/').filter(Boolean);
  return parts.length ? `/${parts.join('/')}/` : '/';
}
export function withBase(path: string, base = import.meta.env.BASE_URL || '/'): string {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    /[?#]/.test(path) ||
    path.split('/').includes('..')
  )
    throw new Error('withBase 只接受逻辑站内路径');
  return normalizeBase(base) + path.slice(1);
}
export function toAbsoluteSiteUrl(
  path: string,
  origin = import.meta.env.SITE || '',
  base = import.meta.env.BASE_URL || '/',
): string | null {
  return origin ? new URL(withBase(path, base), origin).href : null;
}
export function isAllowedExternalUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}
