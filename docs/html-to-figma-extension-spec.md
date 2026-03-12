# HTML to Figma Chrome Extension Spec

## 1. 产品目标

构建一个 Chrome Extension，让用户在任意网页中直接选取页面元素，并将其转换为可粘贴到 Figma 中继续编辑和 redesign 的设计图层。

核心价值：

- 降低从线上页面到 Figma 的重建设计成本
- 保留页面结构、层级、布局和主要视觉信息
- 提供接近 Figma 选择节点 / Auto Layout 高亮的交互体验

---

## 2. 用户场景

### 主要场景

用户打开任意网页后，点击浏览器扩展图标进入“采集模式”。

页面右下角出现一个 `HTMLtoFigma` 工具条，提示当前可用快捷键：

- `Copy element [Click]`
- `Copy Multiple [Shift]`
- `Select parent [Esc]`

此时页面进入可视化选择模式：

- 鼠标 hover 到 DOM 节点时，节点出现高亮
- 当前节点右侧始终跟随一个 badge/cursor，提示节点类型：`text` / `layout` / `image` / `svg`
- 点击可复制当前节点
- 按住 `Shift` 可连续选择多个节点
- 按 `Esc` 可向上选择父级容器

完成选择后，扩展通过 Figma MCP 的 HTML capture 能力，将所选内容转换为可粘贴到 Figma 的设计图层。

---

## 3. 交互定义

### 3.1 进入采集模式

触发方式：

- 点击 Chrome 扩展 icon
- 或扩展 popup 中点击 `Start Capture`

进入后行为：

- 注入 content script
- 在页面上挂载一个独立的 overlay layer
- 在右下角显示工具条
- 隐藏或弱化浏览器默认选区反馈，避免干扰

### 3.2 Hover 高亮

当鼠标 hover 到任意可选 DOM 节点时：

- 当前节点显示 `蓝色实线描边`
- 当前节点显示 `浅蓝色半透明背景`
- 高亮区域应严格贴合元素 border box
- 如果元素不可见、尺寸为 0 或被标记为忽略，则不参与选择

建议视觉：

- Outline: `#2F6BFF`
- Fill: `rgba(47, 107, 255, 0.12)`
- Border radius: 继承目标元素的可视圆角，或以矩形方式展示

### 3.3 Flex / Auto Layout 辅助高亮

当 hover 的节点是某个 flex 布局容器中的子元素时，除了高亮当前节点，还应额外高亮其最近的 flex 容器祖先，用于模拟 Figma 中“选中子节点时同时感知 Auto Layout 容器”的体验。

容器高亮规则：

- 使用 `蓝色虚线描边`
- 不加填充，或使用更弱的透明背景
- 与当前选中节点同时显示
- 仅突出最近一层关键布局容器，避免页面出现过多框选噪音

建议视觉：

- Parent outline: `1px dashed #2F6BFF`
- Parent fill: `rgba(47, 107, 255, 0.04)`

说明：

- 你的原描述里提到“父级的父容器”，这里先整理为“最近的 flex 容器祖先”。如果后面你希望是“直接父级 + 再上一层父容器都高亮”，可以在实现阶段改为双层容器提示。

### 3.4 自定义 Cursor / Badge

鼠标右侧始终跟随一个 badge，用于提示当前 hover/选中节点的类型。

基础类型建议：

- `text`
- `layout`
- `image`
- `svg`

可扩展类型：

- `button`
- `input`
- `icon`
- `video`
- `iframe`

类型判断建议：

- `text`: 纯文本节点或以文本内容为主的 inline/block 文本容器
- `image`: `img`, `picture`, 带背景图的重要媒体块
- `svg`: `svg` 或主要由矢量组成的图标/图形
- `layout`: 普通容器、section、card、list、grid/flex item

Badge 行为：

- 位置跟随鼠标，但略偏右上或右侧，避免遮挡目标
- 在多选模式下显示 `Multi` 或选中计数
- 在 parent select 模式切换时短暂更新为 `Parent`

### 3.5 单选复制

默认模式下：

