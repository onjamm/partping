import { test } from "node:test";
import assert from "node:assert/strict";
import { searchRow52 } from "../src/row52.js";

// This is a stub until docs/row52-investigation.md is resolved (see README
// Status section). This test just locks in that it fails loudly and
// references where to look, rather than silently returning [] or hanging.
test("searchRow52 rejects with a message pointing at the investigation doc", async () => {
  await assert.rejects(
    () => searchRow52({ id: "e46-328i-prefacelift" }),
    /e46-328i-prefacelift.*row52-investigation\.md/s,
  );
});
