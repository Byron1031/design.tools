# Distill 提取规则 README

这份文档记录 Distill Figma 插件当前的提取、匹配、命名、审核、提交规则。

## 核心流程

Distill 采用安全的四阶段流程：

1. 用户点击「提取候选」。
2. 插件自动检测已有设计库，并从当前选区提取候选项。
3. 用户审核、重命名、勾选新增 token。
4. 按组手动提交：Colors、Typography、Radius。

预览阶段不创建变量、不创建文字样式、不绑定图层。只有用户点击某个分组的提交按钮后，插件才会改动当前 Figma 文件。

提取结果与当时的直接选区绑定。用户在审核期间改变选区后，旧候选会立即失效，必须重新点击「提取候选」，避免把旧候选绑定到新的图层。

提交前插件会再次检测设计库。如果候选状态或目标名称因为 Undo、Redo、手动编辑或其他插件操作发生变化，本次提交会停止，并要求用户审核刷新后的候选。

## 设计库检测

插件会检测本地资源和已引用的库资源。

本地资源包括：

- 本地 variable collections。
- 本地 variables。
- 本地 text styles。
- 本地组件和实例。

引用库资源包括：

- 已启用的团队库 variable collections。
- 团队库中可枚举到的 variables。
- 当前文件中已经绑定过的远程 variables。
- 当前文件中已经引用过的远程 text styles。
- 当前文件中已经使用过的远程组件实例。

远程库只读。Distill 只会用远程库做匹配、命名推断和冲突检测，不会直接写入远程库，也不会发布远程库。

需要注意：Figma API 对远程库的完整值读取有边界。可用的远程 variables 通常能读到名称、类型、key；但具体值最可靠的来源是当前文件中已经绑定、导入或可以被 `resolveForConsumer` 解析的变量。

## 候选状态

每个提取出来的候选项会被标记为一个状态：

- `match`：已有 token 或 style 可以安全复用。
- `new`：没有找到等价资源，可以新建。
- `conflict`：目标名称已存在，但值或类型不同。
- `invalid`：用户输入的名称非法，或与本次新增项重复。
- `applied`：已经成功提交过。
- `skip`：该项不参与创建或绑定。

只有已勾选且有效的 `new` 会被创建。`match` 只复用已有资源。`conflict`、`invalid`、`skip` 和未勾选的 `new` 不会被创建。

## Colors 规则

### 提取

Colors 从当前选中节点及其子节点的可见 fills 和 strokes 中提取。

支持两类颜色资源：

- 纯色：写入 COLOR variable。
- 渐变色：写入 Paint Style。

纯色身份由两部分组成：

- RGB 值，四舍五入到 0-255。
- Alpha 值，四舍五入为百分比。

因此：

- `#000000` 和 `#00000099` 是两个不同颜色。
- `#ffffff` 和 `60%` 透明度的白色是两个不同颜色。

渐变身份由整个 fills/strokes paint 列表决定，包括：

- 渐变类型：linear、radial、angular、diamond。
- gradient transform。
- gradient stops 的位置、颜色和 alpha。
- paint opacity、blend mode、visible 状态。

因为 Figma Paint Style 绑定的是整个 fills 或 strokes 属性，所以当同一个属性里有多个 paint 时，插件会把整组 paints 作为一个 style 候选，而不是只保存其中一个渐变 stop。

同一个 fills 或 strokes 属性只要包含至少一个可见渐变，该属性就完全由 Paint Style 管理。插件不会再为同一属性中的纯色 paint 同时生成 Variable 绑定任务，避免 Paint Style 与 Variable 在提交时互相覆盖。

### 匹配

Colors 采用值优先匹配。

如果本地变量或可解析的远程变量中已经存在相同颜色值和 alpha，则标记为 `match`，提交时复用已有变量。

如果本地或当前文件已引用的远程 Paint Style 中已经存在相同渐变 paint 列表，则标记为 `match`，提交时复用已有 Paint Style。

如果目标名称已存在，但颜色值不同，则标记为 `conflict`。

### 命名

如果相同颜色值已经存在，优先复用已有变量名称。

如果是新增颜色，默认命名为：

- 不透明灰色系：`gray/{brightnessPercent}`
- 其他不透明颜色：`color/{hex}`
- 黑色透明度：`black-alpha/{alphaPercent}`
- 白色透明度：`white-alpha/{alphaPercent}`
- 其他透明色：`alpha/{hex}/{alphaPercent}`
- 渐变色：`gradient/{firstStop}-{lastStop}/{hash}`

