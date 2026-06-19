/*
 * User-content translation via CF Workers AI (m2m100-1.2b).
 *
 * Calls cost ~0 within the Workers AI free tier (10k Neurons/day). For our
 * marketplace volume (a few dozen writes a day) we never approach the cap.
 * If the call fails for any reason (rate limit, model timeout) we fall back
 * to the source text — the column gets the same value as the source-locale
 * column, so the dual-render still shows something readable.
 *
 * Pure helper; no DB access. Caller decides what to do with the result.
 */

type SupportedLocale = 'es' | 'en'

interface TranslationPair {
  readonly es: string
  readonly en: string
}

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

const MODEL = '@cf/meta/m2m100-1.2b'

const ai = (env: unknown): AiBinding | undefined => {
  const e = env as { AI?: AiBinding }
  return e.AI
}

const translateOne = async (
  binding: AiBinding,
  text: string,
  source: SupportedLocale,
  target: SupportedLocale,
): Promise<string> => {
  if (text.trim().length === 0) return text
  try {
    const out = (await binding.run(MODEL, {
      text,
      source_lang: source,
      target_lang: target,
    })) as { translated_text?: string }
    return out.translated_text?.trim() || text
  } catch {
    // Best-effort: returning source text keeps the dual-render usable.
    return text
  }
}

/**
 * Given source text and the locale it was authored in, return both
 * the ES and EN copies. The source-locale slot is the literal input;
 * the other-locale slot is the model output.
 */
export const translatePair = async (
  env: unknown,
  source: SupportedLocale,
  text: string,
): Promise<TranslationPair> => {
  const binding = ai(env)
  if (!binding) {
    // No AI binding configured (e.g. local dev without Workers AI). Mirror
    // the source into both columns so the schema invariant (both filled) holds.
    return { es: source === 'es' ? text : text, en: source === 'en' ? text : text }
  }
  const target: SupportedLocale = source === 'es' ? 'en' : 'es'
  const translated = await translateOne(binding, text, source, target)
  return source === 'es' ? { es: text, en: translated } : { es: translated, en: text }
}
