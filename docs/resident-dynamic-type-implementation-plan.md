# Resident Dynamic Type Implementation Plan

- Status: Implemented in code on 2026-09-25; real-device maximum-text validation remains required before release
- Scope: Resident-facing mobile experience only
- Purpose: Make all resident text usable at the device's selected text size without vertical clipping, horizontal clipping, overlap, inaccessible controls, or hidden actions

## 1. Problem statement

Dynamic Type (iOS) and Android Font Size increase the rendered size of `Text`, but they do not automatically resize the surrounding layout correctly. A screen can look correct at its design font size yet fail when the user selects a larger device text size.

The reported symptoms have different immediate causes:

| Symptom | Typical layout cause | Correct response |
| --- | --- | --- |
| Text is cut off at the top or bottom | Fixed `height`/`maxHeight`, `overflow: 'hidden'`, too-small `lineHeight`, or a vertically centered row that cannot grow | Allow the text container to grow; use a safe scalable line height; redesign the row if needed |
| Text is cut off at the left or right | Fixed/narrow width, a one-line rule, no `flexShrink`, or icon/text/action all forced into one row | Give text flexible width and wrapping; stack or move secondary content at larger sizes |
| Text overlaps nearby elements | Absolute positioning or a fixed card/control height assumes one text line | Remove the fixed assumption and use normal flex layout or an intentionally responsive variant |
| Large text is silently prevented | `allowFontScaling={false}`, a low `maxFontSizeMultiplier`, or shrink-to-fit behavior | Remove the cap unless a documented exception is genuinely non-textual; preserve readable device scaling |

This is why only some resident text currently works: components with flexible height, adequate padding, and wrapping naturally adapt. Components designed with fixed dimensions or one-line assumptions do not. Fixing a few visible instances cannot solve the underlying pattern; the resident interface needs one consistent dynamic-type standard and a screen-by-screen audit.

## 2. Accessibility commitment and success criteria

The resident experience must respect the font size chosen in device settings. The implementation must not make a screen appear stable by disabling or artificially capping font scaling.

The committed behavior is:

1. At the largest font size available on each supported test device, no meaningful resident text is clipped, overlaps another control, or becomes impossible to read.
2. Text is allowed to wrap or make its container taller. When the resulting screen is longer, the user can scroll to every action and piece of content.
3. Essential actions remain reachable and have visible labels or accessible names. A large font must not hide a submit, report, emergency, close, or navigation action.
4. The existing resident information hierarchy remains recognizable at default size; larger sizes may use a more vertical layout when necessary.
5. Buttons and touch targets do not become smaller to compensate for enlarged text.

The primary acceptance target is the **actual maximum system text setting on supported Android and iOS test devices**, including iOS Accessibility Larger Text where supported. This is a stronger and clearer target than a single arbitrary multiplier because operating systems and devices expose different maximum scales.

## 3. Scope

### In scope: resident routes and shared resident UI

Audit and correct text that appears in these resident routes first:

| Area | Route or main component area | High-risk content |
| --- | --- | --- |
| Home | `app/(main)/home.tsx`, `components/home/` | Greeting, alerts, action cards, carousels, report previews, badges |
| Community feed | `app/(main)/feed.tsx`, `components/report/ReportDetailCard.tsx` | Report/announcement titles, body text, filters, cards, comments, media labels |
| Resident map | `app/(main)/map.tsx`, resident map sheets/panels | Map search, filters, callouts, report preview/detail sheets, resource details |
| Profile | `app/(main)/profile.tsx`, `components/profile/` | Names, account rows, settings, modal actions, validation/error text |
| Report flow | `components/report/` and the resident report modal/sheets | Step labels, field labels, picker values, error text, attachments, review and success states |
| Shared resident chrome | `components/navigation/`, `components/notifications/`, `components/ui/` | Header, bottom navigation, notification UI, bottom sheets, loading/empty/error views |

Also include resident authentication and onboarding screens if they share the same affected text components. They are resident-facing and must not reintroduce the problem before login.

### Explicitly out of scope for this phase

- MDRRMO, Mayor, BDRRMO, and administrator workspaces, except where an edited shared component would otherwise regress them.
- Changes to Supabase schema, RLS, business rules, navigation destinations, report status behavior, or backend data flow.
- A visual redesign unrelated to large text support.
- Changing a resident's chosen system text size, disabling scaling, or using a global cap as a workaround.