- hover 节点
- 点击鼠标
- 立即复制当前节点

复制后的反馈：

- 工具条显示 `Copied: 1 element`
- 当前节点短暂出现成功态高亮
- 可选：toast 提示 `Copied to Figma clipboard`

### 3.6 多选复制

按住 `Shift` 后进入多选模式：

- 点击一个节点，将其加入当前 selection set
- 再点击其他节点，持续追加
- 已选中的节点保持稳定高亮
- 工具条实时显示已选数量

建议多选规则：

- 同一个节点再次点击可取消选中
- 默认不允许同时选择父子重叠节点，后选节点应覆盖或替换冲突节点
- 多选结束后再次点击主按钮或快捷键执行统一复制

### 3.7 选择父级

按 `Esc` 时：

- 当前 hover/选中的目标切换到其父级 DOM 容器
- 连续按 `Esc` 持续向上提升选择层级
- 顶层到 `body` 或应用根节点后停止

建议补充行为：

- `Shift + Esc` 可以反向返回下一级最近子节点（可选）
- 工具条短暂显示 `Selected parent: .card > .content`

---

## 4. 工具条定义

### 4.1 位置

- 固定在页面右下角
- 不受页面布局影响
- 使用 Shadow DOM 隔离样式，避免被业务 CSS 污染

### 4.2 内容

基础内容：

- Logo / 名称：`HTMLtoFigma`
- 快捷键提示：
  - `Copy element [Click]`
  - `Copy Multiple [Shift]`
  - `Select parent [Esc]`

建议增加的状态信息：

- 当前模式：`Single` / `Multi`
- 当前类型：`Text` / `Layout` / `Image` / `SVG`
- 已选数量：`3 selected`
- 操作结果：`Copied to clipboard`

### 4.3 工具条状态

状态建议：

- `Idle`
- `Hovering`
- `Multi Select`
- `Copying`
- `Success`
- `Error`

---

## 5. 转换链路

### 5.1 总体思路

扩展本身主要负责：

- 页面元素选择
- hover / selection 可视化
- DOM 节点分类
- 收集选中元素的上下文
- 调用 Figma MCP capture 脚本完成转换

实际的 HTML -> Figma layer 转换尽量复用 Figma 官方能力，而不是完全自研。

### 5.2 拟采用的转换方式

使用 Figma MCP 官方的 HTML capture 脚本：

- `https://mcp.figma.com/mcp/html-to-design/capture.js`

规划中的接入方式：

1. 由 Chrome Extension 注入自定义 inspector UI
2. 选择完成后，调用 Figma 的 capture 能力处理目标页面 / 目标元素
3. 输出到：
   - Figma 新文件
   - Figma 现有文件
   - 或剪贴板（便于用户粘贴到 Figma）

### 5.3 数据流建议

```text
User Action
  -> Chrome Extension Activated
  -> Content Script Injected
  -> Overlay / Toolbar Mounted
  -> Hover & Selection Engine Tracks Target Nodes
  -> Selected Node Metadata Serialized
  -> Figma Capture Adapter Invokes capture.js
  -> Result Sent to Clipboard or Figma File
  -> User Pastes / Opens Figma
```

### 5.4 需要保留的信息

为了让 Figma 中的结果更可编辑，采集时尽量保留：

- DOM 层级结构
- 文本内容
- 字体、字号、字重、行高、字色
- 背景色 / 背景图
- 边框 / 圆角 / 阴影
- Flex / Grid / Size / Gap / Padding
- 图片资源引用
- SVG 内容

---

## 6. 技术架构建议

### 6.1 Chrome Extension 模块

建议采用 Manifest V3：

- `background service worker`
- `content script`
- `popup`
- `storage`

### 6.2 模块拆分

#### A. Content Script

负责：

- 注入 overlay
- 监听鼠标移动 / 点击 / 键盘事件
- 计算 hover target
- 管理选中态
- 与 background/popup 通信

#### B. Overlay UI

负责：

- 右下角 toolbar
- hover outline layer
- parent flex container outline
- custom cursor badge
- toast / status feedback

