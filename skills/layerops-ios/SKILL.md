---
name: layerops-ios
description: Rename Figma design layers into iOS-friendly, lowerCamelCase business-semantic names for Swift, SwiftUI, UIKit, accessibilityIdentifier, and XCTest workflows. Use when the user asks to rename Figma frames/pages/layers for iOS development, normalize design layer names, remove visible copy from layer names, preserve or functionalize component instance names, or audit a Figma page/frame for iOS naming quality.
---

# LayerOps iOS

## Overview

Use this skill to rename Figma layers so design structure maps cleanly to iOS UI implementation. The goal is stable business/control semantics that can map to Swift properties, SwiftUI views, UIKit views, `accessibilityIdentifier`, and XCTest identifiers.

Always use this together with the `figma-use` skill before any `use_figma` call.

Read these references when needed:

- `references/naming-rules.md` for detailed iOS naming rules, examples, and validation patterns.
- `references/ios-guidance.md` when explaining why names should map to Swift, SwiftUI/UIKit, `accessibilityIdentifier`, or XCTest conventions.
- `references/component-presets.md` when choosing names for common HIG / iOS UI components such as navigation bars, toolbars, tab bars, buttons, text fields, pickers, sheets, alerts, popovers, image views, indicators, and state views.

## Workflow

1. Load `figma-use` and inspect the target.
2. Determine the scope:
   - Single frame subtree.
   - A page's direct frames.
   - A page's direct frames plus frames inside named sections.
   - Only unlocked layers if the user says so.
3. Count and report the target frames before renaming when the scope is page-level or ambiguous.
4. Run in incremental mode by default: preserve existing valid names, and rename only new or non-compliant layers.
5. Rename roots first, then descendants.
6. Mark successfully processed nodes with shared plugin data when possible.
7. Validate the result and report counts.

## Scope Rules

- If the user gives a Figma URL with `node-id`, extract it as `123:456`.
- If the node is a `PAGE`, include direct child `FRAME` nodes. If named sections such as `Section 1` are relevant or the user mentions them, include each section's direct child frames too.
- If the node is a `FRAME`, rename that frame and its accessible descendants.
- If the user says "unlocked only", skip locked nodes and descendants inside locked ancestors.
- Do not detach instances just to rename inaccessible internals.

## Incremental Reruns

LayerOps iOS must be safe to rerun after designers add new layers.

Default behavior:

- Do not rename an existing layer if its current name already passes LayerOps iOS validation.
- Do not rename a layer that has LayerOps iOS shared plugin data unless it has become non-compliant.
- Rename only layers that are new, untagged and non-compliant, or clearly still using Figma/default/visible-copy/project-context names.
- Treat `Frame 1`, `Rectangle 2`, `Vector 3`, `Group 4`, visible UI strings, and project-context filler as likely new or unfinished layers.
- Preserve manually improved names even if another valid name could also be generated.

Use full rewrite mode only when the user explicitly asks for a complete renaming pass, reset, or re-normalization of all existing names.

When using `use_figma`, prefer shared plugin data to mark processed nodes:

```js
node.setSharedPluginData('layeropsIos', 'processed', '1')
node.setSharedPluginData('layeropsIos', 'name', node.name)
```

Do not use `getPluginData` or `setPluginData`; `use_figma` does not support them.

## iOS Alignment

Figma layer names should be easy to map to iOS implementation names:

- Swift properties, variables, methods, and `accessibilityIdentifier` values generally fit `lowerCamelCase`.
- SwiftUI View / UIKit type names can be derived with `UpperCamelCase`.
- XCTest can read stable identifiers from `accessibilityIdentifier` / `identifier`.
- UI role names should follow Swift API Design Guidelines: clarity at use site, role-based naming, and no needless or ambiguous words.

Keep Figma layer names in `lowerCamelCase`. Do not use Figma layer names as visible user copy, and do not directly copy localized UI strings into layer names.

## Naming Rules

Use `lowerCamelCase`.

Frame roots do not use `screen` as a prefix. Name them directly by business module/state:

```text
profileEditor
settingsPanel
checkoutSummary
mediaPicker
upgradeDialog
notificationPermissionSheet
```

Descendants and component instances use actual business/control properties, not page-name fallback:

```text
upgradeOfferDialog
primaryToolbar
filterTabItem01
primaryButton
orderItemRow03
planOptionCard02
```

Do not directly copy visible strings into layer names. Convert strings into stable roles:

```text
primaryButton
primaryButtonLabel
planOptionCard01
secondaryLegalLink
benefitItem03
```

For the full rule set, read `references/naming-rules.md`.

For base component and element presets, read `references/component-presets.md` and reuse its recommended layer names before inventing new names.

## Component Instance Rule

For referenced components, the outermost `INSTANCE` can be:

- Preserved if the source/component name is stable and useful.
- Renamed by actual function if it has a clear role.

Do not keep generic fallback names like:

```text
homeComponent03
dashboardComponent02
```

Use a role instead:

```text
upgradeOfferDialog
accountBalanceComponent
primaryButton
toolbarBackButton
filterTabItem02
```

Component variant names such as `Mode=Light`, `State=Default`, `Size=Large...`, or `hasTopImage=true...` are not good layer names. Use function instead.

## Dialogs, Sheets, And Navigation

If a component/frame is visually a centered prompt, confirmation, bottom sheet, dialog, or modal, name the outer layer with `Dialog` or `Sheet` as a suffix in lowerCamelCase.

Examples:

```text
upgradeOfferDialog
deleteConfirmDialog
actionMenuSheet
modalScrimOverlay
dialogPrimaryButton
dialogTitleLabel
```

For tabs, toolbars, and navigation controls, prefer role-specific names:

```text
filterTabItem01
primaryToolbar
toolbarBackButton
navigationCloseButton
```

## Validation

After renaming, validate:

- All names match `^[a-z][A-Za-z0-9]*$`.
- Frame roots do not start with `screen`.
- Figma defaults are gone: `Frame`, `Rectangle 1`, `Vector 2`, `Union`, `bounding box`, `action02`.
- Visible strings are not copied into names.
- Project-specific page terms are gone from descendants. Build this term list dynamically from the target file's old page/frame names and obvious legacy labels; do not hard-code terms from any source project.
- Non-iOS naming concepts from other platforms are absent from iOS skill output.
- Inaccessible component internals are reported separately rather than forced.

Report:

- Target section count.
- Target frame count.
- Checked layer count.
- Renamed count.
- Preserved valid existing count.
- New/non-compliant renamed count.
- Failed/inaccessible count.
- Validation counts for invalid names, default names, visible-string leaks, and project-context leaks.

## Figma Execution Notes

- Use `await figma.setCurrentPageAsync(page)` once per `use_figma` call.
- Use `return` for all output.
- Wrap property access with safe helpers because instance internals can throw `node_not_found`.
- If `use_figma` errors, remember it is atomic; fix the script and rerun.
- For text content, do not edit characters. Renaming text nodes does not require font loading, but avoid touching `characters`.
- Use `setSharedPluginData` / `getSharedPluginData` under namespace `layeropsIos` to support future incremental reruns.
