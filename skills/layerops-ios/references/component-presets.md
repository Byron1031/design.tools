# iOS HIG 基础组件与图层命名清单

本文档用于把 Apple Human Interface Guidelines 中常见基础组件、系统元素与 iOS 开发命名连接起来，服务于 Figma 图层命名、Swift / SwiftUI / UIKit 属性命名、`accessibilityIdentifier` 与 XCTest。

参考：

- Apple Human Interface Guidelines - Components: https://developer.apple.com/design/human-interface-guidelines/components
- Swift API Design Guidelines: https://www.swift.org/documentation/api-design-guidelines/
- UIKit `accessibilityIdentifier`: https://developer.apple.com/documentation/uikit/uiaccessibilityidentification/accessibilityidentifier
- SwiftUI `accessibilityIdentifier(_:)`: https://developer.apple.com/documentation/swiftui/view/accessibilityidentifier(_:)
- XCTest `XCUIElement.identifier`: https://developer.apple.com/documentation/xctest/xcuielement/identifier

## 命名总则

- iOS 图层建议使用 `lowerCamelCase`，贴近 Swift 属性、变量和 `accessibilityIdentifier`。
- 类型名、SwiftUI View、UIKit ViewController 可从图层名转换为 `UpperCamelCase`。
- 不使用 `/` 表示页面内图层层级；层级由 Figma 嵌套结构表达。
- 不直接复制用户可见文案；把文案转为稳定 UI 角色。
- 组件库或 design system 的 variant 可以保留 `/`，例如 `Button / Primary / Large`；页面实例图层不要用 `/`。

示例：

| 设计图层 | Swift / UIKit / SwiftUI 对应 |
|---|---|
| `profileEditor` | `ProfileEditor`, `ProfileEditorView`, `ProfileEditorViewController` |
| `primaryButton` | `primaryButton`, `accessibilityIdentifier = "primaryButton"` |
| `deleteConfirmDialog` | `DeleteConfirmDialog`, `deleteConfirmDialog` |
| `filterTabItem01` | `filterTabItem01` |

## Navigation / 导航

| HIG 组件 / 元素 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| Navigation bar | `navigationBar` / `primaryNavigationBar` | `UINavigationBar`, SwiftUI `NavigationStack` area | 页面顶部导航区域 |
| Navigation title | `navigationTitleLabel` | title / `.navigationTitle()` | 不复制具体标题文案 |
| Back button | `backButton` / `toolbarBackButton` | `UIBarButtonItem`, SwiftUI toolbar item | 推荐保留角色 |
| Close button | `closeButton` | `UIBarButtonItem`, SwiftUI toolbar item | modal / sheet 常见 |
| Toolbar | `toolbar` / `primaryToolbar` | `UIToolbar`, SwiftUI `.toolbar` | 工具操作区 |
| Tab bar | `tabBar` | `UITabBar`, SwiftUI `TabView` | 底部主导航 |
| Tab item | `tabItem01`, `profileTabItem` | `UITabBarItem`, SwiftUI tab item | 可用业务名或序号 |
| Sidebar | `sidebar` | iPad/macOS sidebar | 大屏导航 |
| Split view | `splitView` | `UISplitViewController`, `NavigationSplitView` | iPad 常见 |
| Status bar | `statusBar` | system status area | 设计占位可命名 |

## Actions / 操作

| HIG 组件 / 元素 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| Button | `primaryButton`, `secondaryButton` | `UIButton`, SwiftUI `Button` | 不用 `Continue` 之类文案 |
| Button label | `primaryButtonLabel` | button title / Text | 子层文本 |
| Icon button | `toolbarBackButton`, `closeButton` | button with image | 按功能命名 |
| Menu | `actionMenu`, `overflowMenu` | `UIMenu`, SwiftUI `Menu` | 操作菜单 |
| Context menu | `contextMenu` | `UIContextMenuInteraction`, SwiftUI `.contextMenu` | 长按/右键菜单 |
| Edit menu | `editMenu` | text/edit commands | 剪切复制等 |
| Pull-down button | `pullDownButton` | pull-down menu button | macOS/iPad 常见 |
| Pop-up button | `popupButton` | pop-up choice control | macOS 常见 |
| Action sheet | `actionSheet` | action sheet / confirmation dialog | 移动端操作列表 |
| Share sheet | `shareSheet` | `UIActivityViewController` | 分享系统界面 |

## Inputs / 输入