Official-side work should be a later, separate rollout using the reusable foundations proven on the resident side.

## 4. Implementation strategy

### Step 1 — Establish a reproducible baseline

Before changing styles, document every failure with a screenshot and the exact test state:

1. Record platform, OS version, phone model/screen size, orientation, app route, and system text-size setting.
2. Test default text size, a large setting, and the maximum setting. On iOS include the Accessibility Larger Text range; on Android include the maximum Font Size setting available on the test device.
3. Use realistic worst-case content: long Filipino/English names, long barangay and address names, incident titles, status text, errors, dates, and multi-line report descriptions. Short mock text is not sufficient.
4. Classify each defect as vertical clipping, horizontal clipping, overlap, hidden action, unreadable hierarchy, or navigation/control issue.
5. Build a resident-screen inventory with the component, style file, failure type, severity, screenshot, and proposed responsive behavior.

This baseline prevents a partial fix from being mistaken for full support and provides a visual regression reference for later work.

### Step 2 — Inspect existing text and layout rules before introducing anything new

Audit resident `Text` usage and the styles directly around it. For each instance, identify:

- `fontSize`, `lineHeight`, `fontFamily`, `fontWeight`, and any existing `allowFontScaling` or `maxFontSizeMultiplier` values;
- parent `height`, `minHeight`, `maxHeight`, `width`, `maxWidth`, `overflow`, alignment, and absolute positioning;
- `numberOfLines`, `ellipsizeMode`, `adjustsFontSizeToFit`, and `flexShrink` behavior;
- whether the content is essential, secondary, decorative, or a controlled short label;
- whether the same pattern is already present in a reusable resident component.

Do not begin by changing every `fontSize`. The goal is to remove unsafe layout assumptions while preserving the current visual system at normal text size.

### Step 3 — Define one reusable resident typography contract

Use the existing theme and style structure to define or consolidate named resident text roles rather than repeating ad-hoc font values. Examples of roles are screen title, section title, card title, body, metadata, button label, badge label, input label, helper text, and error text.

For every role, document:

| Rule | Requirement |
| --- | --- |
| Scaling | System font scaling remains enabled by default |
| Line height | Sized to safely contain the scaled font's ascenders and descenders; never use a line height that only works at default scale |
| Text alignment | Use natural layout flow; avoid vertical centering as the only way to fit multi-line text |
| Single-line usage | Permitted only for short, nonessential, controlled values where truncation has a usable fallback |
| Long content | Must wrap and expand vertically, or move to a scrollable/detail surface with an accessible way to reach it |
| Font family | Confirm the selected family contains the needed glyphs and has reliable vertical metrics on Android and iOS |

The first implementation should reuse the current theme tokens and component style files. A shared text component or text-role utility is justified only after the audit proves the same rules are duplicated in at least two resident areas. It must be a thin, readable wrapper—not a new styling system that hides layout decisions.

### Step 4 — Fix layouts by pattern, not only by screen

Apply the following decision rules consistently.

#### A. Text cards and list rows

- Use content-driven height. Keep `minHeight` only when it preserves a usable touch target, never as a ceiling.
- Give the text column remaining width and permit `flexShrink: 1` where sibling icons/actions would otherwise force it off-screen.
- Allow titles, descriptions, and metadata to wrap when their content is meaningful.
- Keep padding proportional and avoid clipping shadows/content through `overflow: 'hidden'` unless the view is a deliberately clipped image container.

#### B. Icon + label + action rows

At larger text sizes, a three-item row is often physically impossible on a narrow device. Use a defined responsive behavior:

1. Keep the icon and primary label together in the flexible content area.
2. Move secondary metadata below the label, or let the row become a vertical stack.
3. Keep the action visible as an icon button with a clear accessibility label, or place it below the primary content.
4. Do not reduce text or touch targets merely to keep one horizontal line.

#### C. Buttons, chips, and segmented controls

- Buttons with meaningful labels must grow vertically and allow label wrapping when necessary.
- Short, stable labels may remain one line only if tested at maximum scale and the full action remains discoverable.
- If a row of chips or tabs cannot fit, use wrapping, horizontal scrolling with visible affordance, or a picker/menu—choose the behavior that preserves discoverability for that control.
- Avoid “shrink text until it fits”; it conflicts with the user's accessibility choice.

#### D. Headers, bottom navigation, and compact chrome