示例：

- `#141414` -> `gray/8`
- `#999999` -> `gray/60`
- `#fafafa` -> `gray/98`
- `#00000099` -> `black-alpha/60`
- `#ffffff99` -> `white-alpha/60`
- `#ebebf599` -> `alpha/ebebf5/60`
- 渐变 `#ffffff -> #000000` -> `gradient/ffffff-000000/{hash}`

`gray` 的定义是不带任何色相，只通过明度或亮度变化形成的颜色。实现上要求颜色不透明，且 RGB 三个通道换算到 0-255 后完全相等，例如 `#000000`、`#999999`、`#ffffff`。如果 RGB 三通道不完全相等，即使视觉上接近灰色，也不会归入 `gray`。名称中的数字使用 HSB 中的 B 值百分比，计算方式为 `round(max(R, G, B) * 100)`。

当前版本只提取选区中真实出现的颜色，不会自动补齐灰阶、白色透明度、黑色透明度色盘。

### 提交

已勾选且有效的 `new` 颜色会在当前文件中创建本地 COLOR variable。

已勾选且有效的 `new` 渐变会在当前文件中创建本地 Paint Style。

`match` 颜色会复用已有本地变量，或复用当前文件中可解析的远程变量。

`match` 渐变会复用已有本地 Paint Style，或复用当前文件中已引用且可读取的远程 Paint Style。

提交 Colors 后，纯色会把对应 variable 绑定回提取时记录的 fills 和 strokes；渐变会把对应 Paint Style 绑定回提取时记录的 fills 或 strokes。

绑定前会再次核对图层当前的 paint 值。图层在预览后发生变化时，该引用会被跳过并显示未完成，不会用旧候选覆盖新颜色。

## Typography 规则

### 提取

Typography 从 Text 节点中提取。只有当字体和字号可以安全读取时才会进入候选。

核心属性：

- Font family。
- Font size。
- Font weight。

辅助属性：

- Line height。
- Letter spacing。
- Font style name。
- 引用次数。

### 匹配

Typography 采用属性优先匹配，而不是名称优先。

核心签名为：

`normalizedFontFamily + roundedFontSize + numericFontWeight + normalizedFontStyleVariant`

其中 `normalizedFontStyleVariant` 用于区分字体姿态和其他字体变体。例如 `Medium`、`Medium Italic`、`Medium Oblique` 会形成三个不同签名，不会因为数字字重都为 500 而被合并。

如果本地或已引用的远程 Text Style 中存在相同核心签名，则标记为 `match`，并使用已有 style 名称。

如果核心属性相同，但 line height 或 letter spacing 等辅助属性不同，仍然视为 `match`，并在 UI 中提示：提交后会绑定到已有样式，因此以已有样式的辅助属性为准。

如果名称相同，但核心属性不同，则标记为 `conflict`。

### 命名

只有需要新增 Typography 时才生成名称。

当没有可学习的现有结构时，默认使用简洁命名：

`{Role}/{Weight}`

示例：

- `Title1/Bold`
- `Headline/Semibold`
- `Body/Regular`

默认 Role 主要根据字号推断：

- `>= 34`：`LargeTitle`
- `>= 28`：`Title1`
- `>= 22`：`Title2`
- `>= 20`：`Title3`
- `>= 17`：字重较高时为 `Headline`，否则为 `Body`
- `>= 16`：`Callout`
- `>= 15`：`Subheadline`
- `>= 13`：`Footnote`
- `>= 12`：`Caption1`
- `< 12`：`Caption2`

如果检测到已有 Typography 库，插件会优先学习现有命名结构，而不是强行使用默认规则。

可兼容的结构包括：

- `Typography/Product/LargeTitle/Bold`
- `Typography/Product/Body/Large/Semibold`
- `Typography/Brand/Body Large`
- `Title/Title-3/Bold`
- `IOS/Headline/Emphasized`
- `Android/Subheadline/Medium`

只有当现有库本身使用多层路径时，插件才会跟随多层路径。空白文件或简单库中，默认保持简洁命名。

### 同字号分支复用

如果新增 Typography 与已有样式字体家族和字号相同，但字重不同，插件应该复用已有的字号分支，只新增或替换字重层。

示例：

- 已有：`Title/Title-3/Bold`，属性为 `Google Sans 18px Bold`
- 新增：`Google Sans 18px Semibold`
- 建议名：`Title/Title-3/Semibold`

