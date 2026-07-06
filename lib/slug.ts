/**
 * Mirrors backend domain.Slugify for live preview in the editor.
 * Lowercase, runs of non-alphanumerics collapse to a single dash,
 * leading/trailing dashes trimmed. Backend reapplies on save.
 */
export function Slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
