const ARABIC_LETTER = /[\u0600-\u06FF]/;

/** Capitalize Latin word starts without altering Arabic names. */
export function capitalizePersonName(value: string): string {
  if (!value || ARABIC_LETTER.test(value)) return value;
  return value.replace(/(^|[^\p{L}\p{M}])(\p{L})/gu, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}