| HIG 组件 / 元素 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| Text field | `emailTextField`, `searchTextField` | `UITextField`, SwiftUI `TextField` | 按输入内容角色命名 |
| Secure text field | `passwordTextField` | secure field | 不叫 `hiddenInput` |
| Text view | `messageTextView` | `UITextView`, SwiftUI `TextEditor` | 多行输入 |
| Search field | `searchField` | `UISearchTextField`, `.searchable` | 搜索输入 |
| Picker | `datePicker`, `categoryPicker` | `UIPickerView`, SwiftUI `Picker` | 泛选择器 |
| Date picker | `datePicker` | `UIDatePicker`, SwiftUI `DatePicker` | 日期时间 |
| Color well | `colorWell` | `UIColorWell`, SwiftUI color picker | 颜色选择 |
| Slider | `volumeSlider`, `progressSlider` | `UISlider`, SwiftUI `Slider` | 连续数值 |
| Stepper | `quantityStepper` | `UIStepper`, SwiftUI `Stepper` | 离散数值 |
| Toggle | `notificationsToggle` | `UISwitch`, SwiftUI `Toggle` | 开关 |
| Segmented control | `modeSegmentedControl` | `UISegmentedControl`, SwiftUI segmented Picker | 模式切换 |
| Page control | `onboardingPageControl` | `UIPageControl` | 分页点 |
| Combo box | `filterComboBox` | macOS combo box | iOS 少见 |

## Selection / 选择与筛选

| HIG 组件 / 元素 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| List row | `settingsRow`, `resultItemRow01` | table/list row | 列表项 |
| Collection item | `photoCollectionItem01` | `UICollectionViewCell`, SwiftUI grid item | 网格/瀑布流 |
| Table row | `orderTableRow01` | table row | 表格行 |
| Checkbox-like item | `optionSelectionItem` | custom selection | iOS 通常不是系统 checkbox |
| Selected state | `selectedState` / `selectedIndicator` | state marker | 状态子层 |
| Filter tab | `filterTabItem01` | segmented/tab/filter control | 筛选 tab |

## Presentation / 展示与容器

| HIG 组件 / 元素 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| Alert | `deleteConfirmAlert` | `UIAlertController`, SwiftUI alert | 系统警告 |
| Dialog | `upgradeOfferDialog` | modal/dialog view | 通用弹窗 |
| Sheet | `actionMenuSheet`, `settingsSheet` | sheet / presentation detent | 底部或浮层 |
| Popover | `helpPopover` | `UIPopoverPresentationController`, SwiftUI popover | iPad/macOS 常见 |
| Card | `profileCard`, `planOptionCard01` | custom container | 非 HIG 独立控件但常用 |
| Scroll view | `contentScrollView` | `UIScrollView`, SwiftUI `ScrollView` | 滚动容器 |
| Image view | `avatarImageView`, `previewImageView` | `UIImageView`, SwiftUI `Image` | 图片显示 |
| Map | `locationMapView` | `MKMapView`, SwiftUI `Map` | 地图 |
| Web view | `termsWebView` | `WKWebView` | Web 内容 |
| Chart | `activityChart` | Swift Charts / chart view | 数据图表 |
| Live view | `cameraLiveView` | live/camera preview | 实时预览 |
| Divider | `sectionDivider` | separator view | 分割线 |
| Background | `dialogBackground` | background view/layer | 背景层 |
| Overlay | `modalScrimOverlay` | dim/scrim overlay | 遮罩 |

## Indicators / 指示器

| HIG 组件 / 元素 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| Progress indicator | `loadingProgressIndicator` | `UIProgressView`, SwiftUI `ProgressView` | 确定/不确定进度 |
| Spinner | `loadingSpinner` | activity indicator | 加载中 |
| Gauge | `batteryGauge`, `scoreGauge` | gauge style view | 仪表盘 |
| Rating indicator | `ratingIndicator` | custom rating view | 评分 |
| Badge | `unreadBadge` | badge / custom view | 角标 |

## Text / 文本

| HIG 组件 / 元素 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| Label | `titleLabel`, `subtitleLabel` | `UILabel`, SwiftUI `Text` | 不复制具体文本 |
| Body text | `bodyLabel` | text label | 正文 |
| Caption | `captionLabel` | small text | 辅助说明 |
| Legal link | `primaryLegalLink`, `secondaryLegalLink` | link/button/text | 法务链接按角色 |
| Error text | `errorMessageLabel` | validation/error text | 状态文本 |
| Placeholder | `placeholderLabel` | placeholder | 输入占位 |

## States / 状态

| 状态语义 | 推荐图层名 | 开发侧对应 | 备注 |
|---|---|---|---|
| Empty state | `emptyState` | empty state view | 空状态 |
| Loading state | `loadingState` | loading view/state | 加载 |
| Error state | `errorState` | error view/state | 错误 |
| Success state | `successState` | success view/state | 成功 |
| Disabled state | `disabledState` | disabled UI state | 禁用 |
| Selected state | `selectedState` | selected UI state | 选中 |
| Expanded state | `expandedState` | expanded/collapsed | 展开 |

## 不推荐命名

| 不推荐 | 原因 | 推荐 |
|---|---|---|
| `UploadCard / FirstFrame` | `/` 更像组件库路径，不适合页面实例 | `firstUploadCard` |
| `TopBar / CreateEditor / CurrentMode=AI` | 夹杂层级和变体属性 | `createEditorToolbar`, `modeSegmentedControl` |
| `Continue` | 可见文案会变 | `primaryButton` |
| `Frame 1` | Figma 默认名 | `profileEditor` |
| `Blue Rectangle` | 视觉形状名 | `selectedIndicator` |
