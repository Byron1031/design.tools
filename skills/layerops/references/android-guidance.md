# Android Guidance

Use this reference when explaining why LayerOps chooses Android-friendly Figma names or when a design-to-code mapping decision is ambiguous.

## Official Android Anchors

- Android resources are referenced through the generated `R` class. A resource ID is composed of the resource type and resource name; the resource name is the filename without extension or an XML `android:name` value. Source: https://developer.android.com/guide/topics/resources/providing-resources
- View IDs are assigned in XML with strings such as `android:id="@+id/my_button"` and are used to identify views in the tree and reference them from code as `R.id.my_button`. Source: https://developer.android.com/develop/ui/views/layout/declaring-layout
- Kotlin package names are lowercase without underscores; class/type names use PascalCase; functions/properties use camelCase; Unit-returning `@Composable` functions are PascalCase nouns. Source: https://developer.android.com/kotlin/style-guide
- Android UI state classes are named by functionality plus `UiState`, such as `NewsUiState`. The UI layer displays state and relays user events. Source: https://developer.android.com/topic/architecture/ui-layer
- Compose tests interact with nodes in the semantics tree through finders, assertions, and actions, so stable semantic/test-tag-friendly names are useful. Source: https://developer.android.com/develop/ui/compose/testing/apis

## How This Affects LayerOps

- Keep Figma layer names in `lower_snake_case` so they can map directly to `R.id.*`, resource names, and test tags.
- Do not use Kotlin class/function casing as the Figma layer naming style. Convert later when creating code symbols.
- Prefer functionality and UI role over visible copy:
  - `profile_editor` -> `ProfileEditor`, `ProfileEditorUiState`, `R.id.profile_editor`
  - `btn_save` -> `R.id.btn_save` or `Modifier.testTag("btn_save")`
  - `dialog_delete_confirm` -> dialog composable or dialog destination semantics
- Keep names stable across localization and content changes.
