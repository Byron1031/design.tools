---
name: layerops
description: Rename Figma design layers into Android-friendly lower_snake_case business-semantic names, identify implementation asset export roots, and preserve valid existing names on incremental reruns. Use for Android Figma frame, page, layer, component, or asset naming and audits.
---

# LayerOps

## Purpose

Rename Figma layers so design structure maps cleanly to Android UI implementation. Use stable business and control semantics instead of visible copy, visual-shape descriptions, Figma defaults, or source-project page filler.

This file is self-contained. Do not depend on optional reference files for naming or asset decisions.

Always load the `figma-use` skill before any `use_figma` call.

## Mandatory Workflow

1. Inspect the target before changing names.
2. Resolve scope:
   - A single frame subtree.
   - A page's direct frames.
   - Direct frames plus frames inside relevant sections.
   - Only unlocked nodes when requested.
3. For page-level or ambiguous work, count target frames first.
4. Run incremental mode unless the user explicitly requests a full rewrite.
5. Inspect each plausible asset node using the asset decision process below. Non-component standalone icons, static images, and visual-resource frames must receive an asset decision.
6. Rename roots before descendants.
7. Apply `asset_...__format` only to confirmed export roots.
8. Record LayerOps shared plugin data when supported.
9. Validate and report the result.

Do not infer asset intent from a name alone. Inspect node type, fills, effects, export settings, component relationship, children, text, and UI role.

## Scope

- Convert a Figma URL `node-id=123-456` to node ID `123:456`.
- For a `PAGE`, include direct child `FRAME` nodes. Include direct frames inside named sections when the user includes those sections.
- For a `FRAME`, process the frame and accessible descendants.
- For "unlocked only", skip locked nodes and descendants of locked ancestors.
- Do not detach instances to reach inaccessible internals.

## Incremental Reruns

Reruns must avoid name churn after designers add layers.

- Preserve an existing name that passes all rules.
- Preserve a node marked with LayerOps shared plugin data unless it is now invalid.
- Rename new, untagged, or non-compliant nodes.
- Rename confirmed export roots that still lack a valid asset marker.
- Re-evaluate existing asset markers against hard exclusions. Remove an erroneous asset marker and export metadata when a node is actually placeholder, preview, runtime, or mock content.
- Never promote an ambiguous asset candidate during a rerun without stronger evidence.
- Preserve a manually improved valid name even when another valid synonym exists.
- Use full rewrite mode only when explicitly requested.

Common unfinished names include `Frame 1`, `Rectangle 2`, `Vector 3`, `Group 4`, visible UI strings, variant-property strings, and inherited page-context names.

When supported:

```js
node.setSharedPluginData('layerops', 'processed', '1')
node.setSharedPluginData('layerops', 'name', node.name)
```

For confirmed asset roots:

```js
node.setSharedPluginData('layerops', 'export', '1')
node.setSharedPluginData('layerops', 'asset_kind', 'illustration')
node.setSharedPluginData('layerops', 'export_format', 'png')
node.setSharedPluginData('layerops', 'decision_source', 'inferred')
```

When correcting a stale asset decision:

```js
node.setSharedPluginData('layerops', 'export', '0')
node.setSharedPluginData('layerops', 'asset_kind', '')
node.setSharedPluginData('layerops', 'export_format', '')
node.setSharedPluginData('layerops', 'decision_source', 'excluded_content_role')
```

Use shared plugin data only. `use_figma` does not support `getPluginData` or `setPluginData`.

## Android Alignment

Use `lower_snake_case` for all Figma layer names. This maps cleanly to:

- XML/View IDs such as `@+id/profile_save_button` and `R.id.profile_save_button`.
- Resource names such as `R.drawable.ic_profile_avatar`.
- Stable Compose test tags and semantics identifiers.
- Feature names that can convert to `ProfileEditor`, `ProfileEditorViewModel`, or `ProfileEditorUiState`.

Do not copy Kotlin casing into Figma. Types and Composables may become PascalCase in code; functions and properties may become camelCase.

Use functionality and UI role:

