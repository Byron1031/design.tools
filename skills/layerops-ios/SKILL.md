---
name: layerops-ios
description: Rename Figma layers into iOS- and iPadOS-friendly lowerCamelCase business-semantic names, identify Asset Catalog export roots, and preserve valid names on incremental reruns. Aligns with Apple HIG, SwiftUI, UIKit, accessibilityIdentifier, XCTest, and Xcode image resources. Use for iOS Figma frame, page, layer, component, asset naming, or audits.
---

# LayerOps iOS

## Purpose

Rename Figma layers so their structure maps cleanly to iOS and iPadOS implementation, and mark only visual resources that should ship through an Xcode Asset Catalog. Prefer stable business meaning and official UI roles over visible copy, visual descriptions, Figma defaults, framework-specific class names, or inherited page context.

This file is self-contained. Do not depend on optional reference files for component vocabulary or naming decisions.

Always load the `figma-use` skill before any `use_figma` call.

## Official Alignment

Use these sources as the terminology baseline:

- Apple Human Interface Guidelines components: https://developer.apple.com/design/human-interface-guidelines/components/
- SwiftUI and UIKit controls: https://developer.apple.com/documentation/swiftui/controls-and-indicators and https://developer.apple.com/documentation/uikit/views-and-controls
- Swift API Design Guidelines: https://www.swift.org/documentation/api-design-guidelines/
- UIKit accessibility identifiers: https://developer.apple.com/documentation/uikit/uiaccessibilityidentification/accessibilityidentifier
- Xcode image assets: https://developer.apple.com/documentation/xcode/managing-assets-with-asset-catalogs/ and https://developer.apple.com/documentation/xcode/adding-images-to-your-xcode-project
- SF Symbols: https://developer.apple.com/documentation/uikit/configuring-and-displaying-symbol-images-in-your-ui

Apply Apple terminology for iOS and iPadOS. Do not introduce platform-specific component terms from other Apple operating systems into the default vocabulary.

## Mandatory Workflow

1. Inspect the target before changing names.
2. Resolve the requested scope:
   - One frame subtree.
   - A page's direct frames.
   - Direct frames plus frames inside relevant sections.
   - Only unlocked nodes when requested.
3. Count target frames before a page-level or ambiguous operation.
4. Run incremental mode unless the user explicitly asks for a full rewrite.
5. Determine each node's business meaning and actual UI role.
6. Resolve official terminology using the precedence rules below.
7. Inspect every plausible visual resource and classify it as confirmed, candidate, or excluded.
8. Rename roots before descendants and mark only confirmed export roots.
9. Save shared plugin data when supported, then validate and report.

## Scope

- Convert a Figma URL `node-id=123-456` to node ID `123:456`.
- For a `PAGE`, process direct child `FRAME` nodes and direct frames in sections explicitly included by the user.
- For a `FRAME`, process the frame and its accessible descendants.
- For "unlocked only", skip locked nodes and descendants of locked ancestors.
- Rename the outer instance when needed, but do not detach an instance to reach inaccessible internals.

## Incremental Reruns

Reruns must avoid name churn after designers add or change layers.

- Preserve an existing name that passes casing, semantic, role, and context validation.
- Preserve a node marked with LayerOps iOS shared data unless it is now invalid.
- Rename new, untagged, default-named, or non-compliant nodes.
- Correct a casing-valid name when its UI role is wrong or overly generic.
- Correct deprecated, non-iOS, visible-copy, variant-property, and page-context names.
- Add an asset marker to a newly confirmed export root that lacks one.
- Remove stale asset markers and export metadata from placeholders, previews, runtime content, or other hard exclusions.
- Do not promote an ambiguous candidate without stronger evidence.
- Preserve a manually improved valid name even when another valid synonym exists.
- Use full rewrite mode only when explicitly requested.

Correct casing-valid names when their roles are wrong, such as `deleteConfirmDialog` to `deleteConfirmAlert`, `photoCell03` to `photoCollectionItem03`, or `backIcon` to `toolbarBackSymbol`.

