/** Languages offered in the phone UI. `speech` is the BCP-47 tag for the speech API. */
export interface Language {
  code: string
  name: string
  native: string
  speech: string
}

export const LANGUAGES: Language[] = [
  { code: 'hu', name: 'Hungarian', native: 'magyar', speech: 'hu-HU' },
  { code: 'en', name: 'English', native: 'English', speech: 'en-US' },
  { code: 'de', name: 'German', native: 'Deutsch', speech: 'de-DE' },
  { code: 'fr', name: 'French', native: 'français', speech: 'fr-FR' },
  { code: 'es', name: 'Spanish', native: 'español', speech: 'es-ES' },
  { code: 'it', name: 'Italian', native: 'italiano', speech: 'it-IT' },
  { code: 'pt', name: 'Portuguese', native: 'português', speech: 'pt-PT' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', speech: 'nl-NL' },
  { code: 'pl', name: 'Polish', native: 'polski', speech: 'pl-PL' },
  { code: 'cs', name: 'Czech', native: 'čeština', speech: 'cs-CZ' },
  { code: 'sk', name: 'Slovak', native: 'slovenčina', speech: 'sk-SK' },
  { code: 'ro', name: 'Romanian', native: 'română', speech: 'ro-RO' },
  { code: 'hr', name: 'Croatian', native: 'hrvatski', speech: 'hr-HR' },
  { code: 'sr', name: 'Serbian', native: 'srpski', speech: 'sr-RS' },
  { code: 'sl', name: 'Slovenian', native: 'slovenščina', speech: 'sl-SI' },
  { code: 'ru', name: 'Russian', native: 'русский', speech: 'ru-RU' },
  { code: 'uk', name: 'Ukrainian', native: 'українська', speech: 'uk-UA' },
  { code: 'bg', name: 'Bulgarian', native: 'български', speech: 'bg-BG' },
  { code: 'el', name: 'Greek', native: 'ελληνικά', speech: 'el-GR' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', speech: 'tr-TR' },
  { code: 'sv', name: 'Swedish', native: 'svenska', speech: 'sv-SE' },
  { code: 'no', name: 'Norwegian', native: 'norsk', speech: 'nb-NO' },
  { code: 'da', name: 'Danish', native: 'dansk', speech: 'da-DK' },
  { code: 'fi', name: 'Finnish', native: 'suomi', speech: 'fi-FI' },
  { code: 'et', name: 'Estonian', native: 'eesti', speech: 'et-EE' },
  { code: 'he', name: 'Hebrew', native: 'עברית', speech: 'he-IL' },
  { code: 'ar', name: 'Arabic', native: 'العربية', speech: 'ar-SA' },
  { code: 'fa', name: 'Persian', native: 'فارسی', speech: 'fa-IR' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN' },
  { code: 'ja', name: 'Japanese', native: '日本語', speech: 'ja-JP' },
  { code: 'ko', name: 'Korean', native: '한국어', speech: 'ko-KR' },
  { code: 'zh', name: 'Chinese', native: '中文', speech: 'zh-CN' },
  { code: 'th', name: 'Thai', native: 'ไทย', speech: 'th-TH' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', speech: 'vi-VN' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', speech: 'id-ID' },
]

export const DEFAULT_LANGUAGE = 'hu'

export function languageByCode(code: string): Language {
  const fallback = LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE)!
  return LANGUAGES.find((language) => language.code === code) ?? fallback
}

