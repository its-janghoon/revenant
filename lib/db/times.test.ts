import assert from "node:assert/strict";
import { test } from "node:test";
import { dataApiTime } from "./times";

test("timestamps go to the Data API as YYYY-MM-DD HH:MM:SS", () => {
  assert.equal(dataApiTime("2026-11-01"), "2026-11-01 00:00:00");
  assert.equal(dataApiTime("2026-11-11T14:00:00.000Z"), "2026-11-11 14:00:00.000");
  assert.equal(dataApiTime("2026-11-11T23:30:00+09:00"), "2026-11-11 14:30:00.000");
  assert.equal(dataApiTime("2026-11-11 14:00:00"), "2026-11-11 14:00:00");
});
