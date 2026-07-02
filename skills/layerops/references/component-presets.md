# Android Material Design 基础组件与图层命名清单

本文档用于把 Material Design / Material 3 中常见基础组件、系统元素与 Android 开发命名连接起来，服务于 Figma 图层命名、View ID、Compose test tag、资源命名和 UI state。

参考：

- Material Design 3 - Components: https://m3.material.io/components
- Material Design 2 - Components: https://m2.material.io/components
- Android App resources: https://developer.android.com/guide/topics/resources/providing-resources
- Android View layout IDs: https://developer.android.com/develop/ui/views/layout/declaring-layout
- Android Compose testing APIs: https://developer.android.com/develop/ui/compose/testing/apis
- Android UI layer: https://developer.android.com/topic/architecture/ui-layer

## 命名总则

- Android 图层建议使用 `lower_snake_case`，贴近 `@+id/...`、资源名和 Compose `testTag`。
- 根 frame 不使用 `screen_`，直接使用业务模块名，例如 `profile_editor`。
- 不使用 `/` 表示页面内图层层级；层级由 Figma 嵌套表达。
- 不直接复制用户可见文案；把文案转为稳定 UI 角色。
- 组件库或 design system 的 variant 可以保留 `/`，例如 `Button / Filled / Large`；页面实例图层不要用 `/`。

示例：

| 设计图层 | Android 对应 |
|---|---|
| `profile_editor` | `R.id.profile_editor`, `Modifier.testTag("profile_editor")` |
| `btn_primary_cta` | `R.id.btn_primary_cta` |
| `dialog_delete_confirm` | dialog composable / dialog view |
| `tab_filter_item_01` | tab item / test tag |

## Actions / 操作组件

| Material 组件 / 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Button | `btn_primary`, `btn_secondary` | Button / MaterialButton / Compose Button | 泛按钮 |
| Filled button | `btn_primary_filled` | Filled button | 主操作 |
| Filled tonal button | `btn_secondary_tonal` | tonal button | 次级强调 |
| Outlined button | `btn_secondary_outlined` | outlined button | 次级操作 |
| Text button | `btn_text_action` | text button | 低强调 |
| Elevated button | `btn_elevated_action` | elevated button | 有阴影强调 |
| Icon button | `btn_icon_toolbar_back` | IconButton | 图标按钮 |
| Floating action button | `fab_primary` | FloatingActionButton | 浮动主操作 |
| Extended FAB | `fab_extended_primary` | ExtendedFloatingActionButton | 带文字 FAB |
| Segmented button | `segmented_mode_control` | SegmentedButton | 模式切换 |

## Navigation / 导航组件

| Material 组件 / 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Top app bar | `top_app_bar`, `toolbar_primary` | TopAppBar / Toolbar | 顶部栏 |
| Center-aligned top app bar | `top_app_bar_center_aligned` | CenterAlignedTopAppBar | 居中标题 |
| Medium top app bar | `top_app_bar_medium` | MediumTopAppBar | 中尺寸 |
| Large top app bar | `top_app_bar_large` | LargeTopAppBar | 大标题 |
| Bottom app bar | `bottom_app_bar` | BottomAppBar | 底部操作栏 |
| Navigation bar | `bottom_navigation_bar` | NavigationBar | 底部主导航 |
| Navigation bar item | `bottom_navigation_item_01` | NavigationBarItem | 底部项 |
| Navigation rail | `navigation_rail` | NavigationRail | 平板/大屏 |
| Navigation rail item | `navigation_rail_item_01` | NavigationRailItem | 大屏导航项 |
| Navigation drawer | `navigation_drawer` | ModalNavigationDrawer / drawer | 侧边抽屉 |
| Navigation drawer item | `navigation_drawer_item_01` | NavigationDrawerItem | 抽屉项 |
| Tabs | `tab_bar` | TabRow / ScrollableTabRow | tab 容器 |
| Tab item | `tab_filter_item_01` | Tab | tab 项 |

## Inputs / 输入组件

| Material 组件 / 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Text field | `text_field_email`, `text_field_search` | TextField / EditText | 输入框 |
| Outlined text field | `text_field_email_outlined` | OutlinedTextField | 描边输入 |
| Filled text field | `text_field_email_filled` | TextField filled | 填充输入 |
| Search bar | `search_bar` | SearchBar | 搜索入口 |
| Search view | `search_view` | SearchView | 搜索展开视图 |
| Checkbox | `checkbox_terms` | Checkbox | 多选 |
| Radio button | `radio_option_01` | RadioButton | 单选 |
| Switch | `switch_notifications` | Switch | 开关 |
| Slider | `slider_volume` | Slider | 连续数值 |
| Range slider | `slider_price_range` | RangeSlider | 范围 |
| Date picker | `date_picker` | DatePicker | 日期 |
| Time picker | `time_picker` | TimePicker | 时间 |

