export function blogAuthorName(author: unknown): string {
  if (typeof author === "string" && author.trim()) return author;
  if (author && typeof author === "object" && "full_name" in author) {
    const name = (author as { full_name?: string | null }).full_name;
    if (name) return name;
  }
  return "LUXE Editorial";
}

export function blogReadingTime(content?: string | null): number | null {
  if (!content?.trim()) return null;
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

export function formatBlogDate(iso?: string | null, month: "short" | "long" = "short"): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month, day: "numeric", year: "numeric" });
}
