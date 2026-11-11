// Haunted effects for Revenant (Requirement 12.4, 12.9-12.12). Reference: design/mockups/live.html
// and design/mockups/haunt.js. Everything is a no-op when data-mode is light, data-calm is on,
// or prefers-reduced-motion is set; the Heartbeat draws in both themes.
//
//   <HauntLayer/>                 once in the shell; mark the active area with data-haunt-focus
//   const { die, rise, thunder } = useHaunt();
//   await die(); appendLog(failureLine);   // silence, delay, strike, silhouette, moved, breath
//   rise();                                // blood dries, the tombstone returns, far thunder
//   <Heartbeat state="alive" />   <Tombstone title="here lies deploy #14" number="#14" code="CREATE_FAILED" />
//
// CSS helpers (Haunted Full only): rv-glitch and rv-bleed on the state word when it dies,
// rv-risen when it rises, rv-bloom on the vitals bar for the light bloom.
export { HauntLayer, useHaunt } from "./layer";
export { Heartbeat, type Pulse } from "./heartbeat";
export { Tombstone } from "./tombstone";
export { bake, type Strike } from "./sound";
export { strikes } from "./engine";
