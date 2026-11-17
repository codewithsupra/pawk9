export const SITE_NAME = "PawK9";

/**
 * Where people can write about privacy or their account (CONTACT_EMAIL in the
 * environment). Null when it isn't set, and the legal pages then leave the line out
 * rather than showing a wrong address.
 */
export const contactEmail = () => process.env.CONTACT_EMAIL ?? null;

/** Shown on the legal pages. Change it whenever the text of either page changes. */
export const LEGAL_UPDATED = "November 18, 2026";
