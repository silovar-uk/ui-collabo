# UI ColLabo Next Phase Implementation

Updated: 2026-09-14

## Product contract

Keep the core flow unchanged:

`貼る → 囲う → 選ぶ → 渡す → 照合`

UI ColLabo remains local-first and does not embed AI inference. The next phase improves capture fidelity, handoff state and revision verification rather than turning the product into a generic task/comment tool.

## Implemented

- Compact multi-page navigation below 920px while keeping the desktop specimen rail.
- Workflow state derived from Board facts so a revision with a new or NG instruction can return to HANDOFF instead of staying stuck in VERIFY.
- Revision lineage grouping based on the existing `round.prevBoardId`; no Project schema migration yet.
- Bookmarklet capture contract records viewport width, viewport height and device pixel ratio.
- HTML intake uses the captured viewport width for iframe layout/media-query fidelity, with the legacy 1280×800 fallback when metadata is absent.
- Chromium Playwright smoke tests cover responsive overflow, multi-page navigation and captured HTML media queries.
- Revision screenshots can now be compared as visual-diff candidates. The browser downsamples both images, removes low-level pixel noise, groups changed cells into regions, and classifies each region as `expected` or `unexpected` according to overlap with carried instruction areas.
- Expected/unexpected regions are transient verification assistance only. They are not persisted and never set a Spot to OK/NG automatically; the user remains responsible for the final verification decision.
- Browser E2E covers one instructed image change and one uninstructed image change in the same revision.

## Visual diff contract

The visual diff engine lives in `src/lib/visualDiff.ts` and intentionally does not write into `Board`.

Input:

- previous revision image
- current revision image
- carried, unresolved Spot rectangles for the current page
- optional `targetRect` rectangles

Output:

- changed regions classified as `expected` or `unexpected`
- changed-pixel ratio
- image-dimension mismatch flag

The default algorithm uses a reduced-resolution canvas, color/alpha thresholding, cell aggregation and connected-region grouping. The result is a review aid, not proof that a requested correction is semantically correct.

## Compatibility

`SCHEMA` remains `ui-collabo/1`. `PageSource.capture` is optional, therefore existing saved libraries remain valid. Old HTML captures continue to use their existing `width`/`height` values and new raw HTML without metadata falls back to 1280×800.

No diff bitmap or visual-diff result is stored in IndexedDB, so this phase does not increase saved-library payload size.

## Deliberately deferred

- AssetStore split for large image/HTML payloads.
- Browser Extension capture transport.
- Formal Project / Instruction schemas.
- Persisted verification history for visual-diff regions.
- DOM/computed-style diff for HTML revisions.

Do not add new large data URLs directly to `Board`; the next storage migration should separate metadata from heavy assets.

## Next experiment

The next useful experiment is to make unexpected regions actionable without turning them into automatic errors: allow a user to convert one candidate region into a normal Spot, dismiss it for the current review, or mark it as an accepted side effect. That interaction should remain local UI state until the workflow proves valuable enough to justify a persisted verification schema.