When supported:

```js
node.setSharedPluginData('layeropsIos', 'processed', '1')
node.setSharedPluginData('layeropsIos', 'name', node.name)
```

Use shared plugin data only. `use_figma` does not support `getPluginData` or `setPluginData`.

## Naming Grammar

Use:

```text
[businessMeaning][officialUiRole][twoDigitIndex]
```

Rules:

- Use `lowerCamelCase`.
- Names must match `^[a-z][A-Za-z0-9]*$`.
- Start with business meaning when it is known: `profileImageView`, `saveButton`.
- End with the canonical UI role: `Button`, `ListRow`, `CollectionItem`, `Alert`.
- Add a two-digit index only for repeated peers without a stable semantic distinction.
- Prefer semantic siblings over indices: `homeTabItem`, `searchTabItem`.
- When indices are necessary, use `01`, `02`, `03`.
- Do not use spaces, underscores, hyphens, or `/`.
- Figma hierarchy expresses nesting; layer names do not repeat the full path.
- Do not encode transient style, color, size, mode, or variant properties in page-instance names.

`/` may remain in a design-system component source name, but not in a page-instance layer name.

Confirmed export roots use the asset protocol defined below and are the only exception to the ordinary-name regex.

## Root Frames

Name roots by feature, task, or state. Do not prefix roots with `screen`, and do not append implementation types such as `View` or `ViewController`.

Use names such as `profileEditor`, `checkoutSummary`, `mediaPicker`, `searchResults`, and `settingsEmptyState`. Avoid `screenProfileEditor`, `profileEditorView`, `settingsViewController`, or visible labels such as `Home`.

## Naming Precedence

When multiple names seem plausible, resolve them in this order:

1. Actual user-facing function or business meaning.
2. Official iOS or iPadOS UI role.
3. Stable cross-framework implementation mapping.
4. Local structural role.
5. Visual construction only when no functional role exists.

Do not name a button after its background rectangle, a list row after its visible title, or a sheet after the page that contains it.

## Visible Copy

Visible strings are content and can change through localization, experiments, pricing, legal review, or server data. Never copy them directly into layer names.

Convert copy to a stable role, such as `Continue` to `primaryButton`, `Best Value` to `recommendedPlanBadge`, or `No Results` to `searchEmptyState`. Name text children by role, such as `primaryButtonLabel`, `alertTitleLabel`, or `supportingTextLabel`.

## Terminology Boundaries

### Alert, Action Sheet, Sheet, And Popover

- Use `Alert` for system-style critical information, warnings, and confirmation.
- Use `ActionSheet` for choices related to an intentional action.
- Use `Sheet` for a focused task or temporary presented workflow.
- Use `Popover` for temporary contextual content in a wide iPad layout.
- Use `FullScreenCover` for an immersive or complex full-screen presentation.
- Reserve `Dialog` for a clearly custom dialog component that is not one of the standard presentation roles.

Disambiguate by behavior:

- `deleteConfirmAlert` blocks for a critical confirmation.
- `messageActionSheet` presents a compact set of action choices.
- `actionMenuSheet` is a task sheet whose content includes an action menu.
- `shareSheet` invokes the system sharing experience.
- `helpPopover` presents contextual help on a wide layout.
- Do not rename all five roles to `Dialog`.

### Navigation Bar And Toolbar

- Use `NavigationBar` for the visible navigation context, title, back navigation, and destination-level controls.
- Use `Toolbar` for a collection of actions that operate on the current content.
- Use `ToolbarItem` for one item placed in a toolbar.
- Use `NavigationStack` for a one-column push navigation container.
- Use `NavigationSplitView` for a two- or three-column iPad navigation container.
- Use `NavigationLink` for a control that presents a navigation destination.

### Tab View, Tab Bar, And Tab Item

- Use `TabView` for the navigation container that switches child views.
- Use `TabBar` for the visible bar.
- Use `TabItem` for an individual destination.
- Use tabs for navigation, not for actions.

