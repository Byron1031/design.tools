# Naming Rules

## Core Principles

- Use `lower_snake_case`.
- Use business/control meaning, not visual shape.
- Do not copy visible UI text, marketing strings, legal copy, prices, user-facing labels, or localized terms.
- Root frame names do not use `screen_`.
- Descendant names do not use page names as context filler.
- Prefer names that Android developers can map to view IDs, Compose test tags, drawable roles, and UI state in any Android project.
- Reruns are incremental by default: preserve existing valid names and only change new or non-compliant layers.

## Android Alignment

LayerOps names should be compatible with Android implementation surfaces:

- Keep Figma layer names in `lower_snake_case` because that maps cleanly to XML IDs like `@+id/profile_save_button`, generated references like `R.id.profile_save_button`, resource names like `R.drawable.ic_profile_avatar`, and stable Compose test tags.
- Do not use Kotlin code casing directly in Figma. Convert when implementing: `profile_editor` can map to `ProfileEditor` Composable, `ProfileEditorUiState`, `ProfileEditorViewModel`, and `R.id.profile_editor`.
- Name roots by feature/module state, not by the word "screen": `profile_editor`, `checkout_summary`, `settings_panel`.
- Name descendants by local UI role: `toolbar_primary`, `tab_filter_item_01`, `btn_save`, `row_result_item_03`, `dialog_delete_confirm`.
- UI state semantics should follow functionality. If a design region represents a state, encode that role: `empty_state`, `loading_state`, `error_state`, `success_state`.

## Neutral Examples Only

The skill must stay generic across Android projects.

- Do not keep source-project page names, product-specific terms, experiment names, or one-off business strings in examples.
- Use neutral product semantics such as `profile`, `settings`, `checkout`, `media`, `notification`, `auth`, `search`, `empty_state`, `dialog`, `sheet`, `tab`, `toolbar`, `list`, and `detail`.
- Validation should find project-specific page terms dynamically from the current file, not from a hard-coded source-project word list.

## Incremental Naming

When LayerOps is run again after new layers are added:

- Keep existing names that already pass all rules.
- Keep names with `layerops` shared plugin data unless they have become invalid or the user asks for a full rewrite.
- Change new layers that still look like Figma defaults, copied visible strings, or old project-context names.
- Do not churn names just because a slightly better alternative exists.
- Report how many layers were preserved vs renamed.

Useful shared plugin data:

```text
namespace: layerops
processed: 1
name: <last LayerOps name>
```

Default/non-compliant names should still be renamed even if unmarked.

## Common Prefixes

For a broader Material Design / Android component name preset, load `component-presets.md` before inventing names for common UI controls.

| Prefix | Use |
|---|---|
| `container_` | Layout container |
| `toolbar_` | Top app bar or tool strip |
| `tab_` / `tab_bar_` | Tab item or tab container |
| `btn_` | Clickable action |
| `tv_` | Text node |
| `iv_` | Image/media |
| `icon_` / `ic_` | Icon or vector |
| `card_` | Card region |
| `row_` | List row or horizontal item |
| `dialog_` | Modal/dialog root |
| `sheet_` | Bottom/action sheet root |
| `overlay_` | Scrim/dim overlay |
| `bg_` | Background layer |
| `divider_` | Divider line |
| `badge_` | Badge/chip |
| `slot_` | Component slot |
| `component_` | Component instance with no more specific role |
| `widget_` | Reusable standalone widget |
| `section_` | Figma section container |

## Root Frame Names

Use direct business module/state names:

```text
profile_editor
profile_editor_empty_state
settings_panel
checkout_summary
media_picker
search_results
auth_sign_in
upgrade_dialog
notification_permission_sheet
```

Do not use:

```text
screen_profile_editor
Home
Settings
Upgrade Now
Continue
```

## Avoid Project-Context Filler

Descendants should say what they are, not only where they live.

Avoid:

```text
component_home_03
icon_dashboard_01
container_settings_page_02
tv_upgrade_page_label_01
```

Prefer:

```text
dialog_upgrade_offer
icon_account_balance
container_settings_group
tv_upgrade_label_01
```

Root frame names may identify the feature/module, but child names should use local roles: `dialog`, `tab`, `toolbar`, `row`, `card`, `button`, `profile`, `settings`, `checkout`, `media`, `search`, etc.

## Visible Copy

Visible strings are content and may change through localization, A/B tests, legal review, or pricing changes. Do not use them directly.

Avoid:

```text
Continue
Best Value
No Ads
Privacy Policy
Current Balance
Order History
```

Prefer:

```text
btn_primary_cta
badge_plan_option_02
benefit_item_01
legal_link_secondary
widget_account_balance
order_history
```

## Component Instances

Outer `INSTANCE` names can preserve useful component/source names, but only if they are stable and meaningful.

Useful:

```text
icon_toolbar_back
btn_primary_cta
tab_filter_item_01
component_account_balance
```

Not useful:

```text
Mode=Light
State=Default
Size=Large, Variant=Filled, State=Enabled
hasTopImage=true, buttonCount=one, buttonLayout=horizontal
component_home_03
```

If the instance is a dialog or modal, use the role:

```text
dialog_upgrade_offer
dialog_delete_confirm
sheet_action_menu
```

## Validation Patterns

Flag names that match:

```text
Frame
Rectangle 1
Vector 2
Ellipse 2
Union
Subtract
bounding box
action02
```

Flag old project-specific page terms in descendants. Build this list from the current file by inspecting old root frame names, section names, obvious page labels, and legacy naming patterns. Do not hard-code terms from another project.

Convert old context terms into actual business/control properties such as:

```text
profile
settings
checkout
media
notification
auth
search
empty_state
dialog
sheet
tab
toolbar
```
