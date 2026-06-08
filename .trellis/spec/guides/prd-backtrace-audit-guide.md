# PRD Backtrace Audit Guide

Use this guide before claiming Bytedance/P0/P1 completion or when the user suspects historical tests missed product gaps.

## Checklist

- Start from `bytedance_init_prd.md`, then `bytedance_init_video_txt.txt`, then current user decisions.
- Map each claimed feature to a concrete user-visible route, API/DB state, and test evidence.
- Find both missing required features and stale/ghost UI that should be deleted or downgraded.
- Reject evidence that only proves file existence, selector visibility, historical screenshots, or mocked routes.
- If a behavior is product scope or acceptance wording, put it in `research/` contracts/PRD/tracker. If it is executable implementation boundary, put it in `.trellis/spec`.

## Output Shape

| Field | Required content |
| --- | --- |
| Source | PRD/video/user decision path |
| Claim | Feature currently marked complete |
| Evidence | Fresh UI/API/DB/runtime proof |
| Gap | Missing, stale, partial, blocked, or passed |
| Destination | code-spec, research contract, tracker, or delete |

## Stop Conditions

- A P0/P1 claim lacks a fresh user-path test.
- A completed report conflicts with current code/API/DB behavior.
- A spec contains product narrative that belongs in `research/`.
- A PRD/tracker item is complete/obsolete and still drives implementation.
