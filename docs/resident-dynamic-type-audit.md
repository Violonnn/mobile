# Resident Dynamic Type Audit

## Baseline record

This record starts the resident dynamic-type rollout described in
`resident-dynamic-type-implementation-plan.md`. The static audit was completed
on 2026-09-25. Device screenshots and the real-device matrix remain release
validation work because native font metrics cannot be verified from source code.

| Resident area | High-risk surface | Unsafe pattern found | Responsive behavior | Status |
| --- | --- | --- | --- | --- |
| Shared navigation | Bottom navigation | Fixed-height compact chrome and labels removed in the current working copy | Labels restored; bar now grows for wrapped scaled text | Code updated — device validation pending |
| Shared sheets | Resident bottom sheets and report modal | Content can outgrow a constrained sheet or keyboard viewport | Existing scroll-safe sheets retained; report controls no longer require fixed text rows | Code updated — device validation pending |
| Report flow | Incident choices, form fields, validation, review, picker | Fixed option heights and horizontal action rows assume a single text line | Stack or wrap controls at large text; preserve touch targets | Code updated — device validation pending |
| Home | Quick-access cards and reminder cards | Three-column card row and fixed card content assume short text | Stack quick actions and allow card copy to grow | Code updated — device validation pending |
| Community feed | Report and announcement cards, comments, filters | One-line titles and fixed card layouts require verification | Wrap meaningful copy and retain flexible text columns | Code updated — device validation pending |
| Resident map | Search, callouts, report/resource sheets | Fixed overlay rows and metadata grid can constrain long content | Use wrapping and stacked metadata | Code updated — device validation pending |
| Profile and authentication | Account rows, modal actions, validation | Long names and validation copy may be line-limited | Wrap names, flexible headers, and content-driven carousel cards | Code updated — device validation pending |
| Notifications | Notification rows and swipe actions | Action labels compete for narrow horizontal space | Existing flexible rows retained; device test required | Device validation pending |

## Verification matrix

For every completed batch, test the affected screen on Android and iOS at the
default, large, and maximum system text settings with long realistic values.
Also test a visible validation error, keyboard-open form state, a short-height
or landscape viewport, and screen-reader focus order. Record the device, OS,
text setting, and any screenshot in the pull request or release record.

## Review rule

New resident text must not add `allowFontScaling={false}`, a low
`maxFontSizeMultiplier`, essential `numberOfLines`, or a fixed text-container
height without an accessibility review explaining why the content remains
available.

## Implementation record

- Shared resident navigation keeps visible labels and calculates an expanded
  bar height from the system font scale. Home, Feed, Profile, and Map reserve
  the same dynamic bottom space so actions are not covered.
- Resident report controls, review rows, home cards, feed cards/comments, map
  callouts, and authentication safety cards now wrap or use a large-text
  stacked layout instead of clipping meaningful text.
- `npm.cmd run typecheck`, `npm.cmd run lint`, and `git diff --check` passed on
  2026-09-25. No real Android or iOS device was available in this workspace,
  so the verification matrix above is still a release requirement.
