# iOS Guidance

Use this reference when explaining why LayerOps iOS chooses Swift-friendly Figma names or when a design-to-code mapping decision is ambiguous.

## Official Apple And Swift Anchors

- Swift API Design Guidelines emphasize clarity at the point of use, role-based naming, omitting needless words, and avoiding ambiguous or non-standard abbreviations. Types and protocols use `UpperCamelCase`; everything else uses `lowerCamelCase`. Source: https://www.swift.org/documentation/api-design-guidelines/
- UIKit exposes `accessibilityIdentifier` through `UIAccessibilityIdentification` for stable UI automation and testing identifiers. Source: https://developer.apple.com/documentation/uikit/uiaccessibilityidentification/accessibilityidentifier
- SwiftUI provides `accessibilityIdentifier(_:)` to attach an identifier to a view. Source: https://developer.apple.com/documentation/swiftui/view/accessibilityidentifier(_:)
- XCTest exposes `XCUIElement.identifier`, which UI tests can use to locate or inspect elements. Source: https://developer.apple.com/documentation/xctest/xcuielement/identifier
- Apple Human Interface Guidelines help calibrate interface roles, platform terminology, and the boundary between stable UI semantics and user-visible copy. Source: https://developer.apple.com/design/human-interface-guidelines/

## How This Affects LayerOps iOS

- Keep Figma layer names in `lowerCamelCase` so they can map directly to Swift properties and `accessibilityIdentifier` values.
- Convert to `UpperCamelCase` later when creating SwiftUI View, UIKit ViewController, ViewModel, model, or type names.
- Prefer role and business semantics over visible copy:
  - `profileEditor` -> `ProfileEditor`, `ProfileEditorView`, `ProfileEditorViewController`
  - `primaryButton` -> `accessibilityIdentifier = "primaryButton"`
  - `deleteConfirmDialog` -> SwiftUI/UIKit dialog role or XCTest identifier
- Keep names stable across localization and content changes.