建议：

- 使用 Shadow DOM
- 所有 UI 使用 `pointer-events` 精细控制，避免遮挡页面操作

#### C. Selection Engine

负责：

- 从 `event.target` 推断实际可选节点
- 过滤无效节点
- 处理父子冲突
- 查找最近 flex 容器祖先
- 判断节点类型：text/layout/image/svg

#### D. Capture Adapter

负责：

- 动态加载或注入 Figma `capture.js`
- 将选区信息传给转换逻辑
- 对接剪贴板 / Figma 文件输出
- 处理失败重试与错误提示

#### E. Background / Popup

负责：

- 启停采集模式
- 保存用户配置
- 展示登录状态或 Figma 连接状态（如果需要）

---

## 7. 节点分类规则（初稿）

### `text`

满足其一即可：

- 文本节点可见且文本内容非空
- 容器只包含少量 inline 内容，且主要语义为文本展示

### `image`

满足其一即可：

- `img`
- `picture`
- 大尺寸背景图容器

### `svg`

满足其一即可：

- `svg`
- 内联图标容器，内部主要为 `svg/path`

### `layout`

默认归类：

- `div`
- `section`
- `article`
- `nav`
- `header`
- `footer`
- `li`
- card / list / group / wrapper 类节点

---

## 8. MVP 范围

### 必做

- Chrome Extension 基础结构
- 点击图标进入页面采集模式
- 右下角 toolbar
- hover 高亮
- 最近 flex 容器虚线高亮
- custom cursor badge
- Click 单选复制
- Shift 多选
- Esc 逐级选择父容器
- 调用 Figma capture 能力导出到 clipboard 或 Figma

### 可后置

- 自定义快捷键配置
- 忽略固定定位悬浮层
- 对 iframe 的支持
- 对 Shadow DOM 内部节点的支持
- 对 React/Vue 组件名识别
- 批量命名图层
- 历史记录 / 最近复制

---

## 9. 非功能要求

### 性能

- hover 高亮应接近实时，避免明显掉帧
- 鼠标移动时不能频繁触发重排
- overlay 更新尽量走 `requestAnimationFrame`

### 兼容性

- 适配主流网站布局
- 兼容常见 `flex`, `grid`, `positioned` 布局
- 尽量不破坏原页面交互

### 可维护性

- 节点识别逻辑与 UI 渲染逻辑解耦
- capture 适配层单独封装，避免和选择器逻辑耦合

---

## 10. 风险与待确认点

### 风险

- Figma 官方 `capture.js` 的调用方式、参数格式、宿主环境约束需要实际验证
- 不同网站的 CSP 可能影响脚本注入策略
- 复杂页面中的 iframe / shadow root / canvas 内容不一定能稳定采集
- 多选节点在导出时如何合并为合理的 Figma frame，需要定义策略

### 待确认

1. `Esc` 是否一定表示“向上选父级”，还是需要保留一次 `Esc` 退出采集模式的能力
2. 多选后是“立即复制所选集合”，还是需要额外一个 `Copy` 按钮确认
3. 输出目标是否以 `Clipboard -> 粘贴进 Figma` 为 MVP 主链路
4. 是否需要支持“整页 capture”和“只 capture 选中元素”两种模式

---

## 11. 推荐的下一步

建议按以下顺序推进：

1. 搭建 Manifest V3 扩展骨架
2. 先实现 content script + overlay + hover 高亮
3. 再实现节点类型判断和 flex 容器辅助高亮
4. 接着补齐 Click / Shift / Esc 交互
5. 最后接入 Figma capture.js，验证 clipboard / Figma 输出链路

---

## 12. 参考资料

- Figma MCP remote server docs: https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
- Figma MCP tools and prompts: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/

备注：

- Figma 官方文档已明确支持通过 MCP 将 live UI 发送到新文件、现有文件或剪贴板。
- 官方 capture 流程里默认包含一个 capture toolbar；当前方案是在这个基础上扩展更强的 DOM 选择与交互体验。
