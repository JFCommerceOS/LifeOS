/** Sprint 12 — lightweight cleanup; original transcript stays in `transcriptOriginal`. */
export function normalizeTranscriptText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
