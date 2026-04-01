/**
 * Sprint 12 — provider-agnostic STT hook. Replace with real provider routing (language-stack) when wired.
 * Returns low confidence so weak-transcript review is exercised until a model is configured.
 */
export async function transcribeAudioBuffer(
  _userId: string,
  buf: Buffer,
  _mimeType: string | undefined,
  languageTag?: string,
): Promise<{ text: string; confidence: number; languageGuess: string | null }> {
  void _mimeType;
  if (!buf.length) {
    return { text: '', confidence: 0, languageGuess: languageTag ?? null };
  }
  return {
    text: 'Stub transcription — configure speech-to-text in the language provider registry. Edit this text or paste a transcript, then confirm.',
    confidence: 0.38,
    languageGuess: languageTag ?? 'en',
  };
}