```text
profile_editor -> ProfileEditor / ProfileEditorUiState / R.id.profile_editor
btn_save -> R.id.btn_save / Modifier.testTag("btn_save")
dialog_delete_confirm -> dialog composable or dialog view
```

## Core Naming Rules

- Use `^[a-z][a-z0-9_]*$`.
- Root frames use feature, module, or state names without a `screen_` prefix.
- Descendants use their local UI role, not the page name.
- Do not copy visible copy, prices, legal text, localized strings, or user content.
- Do not use `/` for page-instance hierarchy; Figma nesting already expresses hierarchy.
- `/` is acceptable only in design-system component source names such as `Button / Filled / Large`.
- Use two-digit indices for repeated siblings when ordering matters: `row_result_item_01`.
- Name by role before appearance: `selected_indicator`, not `blue_rectangle`.
- Keep examples and generated names neutral to the current project. Never inject names from another project.

Root examples:

```text
profile_editor
settings_panel
checkout_summary
media_picker
search_results
auth_sign_in
upgrade_dialog
notification_permission_sheet
```

Descendant examples:

```text
toolbar_primary
tab_filter_item_01
btn_primary_cta
tv_primary_cta_label
card_plan_option_02
row_order_item_03
legal_link_secondary
empty_state
```

Avoid:

```text
screen_profile_editor
UploadCard / FirstFrame
TopBar / CurrentMode=AI
Continue
Best Value
Blue Rectangle
component_home_03
```

## Component Instances

An outer `INSTANCE` may keep its source name only when that name is stable, semantic, and useful to implementation. Otherwise rename it by actual function.

Preserve or use:

```text
icon_toolbar_back
btn_primary_cta
tab_filter_item_01
component_account_balance
dialog_upgrade_offer
sheet_action_menu
```

Replace variant strings and generic fallbacks:

```text
Mode=Light
State=Default
Size=Large, Variant=Filled
hasTopImage=true, buttonCount=one
component_dashboard_02
```

Shared icon component instances normally map to code components and are not exported.

## Android Component Presets

Use these presets before inventing a new component term. Add a business qualifier or sibling index as needed.

### Actions

| UI role | Recommended names |
|---|---|
| Button | `btn_primary`, `btn_secondary`, `btn_primary_cta` |
| Filled button | `btn_primary_filled` |
| Tonal button | `btn_secondary_tonal` |
| Outlined button | `btn_secondary_outlined` |
| Text button | `btn_text_action` |
| Elevated button | `btn_elevated_action` |
| Icon button | `btn_icon_toolbar_back` |
| Floating action button | `fab_primary`, `fab_extended_primary` |
| Segmented button | `segmented_mode_control` |

### Navigation

| UI role | Recommended names |
|---|---|
| Top app bar / toolbar | `top_app_bar`, `toolbar_primary` |
| Center, medium, large app bar | `top_app_bar_center_aligned`, `top_app_bar_medium`, `top_app_bar_large` |
| Bottom app bar | `bottom_app_bar` |
| Navigation bar | `bottom_navigation_bar` |
| Navigation item | `bottom_navigation_item_01` |
| Navigation rail | `navigation_rail`, `navigation_rail_item_01` |
| Navigation drawer | `navigation_drawer`, `navigation_drawer_item_01` |
| Tabs | `tab_bar`, `tab_filter_item_01` |

### Inputs And Selection

| UI role | Recommended names |
|---|---|
| Text field | `text_field_email`, `text_field_search` |
| Outlined / filled field | `text_field_email_outlined`, `text_field_email_filled` |
| Search | `search_bar`, `search_view` |
| Checkbox | `checkbox_terms` |
| Radio button | `radio_option_01` |
| Switch | `switch_notifications` |
| Slider | `slider_volume`, `slider_price_range` |
| Date / time picker | `date_picker`, `time_picker` |
| Chips | `chip_assist_01`, `chip_filter_01`, `chip_input_01`, `chip_suggestion_01` |
| List / menu item | `row_list_item_01`, `menu_item_01` |
| Selection marker | `selected_indicator` |

### Containers And Overlays

