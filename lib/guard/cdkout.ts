// Reads the synthesized templates from a cdk.out directory (.amplify/artifacts/cdk.out).
// Templates sit in the root and in nested cloud assemblies (assembly-*/). asset.* folders hold
// bundled code, never templates, so only the root and assembly-* folders are read.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Stacks, Template } from "./types";

export function readCdkOut(dir: string): Stacks {
  const out: Stacks = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (name.endsWith(".template.json")) {
        out[relative(dir, p)] = JSON.parse(readFileSync(p, "utf8")) as Template;
      } else if (name.startsWith("assembly-") && statSync(p).isDirectory()) {
        walk(p);
      }
    }
  };
  walk(dir);
  return out;
}
