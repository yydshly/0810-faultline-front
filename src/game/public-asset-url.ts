export function resolvePublicAssetUrl(baseUrl: string, assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '');
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');

  if (!normalizedBase) return `/${normalizedPath}`;
  return `${normalizedBase}/${normalizedPath}`;
}