| UI role | Recommended names |
|---|---|
| Card | `card_content`, `card_plan_option_01` |
| Card variants | `card_elevated_content`, `card_filled_content`, `card_outlined_content` |
| Dialog | `dialog_alert`, `dialog_delete_confirm`, `dialog_fullscreen_editor` |
| Bottom / side sheet | `sheet_action_menu`, `sheet_side_filter` |
| Modal scrim | `overlay_modal_scrim` |
| Divider | `divider_section` |
| Carousel | `carousel_media` |

Centered prompts, confirmations, and modal surfaces must use `dialog_`; bottom or side surfaces must use `sheet_`. Do not call them generic components.

### Feedback, Text, And Media

| UI role | Recommended names |
|---|---|
| Badge | `badge_unread` |
| Progress | `progress_loading`, `progress_linear_loading`, `progress_circular_loading` |
| Snackbar / tooltip | `snackbar_feedback`, `tooltip_help` |
| Text | `tv_title`, `tv_body`, `tv_input_label`, `tv_supporting_text` |
| Error / placeholder / link | `tv_error_message`, `tv_placeholder`, `tv_legal_link_primary` |
| Icon component | `icon_toolbar_back`, `icon_leading`, `icon_trailing` |
| Runtime image | `iv_avatar`, `iv_preview`, `iv_thumbnail` |

### States

```text
empty_state
loading_state
error_state
success_state
disabled_state
selected_state
expanded_state
```

### Common Prefixes

| Prefix | Meaning |
|---|---|
| `container_` | Layout container |
| `toolbar_` | App bar or tool strip |
| `tab_`, `tab_bar_` | Tab item or container |
| `btn_`, `fab_` | Action control |
| `tv_` | Text node |
| `iv_` | Runtime image/media view |
| `icon_`, `ic_` | Icon role |
| `card_`, `row_` | Card or list item |
| `dialog_`, `sheet_`, `overlay_` | Modal surfaces |
| `bg_`, `divider_`, `badge_` | Supporting visual role |
| `component_`, `widget_` | Reusable UI without a more specific role |
| `section_` | Figma section container |

## Asset Export Naming

Use the asset marker only when implementation should download the Figma node as a file:

```text
asset_{semantic_name}__{format}
```

Allowed formats are `svg`, `png`, and `jpg`.

```text
asset_illustration_empty_state__svg
asset_illustration_subscription__png
asset_badge_ai_magic__svg
asset_decoration_home_header__png
asset_background_onboarding__jpg
```

Content ownership is the first asset boundary; component status is the second:

- Placeholder, template-preview, sample-preview, and runtime-loaded content is not an asset, even when represented by a non-component frame or image.
- A shared icon or UI component `INSTANCE` normally maps to code and is not exported.
- A non-component standalone icon is an asset by default.
- A non-component static image that ships as fixed product artwork is an asset by default.
- A non-component `FRAME` that bounds one complete icon, image, illustration, logo, decoration, or visual background is an asset by default.
- An ordinary layout `FRAME` remains UI structure and is not an asset.

Node type alone is not enough to classify an ordinary frame, but it is sufficient when a non-component node has a clear icon, image, or complete visual-resource role.

### Required Inspection

Before deciding, inspect:

- Node type and dimensions.
- `exportSettings`.
- Paint fills, including image fills and opacity.
- Effects, masks, blend modes, and clipping.
- Whether it is a component or instance and the source component role.
- Whether the node itself is the smallest non-component icon, image, or visual-resource frame.
- Child structure, editable text, controls, navigation, and list content.
- Whether content is static product artwork or runtime/user/remote content.
- Whether it is a placeholder, template preview, preset preview, sample thumbnail, mock image, replaceable slot, or repeated catalog/list content.
- Whether ordinary Android UI primitives can reproduce it faithfully.
- Whether an ancestor is already a confirmed export root.

### Placeholder And Preview Detection

Do not rely only on the current layer name. Treat a non-component frame or image as excluded preview/content when its role is established by one or more strong contextual signals:

