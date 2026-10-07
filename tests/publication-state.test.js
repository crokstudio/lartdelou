import assert from "node:assert/strict";
import { test } from "node:test";
import { describeHiddenArtwork, getPublicationState } from "../src/admin/publication-state.js";

test("publication is current only when the deployed revision matches the saved revision", () => {
  assert.equal(getPublicationState({ snapshot: { revision: "published" }, latestRevision: "published" }).state, "current");
  assert.equal(getPublicationState({ snapshot: { revision: "old" }, latestRevision: "saved" }).state, "pending");
});
test("missing verification data never claims successful publication", () => {
  for (const input of [{}, { snapshot: {} }, { snapshot: { revision: "saved" } }, { latestRevision: "saved" }]) {
    assert.equal(getPublicationState(input).state, "unknown");
  }
});
test("a long wait is described as a delay, not an unverified deployment failure", () => {
  assert.equal(getPublicationState({ snapshot: { revision: "old" }, latestRevision: "saved", waitingSince: 0, now: 300001 }).state, "pending");
  const state = getPublicationState({ snapshot: { revision: "old" }, latestRevision: "saved", waitingSince: 0, now: 480001 });
  assert.equal(state.state, "delayed");
  assert.doesNotMatch(state.message, /échec/i);
});
test("hidden artwork warnings survive a pending deployment", () => {
  const hidden = [{ title: "Syléa", reason: "no-image" }];
  const state = getPublicationState({ snapshot: { revision: "old", hidden }, latestRevision: "saved" });
  assert.deepEqual(state.hidden, hidden);
  assert.equal(describeHiddenArtwork(hidden[0]), "Syléa — photo à ajouter");
  assert.match(describeHiddenArtwork({ title: "Sonéa", reason: "unavailable-image" }), /photo à remplacer/);
});