这样可以避免在已有库已经把 `18px` 归为 `Title-3` 的情况下，又新开一个 `Headline/Semibold` 分支。

如果现有模板不包含字重层，插件不会主动追加字重层，除非必须通过追加来避免重名。

### 提交

已勾选且有效的 `new` Typography 会在当前文件中创建本地 Text Style，并创建相关 typography variables。

`match` Typography 会复用已匹配的本地或远程 Text Style。

提交 Typography 后，会绑定回提取时记录的 Text 节点。

绑定前会再次核对 Text 节点的字体家族、字号和字重。属性在预览后发生变化时，该引用会被跳过。

## Radius 规则

### 提取

Radius 从当前选中节点及其子节点中提取。

支持：

- 统一圆角。
- 圆角值 `0`。
- 四个角独立圆角。

当 `cornerRadius` 是整数且 `>= 0` 时，提取统一圆角。

当节点是混合圆角时，读取：

- `topLeftRadius`
- `topRightRadius`
- `bottomRightRadius`
- `bottomLeftRadius`

只提取整数且 `>= 0` 的值。小数圆角会被跳过。

Radius token 按数值命名，不按角的位置拆分。

示例：

- `0` -> `radius/0`
- `8` -> `radius/8`
- 超大圆角 -> `radius/full`

如果一个节点左上角是 `8`，其他角是 `0`，会提取 `radius/8` 和 `radius/0` 两个候选。

### 匹配

Radius 采用值优先匹配。

如果已有 radius variable 的数值相同，则标记为 `match`。

如果目标名称已存在，但值或类型不同，则标记为 `conflict`。

### 提交

Radius 的绑定范围是保守的。

提交 Radius 时，只绑定当前 Figma 中直接选中的图层。插件不会把扫描到的所有子图层批量绑定。

如果当前直接选中的是 Frame，只处理这个 Frame 自身，不处理它内部的子图层。

如果是单独四角圆角，只绑定当前图层实际存在的角属性，不会把单角圆角误绑定成四角统一圆角。

Radius 使用点击提交时保存的直接选区快照。即使提交执行期间用户改变选区，也不会把旧候选绑定到后来选中的图层。

## 提交安全规则

- `new` 不会覆盖同名已有变量或文字样式；提交时发现同名不同值会停止该项。
- 只有资源创建或复用成功，并且计划中的绑定全部成功后，候选才会标记为 `applied`。
- 创建成功但绑定失败属于未完成状态，面板会显示实际绑定数量和错误原因。
- 只有 `new` 项才会按需创建本地 collection；全部为 `match` 时不会创建空 collection。
- Colors、Typography、Radius 都会在提交前重新检测设计库，避免使用过期缓存。

## 审核面板规则

候选项按分组展示：

- Colors
- Typography
- Radius

排序规则：

- `new` 永远排在最上方。
- Typography 同状态内按字号从大到小，再按字重从大到小排序。
- Radius 同状态内按数值从小到大排序。
- Colors 同状态内按目标名称排序。

只有 `new` 项显示 checkbox，默认勾选。

取消勾选的 `new` 不会被创建、不会被绑定，也不会被标记为已提交。

`invalid` 项不能提交，必须改为合法名称后才可以提交。

## 重命名规则

只有新增项可以在插件面板中重命名。

每个新增项有三个名称字段：

- `suggestedName`：插件生成的默认建议名。
- `nameOverride`：用户手动输入的名称。
- `targetName`：最终用于校验和提交的有效名称。

如果用户清空输入框，输入框会保持为空，并用 placeholder 显示默认建议名。此时不会报“名称不能为空”，实际提交仍使用 `suggestedName`。

非法名称包括：

- 以 `/` 开头。
- 以 `/` 结尾。
- 包含 `//`。
- 与同组本次新增项重复。
- 与已有 token 或 style 形成不安全冲突。

## 导出规则

JSON 和 CSS 导出基于当前文件中已经存在的 token，以及已经成功提交的新 token。

未提交的 preview 候选项不会被导出。

当前版本前端暂时隐藏导出入口，但导出消息接口和实现逻辑仍保留，后续可以恢复。

## 远程库边界

Distill 不能从消费文件中直接更新被引用的远程组件库。

如果需要更新共享库，需要在源库文件中运行 Distill，提交本地变更后，再通过 Figma 原生的 library publish 流程手动发布。

这个限制是有意保留的安全边界，用来避免消费文件误改共享设计系统。
