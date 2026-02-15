export function getPathBasename(path: string): string {
    if (!path) return '';
    const parts = path.split(/[/\\]/).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : path;
  }
  