### List, Table, And Collection

- Use `List` for a row-based content hierarchy.
- Use `ListSection` for a grouped portion of a list.
- Use `ListRow` for one list row.
- Use `TableView` only when the design is explicitly a table-oriented view.
- Use `CollectionView` for an image-rich or custom-layout collection.
- Use `CollectionItem` for one collection or grid item.
- Do not use framework-specific `Cell` as the default Figma role.

### Symbol, Icon, And Image View

- Use `Symbol` for an SF Symbol or system-provided symbol.
- Use `Icon` for a custom interface icon or custom glyph.
- Use `ImageView` for a view whose primary purpose is displaying content imagery.
- Use `ThumbnailImageView` for small preview imagery.
- A clickable symbol or image belongs inside a `Button`; do not make an image view behave like a button.

### Toggle And Selection

- Use `Toggle` for an on/off control across SwiftUI and UIKit.
- Use `SegmentedControl` for a small set of mutually exclusive modes.
- Use `Picker` for choosing one value from a medium or long set.
- Use `SelectedIndicator` for a visual selection marker.

## Core Component Presets

Use these canonical roles before inventing a new component term. Add a business qualifier and optional index as needed.

### Navigation And Search

| UI role | Canonical examples | SwiftUI / UIKit mapping |
|---|---|---|
| Navigation stack | `settingsNavigationStack` | `NavigationStack`, navigation controller |
| Navigation split view | `libraryNavigationSplitView` | `NavigationSplitView`, split view controller |
| Navigation bar | `primaryNavigationBar` | navigation bar / toolbar title area |
| Toolbar | `editorToolbar` | toolbar |
| Toolbar item | `shareToolbarItem` | toolbar item / bar button item |
| Navigation link | `profileNavigationLink` | `NavigationLink`, navigation action |
| Tab view | `mainTabView` | `TabView`, tab controller |
| Tab bar | `mainTabBar` | tab bar |
| Tab item | `homeTabItem` | tab content / tab bar item |
| Sidebar | `librarySidebar` | sidebar column |
| Search field | `contentSearchField` | searchable field / search text field |
| Search token | `filterSearchToken` | search token |
| Search suggestion | `recentSearchSuggestion` | search suggestion |
| Search results | `searchResults` | results container |
| Page control | `onboardingPageControl` | page indicator control |

### Lists, Collections, And Layout

| UI role | Canonical examples | SwiftUI / UIKit mapping |
|---|---|---|
| List | `settingsList` | `List`, table view |
| List section | `accountListSection` | `Section`, table section |
| List row | `settingsListRow` | list row / table row |
| Section header | `settingsSectionHeader` | section header |
| Section footer | `settingsSectionFooter` | section footer |
| Table view | `comparisonTableView` | table |
| Table row | `comparisonTableRow01` | table row |
| Collection view | `photoCollectionView` | collection / grid |
| Collection item | `photoCollectionItem01` | collection item |
| Grid | `mediaGrid` | grid layout |
| Scroll view | `contentScrollView` | scroll view |
| Content stack | `formContentStack` | stack layout |
| Container | `contentContainer` | generic container |
| Disclosure group | `advancedOptionsDisclosureGroup` | disclosure group |
| Split view | `contentSplitView` | adaptive panes |
| Safe-area background | `safeAreaBackground` | safe-area background layer |

### Actions And Menus

| UI role | Canonical examples |
|---|---|
| Primary button | `primaryButton`, `saveButton` |
| Secondary button | `secondaryButton` |
| Cancel button | `cancelButton` |
| Destructive button | `destructiveButton`, `deleteButton` |
| Icon button | `toolbarBackButton`, `closeButton` |
| Button label | `primaryButtonLabel` |
| Menu | `actionMenu`, `overflowMenu` |
| Menu item | `actionMenuItem01` |
| Context menu | `itemContextMenu` |
| Share button | `shareButton` |

Apple button roles are semantic. Do not encode only visual treatment such as filled, blue, rounded, or large when the action role is known.

