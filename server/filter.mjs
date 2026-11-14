// The clan chat's word filter: a short list of slurs, kept on the server only (never in protocol.mjs, which the page bundles). A
// listed word is replaced by *** wherever it stands as a word of its own, in any case, plural, and with the usual digits or signs
// for its letters (n1gg3r). It is a simple filter, not a moderator: the Report button and the mutes are the rest of it. Clan names
// and tags go through it too, and one it changes is refused.

/** The listed words, in their plain spelling. Keep it short: slurs, not swearing. */
export const WORDS = [
  'nigger', 'nigga', 'faggot', 'fag', 'kike', 'spic', 'chink', 'wetback', 'tranny', 'retard', 'gook', 'dyke', 'coon', 'raghead',
];

/** What each letter may be written as. */
const LOOKS = /** @type {Record<string, string>} */ ({ a: 'a@4', e: 'e3', i: 'i1!|', o: 'o0', s: 's$5', g: 'g9', t: 't7+' });

/** One word as a pattern: each letter in any of its looks, a letter doubled or not, a plural `s` or `z` at the end. @param {string} w */
const pattern = (w) => [...w].map((ch) => `[${(LOOKS[ch] ?? ch).replace(/[\]\\^-]/g, '\\$&')}]+`).join('') + '(?:[sz$5]|e[sz])?';

const RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${WORDS.map(pattern).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

/** The text with every listed word replaced by ***. @param {string} text */
export const clean = (text) => text.replace(RE, '***');

/** Whether the text holds a listed word. @param {string} text */
export const dirty = (text) => clean(text) !== text;