- It sits inside a template, preset, style, filter, media, or content picker.
- It is one of several repeated, similarly sized images in a card list, grid, carousel, or catalog.
- It has selection borders, checkmarks, lock/pro badges, labels, replace controls, or tap targets layered around it.
- The surrounding UI lets the user upload, replace, choose, apply, or browse the represented content.
- The image is a generic placeholder, sample composition, demo result, thumbnail, or preview of content that changes independently of the app release.
- The implementation is expected to load the content from user storage, a database, network, CMS, template catalog, or media pipeline.

An explicit role such as template preview or placeholder is enough to exclude it. When context is insufficient to distinguish fixed artwork from preview/runtime content, classify the node as `candidate` and do not add `asset_`.

### Decision Order

Classify every plausible resource as `confirmed`, `candidate`, or `excluded`. Apply this precedence:

1. Node-specific user override.
2. Hard exclusion.
3. Explicit technical confirmation.
4. Non-component resource confirmation.
5. Other high-confidence inferred confirmation.
6. Candidate.

Node-specific user override:

- The user explicitly identifies the node as a file resource.

A page/frame selected for general renaming does not explicitly confirm every descendant.

Hard exclusions, unless the user explicitly overrides:

- Status bar, navigation bar, home indicator, device frame, keyboard mockup.
- User avatar, uploaded media, feed/product photo, remote thumbnail, or other runtime-loaded content.
- Image placeholders, empty media slots, skeleton images, mock images, and replaceable upload/selection targets.
- Template previews, preset previews, sample thumbnails, demo content, and catalog previews, including local non-component images or frames used inside cards, lists, grids, carousels, or pickers.
- A frame whose purpose is to preview selectable content rather than provide fixed visual decoration for the interface.
- Solid fill, ordinary gradient, border, rounded rectangle, divider, scrim, or code-supported shadow.
- Shared UI component instance or its internals.
- Shared Material/platform icon component instances expected to map to a code icon.
- Button, tab, toolbar, dialog, card, list row, text, badge, or other UI control.
- Ordinary layout `FRAME` or `GROUP`.
- Child of a confirmed asset root, unless independently reused and explicitly exported.

Semantic hard exclusions override `exportSettings`, old LayerOps `export=1` metadata, and an existing `asset_...__format` name. These technical signals may be stale or may describe design-tool export convenience rather than an Android bundle resource.

Explicit technical confirmation, only after hard exclusions:

- Non-empty Figma `exportSettings`.
- LayerOps shared data `export=1`.
- An already valid `asset_...__format` name.

Non-component resource confirmation, when no hard exclusion applies:

- A standalone icon built as `VECTOR`, `BOOLEAN_OPERATION`, `FRAME`, or another non-component vector container. Mark the smallest complete icon root as `asset_icon_{semantic_name}__svg`.
- A static `IMAGE` node or non-component node with an image fill that ships as fixed interface artwork, not placeholder, preview, sample, or runtime content. Use PNG when transparency or exact compositing is needed; otherwise use JPG for opaque photographic content.
- A non-component `FRAME` whose descendants form one complete visual resource such as an icon, logo, illustration, decoration, badge, or static background. Mark the outer resource frame, not its children.
- A non-component frame or image already named with a clear static-resource role such as `icon`, `logo`, `illustration`, `decoration`, `artwork`, `background`, or `photo`.

Do not require existing `exportSettings` for these non-component resources. Their independent visual role is sufficient evidence.

Other high-confidence inferred confirmation, only when no exclusion applies:

- Standalone vector/image brand logo, symbol, or wordmark rather than editable text.
- Fixed raster decoration or illustration with transparency, blur, masks, or effects that code cannot faithfully reproduce.
- Illustration-only outer `FRAME` whose children form one reusable artwork and contain no controls, content text, navigation, or list structure.

Candidate examples:

- Image fill whose ownership is genuinely unclear between shipped static artwork and runtime/user content.
- Image or frame whose role is unclear between fixed decoration and selectable template/preset preview content.
- Vector that is not a complete icon and may instead be a divider, mask, background shape, or internal child.
- Photo-like fill whose static versus runtime ownership is unclear.
- Decorative background or multi-layer frame mixing artwork and UI.
- Local component that may package artwork rather than reusable code UI.

Candidates keep ordinary semantic names. Report the node ID, current name, likely kind/format, evidence, and the missing fact needed for confirmation.

