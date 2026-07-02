# Naming Rules

## Core Principles

- Use `lowerCamelCase`.
- Use business/control meaning, not visual shape.
- Do not copy visible UI text, marketing strings, legal copy, prices, user-facing labels, or localized terms.
- Root frame names do not use `screen`.
- Descendant names do not use page names as context filler.
- Prefer names that iOS developers can map to Swift properties, SwiftUI View names, UIKit view references, `accessibilityIdentifier`, and XCTest identifiers.
- Reruns are incremental by default: preserve existing valid names and only change new or non-compliant layers.

## iOS Alignment

LayerOps iOS names should be compatible with iOS implementation surfaces:

- Keep Figma layer names in `lowerCamelCase` because that maps cleanly to Swift properties, variables, methods, and `accessibilityIdentifier` string values.
- Convert to `UpperCamelCase` when implementing SwiftUI View, UIKit view controller, or model type names: `profileEditor` can map to `ProfileEditor`, `ProfileEditorView`, `ProfileEditorViewController`, and `ProfileEditorViewModel`.
- Name roots by feature/module state, not by the word `screen`: `profileEditor`, `checkoutSummary`, `settingsPanel`.
- Name descendants by local UI role: `primaryToolbar`, `filterTabItem01`, `saveButton`, `resultItemRow03`, `deleteConfirmDialog`.
- State semantics should follow functionality. If a design region represents a state, encode that role: `emptyState`, `loadingState`, `errorState`, `successState`.

## Neutral Examples Only

The skill must stay generic across iOS projects.

- Do not keep source-project page names, product-specific terms, experiment names, or one-off business strings in examples.
- Use neutral product semantics such as `profile`, `settings`, `checkout`, `media`, `notification`, `auth`, `search`, `emptyState`, `dialog`, `sheet`, `tab`, `toolbar`, `list`, and `detail`.
- Validation should find project-specific page terms dynamically from the current file, not from a hard-coded source-project word list.

## Incremental Naming

When LayerOps iOS is run again after new layers are added:

- Keep existing names that already pass all rules.
- Keep names with `layeropsIos` shared plugin data unless they have become invalid or the user asks for a full rewrite.
- Change new layers that still look like Figma defaults, copied visible strings, or old project-context names.
- Do not churn names just because a slightly better alternative exists.
- Report how many layers were preserved vs renamed.

Useful shared plugin data:

```text
namespace: layeropsIos
processed: 1
name: <last LayerOps iOS name>
```

Default/non-compliant names should still be renamed even if unmarked.

## Common Suffixes And Roles

For a broader HIG / iOS component name preset, load `component-presets.md` before inventing names for common UI controls.

| Pattern | Use |
|---|---|
| `Container` | Layout container |
| `Toolbar` | Top app bar or tool strip |
| `Tab` / `TabBar` | Tab item or tab container |
| `Button` | Clickable action |
| `Label` | Text node |
| `ImageView` / `Image` | Image/media |
| `Icon` | Icon or vector |
| `Card` | Card region |
| `Row` | List row or horizontal item |
| `Dialog` | Modal/dialog root |
| `Sheet` | Bottom/action sheet root |
| `Overlay` | Scrim/dim overlay |
| `Background` | Background layer |
| `Divider` | Divider line |
| `Badge` | Badge/chip |
| `Slot` | Component slot |
| `Component` | Component instance with no more specific role |
| `Widget` | Reusable standalone widget |
| `Section` | Figma section container |

## Root Frame Names

Use direct business module/state names:

```text
profileEditor
profileEditorEmptyState
settingsPanel
checkoutSummary
mediaPicker
searchResults
authSignIn
upgradeDialog
notificationPermissionSheet
```

Do not use:

```text
screenProfileEditor
Home
Settings
Upgrade Now
Continue
```

## Avoid Project-Context Filler

Descendants should say what they are, not only where they live.

Avoid:

```text
homeComponent03
dashboardIcon01
settingsPageContainer02
upgradePageLabel01
```

Prefer:

```text
upgradeOfferDialog
accountBalanceIcon
settingsGroupContainer
upgradeLabel01
```

Root frame names may identify the feature/module, but child names should use local roles: `Dialog`, `Tab`, `Toolbar`, `Row`, `Card`, `Button`, `Profile`, `Settings`, `Checkout`, `Media`, `Search`, etc.

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
primaryButton
planOptionBadge02
benefitItem01
secondaryLegalLink
accountBalanceWidget
orderHistory
```

## Component Instances

Outer `INSTANCE` names can preserve useful component/source names, but only if they are stable and meaningful.

Useful:

```text
toolbarBackIcon
primaryButton
filterTabItem01
accountBalanceComponent
```

Not useful:

```text
Mode=Light
State=Default
Size=Large, Variant=Filled, State=Enabled
hasTopImage=true, buttonCount=one, buttonLayout=horizontal
homeComponent03
```

If the instance is a dialog or modal, use the role:

```text
upgradeOfferDialog
deleteConfirmDialog
actionMenuSheet
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
emptyState
dialog
sheet
tab
toolbar
```