- Header titles may truncate only when the complete destination is still clear through an accessible label and the title is not the sole source of critical information.
- Bottom-navigation labels must be tested carefully because the navigation bar has limited height. Prefer concise fixed labels, safe vertical space, and accessible labels; do not hide the currently selected destination.
- If device text makes a compact chrome pattern unusable, use the existing navigation architecture to present a more spacious variant rather than allowing overlap.

#### E. Bottom sheets, modals, forms, and keyboard states

- Sheet and modal content must scroll when enlarged text exceeds the available viewport.
- Keep the primary action reachable above the keyboard or available after scrolling; do not fix it behind the keyboard or off the bottom edge.
- Errors and helper text must wrap and increase the form's height. Validate that adding an error does not hide the next field or submit action.
- Re-test with keyboard open, landscape, and small-height devices because these are different constraints from font scale alone.

#### F. Maps and overlay UI

- Map markers and visual labels may use compact treatment, but selected-report details, filters, legends, and actionable overlays must remain readable and reachable.
- Do not rely on fixed overlay heights for text. Use expandable or scrollable sheets for longer content.

### Step 5 — Implement in resident feature order

Work in small, testable batches. Suggested order:

1. Shared resident primitives: app header, bottom navigation, resident bottom sheet, common buttons, input/error presentation, loading/empty/error states, and shared card patterns.
2. Report submission flow: this is critical task completion UI and contains labels, errors, pickers, review content, and keyboard behavior.
3. Home: alerts, quick actions, carousel cards, nearby-report cards, and banners.
4. Community feed: report cards, announcement cards, comments, filters, sort controls, and detail views.
5. Resident map: search/filter controls, preview/detail sheets, callouts, resource views, and contributions panel.
6. Profile, notifications, authentication, and onboarding: settings rows, account actions, notification details, and validation screens.

After each batch, test every edited component where it is reused. A shared change must not be accepted only because one host screen looks correct.

### Step 6 — Make responsive behavior intentional and maintainable

Use the system text scale only to choose between already-designed layout variants when necessary; do not use it to calculate a custom smaller font size. For example, a compact row may become a stacked row at a documented large-text threshold. The text itself should continue to honor the device preference.

Each such variant must have:

- a clear reason it is necessary (for example, three controls cannot safely fit on a small phone at maximum scale);
- one shared, named condition rather than different magic numbers in each component;
- the same information and actions as the normal layout;
- tests at both sides of the threshold and at maximum scale.

Prefer flexible wrapping first. Introduce a scale-specific layout variant only when wrapping produces an unclear, unusable, or visually unstable interaction.

### Step 7 — Verify before merging each batch

For every resident screen affected, complete the manual checks below on real Android and iOS devices where possible:

| Test | Expected result |
| --- | --- |
| Default text size | Existing visual hierarchy and interactions remain intact |
| Large system text | No clipping, overlap, accidental truncation, or hidden primary action |
| Maximum system text | Content reflows, stacks, or scrolls; all meaningful content and actions remain reachable |
| Long realistic content | No horizontal escape, cut-off words, or card/row collision |
| Validation error shown | Error wraps and no form action becomes inaccessible |
| Keyboard open | Focused field and submit/next path remain usable |
| Small device / landscape | Layout retains access to all content through reflow or scrolling |
| Screen reader focus | Accessible name and focus order still identify actions after layout changes |

Where the repository supports UI or component tests, add regression coverage for critical reusable primitives and screen states. Automated checks cannot fully prove rendered text does not clip across native font metrics; screenshots and device testing remain required.

### Step 8 — Maintain the standard after the initial rollout

Add the following to resident UI review and release checks:

1. Any changed screen must be checked at default and maximum device text sizes.
2. Any new `height`, `maxHeight`, `numberOfLines`, `allowFontScaling`, or `maxFontSizeMultiplier` around text needs an explicit review reason.
3. New cards, rows, forms, bottom sheets, and headers must use the resident typography contract and an existing safe layout pattern where one exists.
4. New strings must be tested with realistic long content before release, particularly barangays, names, address fields, status messages, and errors.
5. A visual issue discovered in a shared primitive must be fixed at the primitive first, then re-tested in all resident hosts.

## 5. Reusable building blocks

The resident rollout should create only reusable pieces that eliminate confirmed duplication.