### Export Boundary

- Export the smallest complete reusable visual.
- Keep code-renderable backgrounds separate from raster decoration.
- Keep editable labels, prices, localized copy, badges, and controls outside artwork.
- For composed illustrations, prefer an outer `FRAME` to a `GROUP` for stable bounds.
- Mark only the export root. Children keep ordinary semantic names.

Example:

```text
asset_illustration_empty_state__svg
bg_circle
character
face
body
shadow
sparkles
decorative_line
```

### Kind And Format

| Confirmed asset | Naming |
|---|---|
| Non-component standalone icon | `asset_icon_*__svg` |
| Non-component static image with transparency | `asset_image_*__png` |
| Non-component opaque photo | `asset_photo_*__jpg` |
| Non-component complete visual frame | `asset_illustration_*__svg`, `asset_decoration_*__png`, or another role-appropriate asset name |
| Pure vector logo, custom icon, badge, illustration | `asset_logo_*__svg`, `asset_icon_*__svg`, `asset_badge_*__svg`, `asset_illustration_*__svg` |
| Transparent or effect-heavy static artwork | `asset_decoration_*__png`, `asset_illustration_*__png` |
| Opaque photo or photographic background | `asset_photo_*__jpg`, `asset_background_*__jpg` |
| Transparent bitmap requiring exact compositing | `asset_*__png` |

Ordinary gradients and shapes stay in code. Use PNG only when the user explicitly chooses to bake them into a file.

Decision examples:

```text
status_bar_mockup -> excluded
bg_upgrade_banner_gradient -> excluded
media_placeholder -> iv_media_placeholder
template_preview_frame -> container_template_preview
template_preview_image -> iv_template_preview
preset_sample_thumbnail -> iv_preset_preview
non_component_toolbar_icon -> asset_icon_toolbar_action__svg
non_component_static_artwork -> asset_image_feature_artwork__png
non_component_visual_frame -> asset_illustration_empty_state__svg
brand_wordmark -> asset_logo_brand_wordmark__svg
fixed_banner_artwork -> asset_decoration_upgrade_banner__png
avatar_image -> iv_profile_avatar
```

## Validation

Validate after renaming:

- Ordinary names match `^[a-z][a-z0-9_]*$`.
- Asset roots match `^asset_[a-z0-9]+(?:_[a-z0-9]+)*__(svg|png|jpg)$`.
- Every asset marker has a confirmed decision.
- Every non-component standalone icon has an `asset_icon_*__svg` marker.
- Every eligible non-component fixed-artwork image has an `asset_*__png` or `asset_*__jpg` marker.
- Every non-component frame that bounds a complete visual resource has one asset marker on its outer root.
- Placeholders, template/preset previews, sample thumbnails, demo content, and runtime images never have an asset marker unless the user explicitly overrides that node.
- Existing asset names and export metadata are removed when their nodes resolve to a hard-excluded content role.
- Candidates and exclusions never receive asset markers.
- Asset children do not repeat the marker unless separately exported.
- Non-assets do not contain `__svg`, `__png`, or `__jpg`.
- Root frames do not start with `screen_`.
- Figma defaults, visible-copy names, and variant strings are gone.
- Descendants do not inherit project page names as filler.
- Inaccessible component internals are reported, not forced.

Build the project-context leak list dynamically from old root names, section names, obvious page labels, and legacy patterns in the current file. Never hard-code terms from another project.

Report:

- Target section and frame counts.
- Checked, renamed, preserved, and inaccessible node counts.
- New/non-compliant rename count.
- Invalid/default/copy/context-leak counts.
- Confirmed, candidate, and excluded asset counts.
- Export counts by format and invalid marker count.
- Node ID and one-line reason for every candidate.

## Figma Execution

- Call `await figma.setCurrentPageAsync(page)` once per `use_figma` call.
- Return all tool output explicitly.
- Use safe property helpers because instance internals can throw `node_not_found`.
- A failed `use_figma` script is atomic; fix it and rerun.
- Rename text nodes without editing `characters` or loading fonts.
- Use `setSharedPluginData` and `getSharedPluginData` with namespace `layerops`.
