import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDesign } from "./check";
import { PRESETS, presetById } from "./presets";

test("every preset lints clean and yields tokens", () => {
  for (const p of PRESETS) {
    const c = checkDesign(p.markdown);
    assert.equal(c.ok, true, p.id);
    assert.deepEqual(c.findings, [], p.id);
    assert.equal(c.name, p.name);
    assert.ok(c.colors.primary, p.id);
    assert.ok(c.fonts.heading && c.fonts.body, p.id);
    assert.match(c.rounded ?? "", /px$/, p.id);
  }
});

test("presetById", () => {
  assert.equal(presetById("paper")?.name, "Paper");
  assert.equal(presetById("nope"), null);
});

test("text without tokens warns but does not fail", () => {
  const c = checkDesign("hello");
  assert.equal(c.ok, true);
  assert.deepEqual(c.colors, {});
  assert.ok(c.findings.some((f) => f.severity === "warning"));
});

test("broken token reference is an error", () => {
  const c = checkDesign(`---\nname: X\ncolors:\n  primary: "#000000"\ncomponents:\n  button: { backgroundColor: "{colors.nope}" }\n---\n\n## Overview\nx\n`);
  assert.equal(c.ok, false);
});