| Candidate reusable piece | Use when | Responsibility | Must not do |
| --- | --- | --- | --- |
| Resident text roles/styles | Same typography role occurs across two or more features | Centralize safe typography defaults and semantic roles | Force every layout into one rigid appearance |
| Flexible labelled row | Settings, resource, and action rows repeat the icon + label + secondary/action pattern | Provide safe wrapping/stacking and touch-target spacing | Decide feature-specific navigation or business logic |
| Resident button style/pattern | Primary/secondary buttons appear in multiple flows | Permit label wrapping and content-driven height | Shrink or cap text to preserve a fixed height |
| Scroll-safe resident sheet/modal pattern | Multiple sheets/forms can outgrow the viewport | Coordinate scroll area, safe area, keyboard avoidance, and reachable actions | Own unrelated screen state or navigation |
| Scale-aware layout variant helper | Two or more components need the same documented layout switch | Expose one named signal for layout choice | Alter the user's requested text scale or hide content |

This makes the solution scalable: a future resident component starts from a proven text/layout pattern instead of repeating the same fixed-height mistake. It also keeps the first phase practical by avoiding premature abstractions for one-off designs.

## 6. Constraints and limitations

### Physical-space limitation

At maximum accessibility text size, a narrow phone cannot always display the same information in the same single row as default size. Reflow, stacking, additional scrolling, or a compact-but-accessible control pattern is expected behavior—not a defect. The limitation is physical screen space, not the user's font preference.

### Font-metric limitation

Android and iOS can render the same font family with different vertical metrics. A `lineHeight` that appears safe in an emulator can clip on a real Android device, especially with custom fonts, bold weights, accented characters, or Filipino text. Cross-platform device testing is required; fixed mathematical ratios alone are not sufficient.

### Third-party/native control limitation

Map labels, native pickers, alert dialogs, browser/web content, and some platform-owned UI cannot always be styled to the same degree as React Native components. The resident experience must provide a readable app-controlled alternative for essential information or actions when those controls cannot safely scale.

### Screenshot and automation limitation

Type checks, linting, and ordinary unit tests cannot determine whether glyphs are visually clipped. Automated tests can guard configurations and variants, but final proof requires manual real-device checks at the target text settings and with long content.

### Product-copy limitation

No layout can guarantee an elegant compact display for arbitrarily long unstructured text. Essential content must remain accessible through wrapping, scrolling, or a detail view. Nonessential duplicate metadata may be shortened only with a product decision, never by silently removing critical report or emergency information.

## 7. Risk controls

| Risk | Control |
| --- | --- |
| A broad typography change regresses default-size visuals | Deliver feature batches, test default and maximum size after each batch, and keep styles localized until repetition justifies sharing |
| Fixing a card hides a control in a sheet or modal | Test the same component in every resident host and test keyboard-open states |
| A cap seems to solve the issue quickly | Treat `allowFontScaling={false}` and low multipliers as exceptions requiring an explicit, documented accessibility review |
| Reflow changes a user flow | Preserve content/action order; use responsive layout only, not navigation or business-logic changes |
| Long real data breaks after short-content testing | Use a saved set of worst-case test strings/data on every validation pass |
| Shared component change impacts official UI | Run the relevant official smoke check when a truly shared component is changed; otherwise keep this phase resident-local |

## 8. Deliverables and definition of done

The resident dynamic-type work is complete only when all of the following are true:

- A documented resident-screen inventory records every audited text surface and its test status.
- Resident system font scaling remains enabled, with no unexplained global or component-level caps.
- All resident critical paths pass at the maximum device text setting: opening Home, navigating tabs, reading a report/update, opening map details, submitting a report, correcting a validation error, viewing notifications, and managing the profile.
- No meaningful resident text is vertically or horizontally clipped at the supported maximum settings.
- Every essential action remains visible/reachable through natural layout, an intentional responsive variant, or scrolling.
- Shared resident primitives use proven typography/layout rules and have been re-tested everywhere they are used.
- Default-size visual behavior, business rules, navigation, Supabase/RLS behavior, and existing resident data flow remain unchanged.
- The release checklist includes maximum-text-size testing so the issue cannot quietly return in new resident UI work.

## 9. Recommended implementation record

For each implementation batch, record the following in the pull request or changelog:

- Resident screens/components changed.
- Unsafe pattern removed (for example, fixed card height, one-line essential title, or low scale cap).
- Responsive behavior chosen (wrap, stack, scroll, or documented compact-control variant).
- Android and iOS devices/settings tested.
- Long-content and keyboard/error states tested.
- Shared components affected and their re-test results.

This record makes dynamic-type support a measurable engineering requirement rather than a one-time visual fix.
