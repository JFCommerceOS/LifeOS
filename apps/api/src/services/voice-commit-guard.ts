/** Sprint 12 — block silent strong commitments from noisy STT until review or explicit confirm. */
export const WEAK_TRANSCRIPT_CONFIDENCE = 0.55;

export function weakTranscriptNeedsReview(confidence: number): boolean {
  return confidence < WEAK_TRANSCRIPT_CONFIDENCE;
}
