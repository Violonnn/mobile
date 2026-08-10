/** Max length for a single name field. Mirrors MAX_NAME_LENGTH on the server. */
export const MAX_NAME_LENGTH = 100;

// Allow letters (including common accented Latin characters), spaces, hyphens,
// apostrophes, and periods so real names like "Dela Cruz", "O'Brien", and
// "Jr." pass, while rejecting digits and other symbols. The first character
// must be a letter. Mirror this rule in supabase/functions/_shared/validation.ts.
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;

/** True when the value is a plausible human name (letters/spaces/-/'/. only). */
export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  return NAME_PATTERN.test(trimmed);
}

/**
 * Store each part of a person's name with an initial capital letter.
 * Separators are preserved so names such as "O'Brien" and "Anne-Marie"
 * remain readable and correctly formatted.
 */
export function normalizeName(value: string): string {
  return value
    .trim()
    .split(/([ .'-]+)/)
    .map((part) => {
      if (!part || /^[ .'-]+$/.test(part)) return part;
      return `${part.charAt(0).toLocaleUpperCase()}${part.slice(1).toLocaleLowerCase()}`;
    })
    .join('');
}
