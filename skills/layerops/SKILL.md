---
name: layerops
description: Rename Figma design layers into Android-friendly, lower_snake_case business-semantic names for any Android project. Use when the user asks to rename Figma frames/pages/layers for Android development, normalize design layer names, remove visible copy from layer names, preserve or functionalize component instance names, or audit a Figma page/frame for naming quality.
---

# LayerOps

## Overview

Use this skill to rename Figma layers so design structure maps cleanly to Android UI implementation across projects. The goal is stable business/control semantics, not visual-shape names, visible strings, or project-specific page-context filler.

Always use this together with the `figma-use` skill before any `use_figma` call.

Read these references when needed:

- `references/naming-rules.md` for detailed naming rules, examples, and validation patterns.
- `references/android-guidance.md` when explaining why names should map to Android IDs, resources, Compose test tags, or UI state names.
- `references/component-presets.md` when choosing names for common Material Design / Android UI components such as buttons, app bars, navigation, inputs, chips, cards, dialogs, sheets, progress, lists, images, and state views.

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

LayerOps must be safe to rerun after designers add new layers.

Default behavior:

- Do not rename an existing layer if its current name already passes LayerOps validation.
- Do not rename a layer that has LayerOps shared plugin data unless it has become non-compliant.
- Rename only layers that are new, untagged and non-compliant, or clearly still using Figma/default/visible-copy/project-context names.
- Treat `Frame 1`, `Rectangle 2`, `Vector 3`, `Group 4`, visible UI strings, and project-context filler as likely new or unfinished layers.
- Preserve manually improved names even if another valid name could also be generated.

Use full rewrite mode only when the user explicitly asks for a complete renaming pass, reset, or re-normalization of all existing names.

When using `use_figma`, prefer shared plugin data to mark processed nodes:

```js
node.setSharedPluginData('layerops', 'processed', '1')
node.setSharedPluginData('layerops', 'name', node.name)
```

Do not use `getPluginData` or `setPluginData`; `use_figma` does not support them.

## Android Alignment

Figma layer names should be easy to map to Android implementation names:

- XML/View IDs: `@+id/profile_save_button` and `R.id.profile_save_button`.
- Resource names: `R.drawable.ic_profile_avatar` or `R.string.profile_title`.
- Compose test tags / semantics names: stable node identifiers for testing.
- UI state names: feature semantics that can convert to `ProfileEditorUiState`, `CheckoutSummaryUiState`, or similar code names.

Keep Figma layer names in `lower_snake_case`. Do not copy Kotlin code style directly into Figma names: Kotlin classes and Composables may use PascalCase, and functions/properties may use camelCase, but Figma layer names should stay resource/test-tag friendly.

## Naming Rules

Use `lower_snake_case`.

Frame roots do not use `screen_`. Name them directly by business module/state:

```text
profile_editor
settings_panel
checkout_summary
media_picker
upgrade_dialog
notification_permission_sheet
```

Descendants and component instances use actual business/control properties, not page-name fallback:

```text
dialog_upgrade_offer
toolbar_primary
tab_filter_item_01
btn_primary_cta
row_order_item_03
card_plan_option_02
```

Do not directly copy visible strings into layer names. Convert strings into stable roles:

```text
btn_primary_cta
tv_primary_cta_label
card_plan_option_01
legal_link_secondary
benefit_item_03
```

For the full rule set, read `references/naming-rules.md`.

For base component and element presets, read `references/component-presets.md` and reuse its recommended layer names before inventing new names.

## Component Instance Rule

For referenced components, the outermost `INSTANCE` can be:

- Preserved if the source/component name is stable and useful.
- Renamed by actual function if it has a clear role.

Do not keep generic fallback names like:

```text
component_home_03
component_dashboard_02
```

Use a role instead:

```text
dialog_upgrade_offer
component_account_balance
btn_primary_cta
icon_toolbar_back
tab_filter_item_02
```

Component variant names such as `Mode=Light`, `State=Default`, `Size=Large...`, or `hasTopImage=true...` are not good layer names. Use function instead.

## Dialogs And Modals

If a component/frame is visually a centered prompt, confirmation, bottom sheet, dialog, or modal, name the outer layer with `dialog_` or `sheet_`, even if it is a component instance.

Examples:

```text
dialog_upgrade_offer
dialog_delete_confirm
sheet_action_menu
overlay_modal_scrim
btn_dialog_primary
tv_dialog_title
```

## Validation

After renaming, validate:

- All names match `^[a-z][a-z0-9_]*$`.
- Frame roots do not start with `screen_`.
- Figma defaults are gone: `Frame`, `Rectangle 1`, `Vector 2`, `Union`, `bounding box`, `action02`.
- Visible strings are not copied into names.
- Project-specific page terms are gone from descendants. Build this term list dynamically from the target file's old page/frame names and obvious legacy labels; do not hard-code terms from any source project.
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
- Use `setSharedPluginData` / `getSharedPluginData` under namespace `layerops` to support future incremental reruns.
