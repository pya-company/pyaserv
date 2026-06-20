/*
 * Pre-translation glossary protection.
 *
 * m2m100 (and most general-purpose MT models) routinely mangle proper nouns
 * the model hasn't seen at scale: "Asunción" → "Newcastle upon Tyne",
 * "Villa Morra" → "Morra Town", "Loma Pytã" → "Pytã Hill". We protect
 * known terms by swapping each occurrence with a sentinel token that the
 * model leaves alone (digit-only tags survive both m2m100 and Gemma intact),
 * then restore the original string after translation.
 *
 * The list lives here in the API (not in @pya-company/shared) because the
 * glossary is product-specific — pyaserv is Paraguay-only. PyaEats would
 * ship its own copy.
 *
 * Pure functions; unit-tested.
 */

// Paraguayan place names + brand names + Paraguay-Spanish vocabulary the
// model gets wrong. Order matters: LONGER terms first so "San Lorenzo" wins
// over "San". The sorter in buildGlossary enforces this — keep the source
// list human-readable.
const PROTECTED_TERMS: ReadonlyArray<string> = [
  // Brands
  'PyaServ',
  'PyaEats',
  // Cities + departments
  'Asunción',
  'Areguá',
  'Capiatá',
  'Encarnación',
  'Fernando de la Mora',
  'Itauguá',
  'Lambaré',
  'Luque',
  'Mariscal Estigarribia',
  'Ñemby',
  'San Lorenzo',
  // Asunción barrios (subset of BARRIOS that's at risk)
  'Barrio Obrero',
  'Barrio San Pablo',
  'Bañado Norte',
  'Bañado Sur',
  'Botánico',
  'Carmelitas',
  'Catedral',
  'Hipódromo',
  'Itá Enramada',
  'Las Carmelitas',
  'Las Mercedes',
  'Loma Pytã',
  'Mariscal López',
  'Mburicaó',
  'Mburucuyá',
  'Mcal. López',
  'Pinozá',
  'Recoleta',
  'Sajonia',
  'San Antonio',
  'San Pablo',
  'San Roque',
  'San Vicente',
  'Tablada Nueva',
  'Tembetary',
  'Trinidad',
  'Vista Alegre',
  'Villa Aurelia',
  'Villa Morra',
  // Paraguay-Spanish vocab the model sometimes Anglicises wrong
  'Guaraní',
  'guaraníes',
]

interface Token {
  readonly placeholder: string
  readonly original: string
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Replace every protected term with a sentinel token. Returns the masked
 * text + a `restore(translated)` function that puts the originals back.
 *
 * Sentinel format `⟦GP_N⟧` uses double-bracket characters (Unicode "Mathematical
 * Left/Right White Square Bracket") because m2m100 reliably leaves them alone
 * in both ES and EN. Inner N is a small integer rather than the original term
 * so the model can't "translate the placeholder".
 */
export const protectTerms = (text: string): { masked: string; restore: (t: string) => string } => {
  // Sort longest-first so "San Lorenzo" matches before "San".
  const sorted = [...PROTECTED_TERMS].sort((a, b) => b.length - a.length)
  const tokens: Token[] = []
  let masked = text
  for (const term of sorted) {
    // Case-insensitive, but preserve case via a back-reference.
    const re = new RegExp(escapeRegex(term), 'gi')
    masked = masked.replace(re, (matched) => {
      const placeholder = `⟦GP_${tokens.length}⟧`
      tokens.push({ placeholder, original: matched })
      return placeholder
    })
  }
  const restore = (t: string): string => {
    let out = t
    for (const tok of tokens) {
      // Tolerant restore: match BOTH the bracketed form (model preserved
      // everything) AND the unbracketed inner core (model stripped the
      // ⟦⟧ unicode brackets but kept `GP_N` intact, which m2m100 does in
      // practice). Sorted longest-first so GP_10 doesn't get partially
      // matched by GP_1's restore pass.
      const inner = tok.placeholder.replace(/^⟦|⟧$/g, '')
      // Trailing \b prevents GP_1 from matching inside GP_10. The bracketed
      // form is already self-delimiting, the inner form isn't.
      const reTok = new RegExp(
        `(?:${escapeRegex(tok.placeholder)}|${escapeRegex(inner)}\\b)`,
        'g',
      )
      out = out.replace(reTok, tok.original)
    }
    return out
  }
  return { masked, restore }
}