### Input And Selection

| UI role | Canonical examples |
|---|---|
| Text field | `emailTextField` |
| Secure text field | `passwordSecureTextField` |
| Text editor | `messageTextEditor` |
| Search field | `contentSearchField` |
| Picker | `categoryPicker` |
| Date picker | `scheduleDatePicker` |
| Color picker | `themeColorPicker` |
| Photo picker | `profilePhotoPicker` |
| Segmented control | `editorModeSegmentedControl` |
| Slider | `volumeSlider` |
| Stepper | `quantityStepper` |
| Toggle | `notificationsToggle` |
| Digit entry view | `verificationDigitEntryView` |
| Selected indicator | `selectedIndicator` |

### Presentation

| UI role | Canonical examples |
|---|---|
| Alert | `deleteConfirmAlert` |
| Action sheet | `messageActionSheet` |
| Sheet | `settingsSheet` |
| Popover | `helpPopover` |
| Full-screen cover | `mediaEditorFullScreenCover` |
| Modal scrim | `modalScrimOverlay` |
| Activity view | `shareActivityView` |
| Share sheet | `shareSheet` |

### Status And Feedback

| UI role | Canonical examples |
|---|---|
| Progress view | `uploadProgressView` |
| Activity indicator | `loadingActivityIndicator` |
| Gauge | `storageGauge` |
| Rating indicator | `ratingIndicator` |
| Badge | `unreadBadge` |
| Page control | `onboardingPageControl` |
| Empty state | `searchEmptyState` |
| Loading state | `contentLoadingState` |
| Error state | `networkErrorState` |
| Success state | `saveSuccessState` |
| Disabled state | `disabledState` |
| Selected state | `selectedState` |
| Expanded state | `expandedState` |

### Text, Images, And Rich Content

| UI role | Canonical examples |
|---|---|
| Title label | `titleLabel`, `navigationTitleLabel` |
| Subtitle label | `subtitleLabel` |
| Body label | `bodyLabel` |
| Caption label | `captionLabel` |
| Supporting text | `supportingTextLabel` |
| Error message | `errorMessageLabel` |
| Legal link | `primaryLegalLink` |
| Image view | `profileImageView` |
| Thumbnail image | `templateThumbnailImageView` |
| Symbol | `toolbarBackSymbol` |
| Custom icon | `customBrandIcon` |
| Map view | `locationMapView` |
| Web view | `termsWebView` |
| Chart | `activityChart` |
| Video player | `previewVideoPlayer` |
| Camera preview | `cameraPreview` |

## Accessibility And Testing

Layer names can provide stable candidates for `accessibilityIdentifier` and XCTest identifiers:

```text
primaryButton -> accessibilityIdentifier("primaryButton")
profileImageView -> accessibilityIdentifier("profileImageView")
homeTabItem -> accessibilityIdentifier("homeTabItem")
```

Keep these concepts separate:

- `accessibilityIdentifier` is a stable, non-visible identifier used by automation and testing.
- `accessibilityLabel` is user-facing accessibility content and may be localized.
- Never use a localized accessibility label or visible string as the Figma layer name.
- Do not assume every decorative child needs an identifier.
- Prefer the meaningful interactive or composite root as the testable element.
- Internal shape names should describe structure, not create redundant test identifiers.

## Component Instances

An outer `INSTANCE` may keep its source name only when the name is stable, semantic, and useful to implementation. Otherwise rename it by actual function.

Preserve semantic names such as `primaryButton`, `toolbarBackButton`, or `deleteConfirmAlert`. Replace variant strings such as `State=Default`, `Size=Large, Variant=Filled`, or `hasTopImage=true`.

Rules:

- Rename a system-symbol instance by its function and `Symbol` role.
- Rename a clickable wrapper as `Button`, not `Symbol` or `ImageView`.
- Rename a standard modal instance using its actual presentation role.
- Preserve inaccessible instance internals and report them instead of detaching.

## Common Structural Roles

Use these only when a more specific official component role does not apply:

