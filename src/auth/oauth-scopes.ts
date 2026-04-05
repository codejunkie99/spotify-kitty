export function normalizeScopes(scope: string | undefined): Set<string> {
  return new Set(
    (scope ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .sort(),
  );
}

export function hasRequiredScopes(
  grantedScope: string | undefined,
  requiredScopes: readonly string[],
): boolean {
  const granted = normalizeScopes(grantedScope);
  return requiredScopes.every((scope) => granted.has(scope));
}
