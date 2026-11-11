// <Word k="dead" /> renders both words; tokens.css shows the one for the current mode.
// Works in server components and paints the right word on first paint.
import { word, type CopyKey } from "./copy";

export function Word({ k, vars }: { k: CopyKey; vars?: Record<string, string | number> }) {
  return (
    <>
      <span className="rv-l">{word("light", k, vars)}</span>
      <span className="rv-h">{word("haunted", k, vars)}</span>
    </>
  );
}