- Layout: `Container`, `Stack`, `Section`.
- Regions: `Header`, `Footer`, `Background`, `Overlay`.
- Elements: `Divider`, `Indicator`, `Placeholder`.
- Reusable fallback: `Component`.

Do not use `Container`, `Component`, or `Widget` when the node is clearly a list, toolbar, alert, button, sheet, or another official role.

## Asset Catalog Export

Use `asset_{xcodeAssetName}__{format}` only when implementation should download the Figma node and place it in an Xcode Asset Catalog.

- Asset roots must match `^asset_[a-z][A-Za-z0-9]*__(svg|pdf|png|jpg)$`.
- The body is the final descriptive `lowerCamelCase` Asset Catalog name.
- Strip `asset_` and the format suffix before code use.
- Example: `asset_emptyStateIllustration__svg` becomes `ImageResource.emptyStateIllustration`.
- Do not encode `1x`, `2x`, or `3x`; LayerOps records format, not scale delivery.

### Decision Process

Do not infer asset intent from a name or node type alone. Inspect node type, bounds, fills, effects, masks, export settings, component relationship, children, text, controls, surrounding UI, content ownership, and whether an ancestor is already an export root.

Apply this precedence:
1. Node-specific user override.
2. Hard exclusion.
3. Existing technical confirmation: export settings, valid LayerOps metadata, or a valid asset marker.
4. Clear non-component static-resource evidence.
5. Candidate when ownership or reuse remains uncertain.

A page-level renaming request is not an override for every descendant. Hard exclusions override stale export settings, metadata, and existing asset names.

Hard exclusions unless the user overrides the specific node:

- System SF Symbols and shared icon or UI component instances that map to code.
- Standard SwiftUI/UIKit controls, bars, rows, sheets, alerts, buttons, badges, and text.
- User avatars, uploads, feed or product photos, network/CMS media, and generated runtime images.
- Placeholders, skeletons, replaceable media slots, template or preset previews, sample thumbnails, demo content, and catalog previews.
- Device chrome, keyboards, status bars, home indicators, and mockup frames.
- Ordinary layout frames or groups and code-renderable fills, gradients, borders, dividers, scrims, and shadows.
- A child of a confirmed asset root unless it is independently reused and explicitly exported.
- An App Icon unless the user explicitly requests App Icon handling.

Confirm when no exclusion applies:

- A complete non-component custom icon, logo, wordmark, illustration, decoration, badge, or fixed visual background.
- A static image that ships in the app bundle and does not change independently of an app release.
- A non-component `FRAME` whose descendants form one complete reusable visual and contain no controls, navigation, list structure, or localized content.
- Existing export settings or LayerOps metadata that agree with the semantic role.

Repeated similarly sized images in a picker, list, grid, carousel, template catalog, or replaceable content area are preview/runtime content by default. If fixed artwork cannot be distinguished from preview or runtime content, keep an ordinary semantic name and report it as a candidate without adding `asset_`.

### Symbols, Variants, And Boundaries

- A system symbol keeps a UI name such as `toolbarBackSymbol` and is not exported.
- A normal custom icon uses a marker such as `asset_toolbarMagicIcon__svg`.
- Treat a node as a Custom Symbol asset only when the user confirms it follows the SF Symbols custom-symbol workflow; an arbitrary Figma vector is not enough.
- Do not append `dark`, `light`, `iPhone`, language, or scale to the base Xcode asset name.
- If appearance, device, or localization variants cannot be mapped safely to Asset Catalog slots, report the set as a candidate and do not flatten or auto-mark it.
- Export the smallest complete reusable visual. For composed artwork, prefer a bounded outer `FRAME`, mark only that root, and keep its children as ordinary semantic layers.

### Format Selection

| Confirmed resource | Marker |
|---|---|
| Custom icon, logo, badge, or vector illustration | `asset_toolbarMagicIcon__svg`, `asset_brandLogo__svg` |
| Explicit PDF vector delivery | `asset_brandLogo__pdf` |
| Transparent or effect-heavy bitmap artwork | `asset_upgradeHeaderDecoration__png` |
| Opaque photo or photographic background | `asset_onboardingBackground__jpg` |

