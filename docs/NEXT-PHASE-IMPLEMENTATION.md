# UI ColLabo Next Phase Implementation

Updated: 2026-09-14

## Product contract

Keep the core flow unchanged:

`貼る → 囲う → 選ぶ → 渡す → 照合`

UI ColLabo remains local-first and does not embed AI inference. The next phase improves capture fidelity, handoff state and revision verification rather than turning the product into a generic task/comment tool.

## Implemented in this phase

- Compact multi-page navigation below 920px while keeping the desktop specimen rail.
- Workflow state derived from Board facts so a revision with a new or NG instruction can return to HANDOFF instead of staying stuck in VERIFY.
- Revision lineage grouping based on the existing `round.prevBoardId`; no Project schema migration yet.
- Bookmarklet capture contract now records viewport width, viewport height and device pixel ratio.
- HTML intake uses the captured viewport width for iframe layout/media-query fidelity, with the legacy 1280×800 fallback when metadata is absent.
- Chromium Playwright smoke tests for responsive overflow, multi-page navigation and captured HTML media queries.

## Compatibility

`SCHEMA` remains `ui-collabo/1`. `PageSource.capture` is optional, therefore existing saved libraries remain valid. Old HTML captures continue to use their existing `width`/`height` values and new raw HTML without metadata falls back to 1280×800.

## Deliberately deferred

- AssetStore split for large image/HTML payloads.
- Expected/unexpected visual diff.
- Browser Extension capture transport.
- Formal Project / Instruction schemas.

Do not add new large data URLs directly to `Board`; the next storage migration should separate metadata from heavy assets.

## Next experiment

The preferred next product experiment is Expected / Unexpected Change: verify not only that requested regions changed, but that unrelated regions did not change. This strengthens the final `照合` stage without changing the core workflow.
