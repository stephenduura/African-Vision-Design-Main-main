export function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim();

  if (!trimmed || trimmed === "/" || trimmed === "./" || trimmed === ".") {
    return "";
  }

  return trimmed.replace(/\/+$/, "");
}