SVG is the default vector format. Use PDF only when the user or project explicitly requires it. Use PNG for transparency or exact compositing and JPG for opaque photographic content.

For a confirmed asset root, save shared metadata when supported:

```js
node.setSharedPluginData('layeropsIos', 'export', '1')
node.setSharedPluginData('layeropsIos', 'asset_kind', assetKind)
node.setSharedPluginData('layeropsIos', 'export_format', format)
node.setSharedPluginData('layeropsIos', 'xcode_asset_name', xcodeAssetName)
```

When removing a stale marker, set `export` to `0` and clear `asset_kind`, `export_format`, and `xcode_asset_name`.

## Validation

Validate after renaming:

- Every ordinary processed name matches `^[a-z][A-Za-z0-9]*$`.
- Every confirmed asset root matches `^asset_[a-z][A-Za-z0-9]*__(svg|pdf|png|jpg)$`.
- Removing the marker yields a valid, descriptive Xcode name that can map to `ImageResource.<name>`.
- Candidates and exclusions have no asset marker or export metadata.
- System Symbols, placeholders, previews, and runtime images are never marked automatically.
- Asset children do not repeat the marker unless separately reused and explicitly exported.
- Ordinary names do not contain `__svg`, `__pdf`, `__png`, or `__jpg`.
- Root frames do not start with `screen` or end with implementation-type suffixes.
- Repeated peers use two-digit indices only when semantic names are unavailable.
- Figma defaults are gone: `Frame`, `Rectangle 1`, `Vector 2`, `Ellipse 2`, `Union`, `Subtract`, `bounding box`, `action02`.
- Spaces, underscores, hyphens, and `/` are absent from page-instance names.
- Visible and localized copy is not copied into names.
- Component variant-property strings are gone.
- Descendants do not inherit page names as context filler.
- Standard presentation roles use `Alert`, `ActionSheet`, `Sheet`, or `Popover` correctly.
- Tab, navigation, list, collection, symbol, icon, image, and toggle terms follow their boundaries.
- Non-iOS component terminology is absent.
- Inaccessible component internals are reported separately.

Build the project-context leak list dynamically from old root names, section names, obvious page labels, and legacy patterns in the current file. Never hard-code terms from another project.

Report target section/frame counts; checked, renamed, preserved, inaccessible, role-correction, invalid/default/copy/context-leak, and component-instance counts. Separately report confirmed, candidate, excluded, added, and removed asset-marker counts.

## Required Conversion Checks

Use these examples to verify the implementation:

```text
Continue -> primaryButton
Rectangle 1 inside a settings list -> settingsListRow
Clickable wrapper around the back symbol -> toolbarBackButton
Grid template item -> templateCollectionItem01
iPad two-column navigation -> navigationSplitView
Delete confirmation modal -> deleteConfirmAlert
Action choices modal -> actionMenuActionSheet
System back SF Symbol -> toolbarBackSymbol
Non-component custom icon -> asset_toolbarMagicIcon__svg
Empty-state illustration frame -> asset_emptyStateIllustration__svg
Explicit PDF vector logo -> asset_brandLogo__pdf
Transparent header decoration -> asset_upgradeHeaderDecoration__png
Opaque onboarding photo -> asset_onboardingBackground__jpg
Template preview -> templateThumbnailImageView
Profile avatar loaded at runtime -> profileImageView
```

## Figma Execution

- Call `await figma.setCurrentPageAsync(page)` once per `use_figma` invocation.
- Return all tool output explicitly.
- Return every mutated node ID.
- Use safe property helpers because instance internals can throw `node_not_found`.
- A failed `use_figma` script is atomic; inspect the error, fix it, and rerun.
- Rename text nodes without editing `characters` or loading fonts.
- Use `setSharedPluginData` and `getSharedPluginData` with namespace `layeropsIos`.