## Selection / 筛选与选择

| Material 组件 / 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Chip | `chip_filter_01` | Chip | 通用 chip |
| Assist chip | `chip_assist_01` | AssistChip | 辅助操作 |
| Filter chip | `chip_filter_01` | FilterChip | 筛选 |
| Input chip | `chip_input_01` | InputChip | 输入 token |
| Suggestion chip | `chip_suggestion_01` | SuggestionChip | 推荐 |
| List item | `row_list_item_01` | ListItem / Recycler item | 列表项 |
| Menu item | `menu_item_01` | DropdownMenuItem | 菜单项 |
| Selected indicator | `selected_indicator` | selection indicator | 选中态 |

## Containment / 容器组件

| Material 组件 / 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Card | `card_content`, `card_plan_option_01` | Card / MaterialCardView | 卡片 |
| Elevated card | `card_elevated_content` | ElevatedCard | 高程卡片 |
| Filled card | `card_filled_content` | FilledCard | 填充卡片 |
| Outlined card | `card_outlined_content` | OutlinedCard | 描边卡片 |
| Dialog | `dialog_delete_confirm` | Dialog / AlertDialog | 弹窗 |
| Alert dialog | `dialog_alert` | AlertDialog | 警告弹窗 |
| Full-screen dialog | `dialog_fullscreen_editor` | full-screen dialog | 全屏弹窗 |
| Bottom sheet | `sheet_action_menu` | ModalBottomSheet | 底部弹层 |
| Side sheet | `sheet_side_filter` | SideSheet | 侧边弹层 |
| Divider | `divider_section` | Divider / View | 分割线 |
| Carousel | `carousel_media` | Carousel | 轮播 |

## Communication / 反馈与提示

| Material 组件 / 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Badge | `badge_unread` | Badge | 角标 |
| Progress indicator | `progress_loading` | ProgressIndicator | 进度 |
| Linear progress indicator | `progress_linear_loading` | LinearProgressIndicator | 线性 |
| Circular progress indicator | `progress_circular_loading` | CircularProgressIndicator | 圆形 |
| Snackbar | `snackbar_feedback` | Snackbar | 底部反馈 |
| Tooltip | `tooltip_help` | Tooltip | 悬浮说明 |

## Text / 文本与标签

| Material / Android 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Text | `tv_title`, `tv_body` | TextView / Compose Text | 传统 View 可用 `tv_` |
| Label | `tv_input_label` | label / Text | 输入标签 |
| Supporting text | `tv_supporting_text` | supporting text | 辅助说明 |
| Error text | `tv_error_message` | error text | 错误 |
| Placeholder | `tv_placeholder` | hint / placeholder | 占位 |
| Link text | `tv_legal_link_primary` | clickable text | 法务/链接 |

## Icons / 图片与图标

| 元素 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Icon | `icon_toolbar_back` | ImageVector / drawable | 图标 |
| Leading icon | `icon_leading` | leading icon | 输入/列表左侧 |
| Trailing icon | `icon_trailing` | trailing icon | 输入/列表右侧 |
| Image | `iv_avatar`, `iv_preview` | ImageView / Compose Image | 图片 |
| Thumbnail | `iv_thumbnail` | thumbnail image | 缩略图 |
| Logo | `logo_brand` | drawable / image asset | 品牌 |

## States / 状态

| 状态语义 | 推荐图层名 | Android 对应 | 备注 |
|---|---|---|---|
| Empty state | `empty_state` | empty state UI | 空状态 |
| Loading state | `loading_state` | loading UI | 加载 |
| Error state | `error_state` | error UI | 错误 |
| Success state | `success_state` | success UI | 成功 |
| Disabled state | `disabled_state` | disabled UI state | 禁用 |
| Selected state | `selected_state` | selected UI state | 选中 |
| Expanded state | `expanded_state` | expanded/collapsed | 展开 |

## 不推荐命名

| 不推荐 | 原因 | 推荐 |
|---|---|---|
| `UploadCard / FirstFrame` | `/` 更像组件库路径，不适合页面实例 | `card_upload_item_01` 或 `upload_card_first_frame` |
| `TopBar / CreateEditor / CurrentMode=AI` | 夹杂层级和变体属性 | `top_app_bar`, `segmented_mode_control` |
| `Continue` | 可见文案会变 | `btn_primary_cta` |
| `Frame 1` | Figma 默认名 | `media_picker` |
| `Blue Rectangle` | 视觉形状名 | `selected_indicator` |
