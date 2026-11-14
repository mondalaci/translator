export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const normalized = lang.toLowerCase()
  const prefix = normalized.split('-')[0] ?? normalized
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalized) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix))
  )
}

/** Read a word or phrase aloud. Silently does nothing when unavailable. */
export function speak(text: string, lang: string): void {
  if (!canSpeak() || !text) return
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 600))
  utterance.lang = lang
  const voice = pickVoice(lang)
  if (voice) utterance.voice = voice
  utterance.rate = 0.98
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}
