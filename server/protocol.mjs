// The version of the rules two screens must agree on. Both screens work out arenas, hazards and parcels from the same
// seed with no server field, so a tab left open from an older build would see different cover and events from its
// opponent. Raise this by hand whenever a deploy changes those rules or the messages: the hub then tells older tabs to
// reload (hub.mjs, `register`, `login` and `resume` carry `v`). Read by the hub and by src/net/client.ts.
export const PROTOCOL = 1;

/** What an older tab is told. */
export const RELOAD_TEXT = 'A new version is out: reload the page';
