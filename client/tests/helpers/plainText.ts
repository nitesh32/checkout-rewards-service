const NON_BREAKING_SPACE = new RegExp(String.fromCharCode(0xa0), 'g');

/** Intl formatting uses non-breaking spaces; swap them so assertions read as plain text. */
export function plainText(text: string): string {
  return text.replace(NON_BREAKING_SPACE, ' ');
}
