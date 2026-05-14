# Chrome Markdown Viewer 插件设计文档

## 概述

一个 Chrome 浏览器插件，将匹配用户配置的 URL 规则的页面转换为 Markdown 格式渲染视图。用户可一键在原始页面和 Markdown 视图之间切换。

## 技术选型

- **Manifest V3** + 原生 HTML/CSS/JS，无构建工具，无外部依赖
- 存储：`chrome.storage.sync`
- UI 语言：中文

## 文件结构

```
web_markdown_view/
├── manifest.json          # Manifest V3 配置
├── popup/
│   ├── popup.html         # 弹窗 UI（配置 URL 匹配规则）
│   └── popup.js           # 弹窗逻辑
├── content/
│   ├── content.js         # 主逻辑：检测 URL、注入工具栏、切换视图
│   └── converter.js       # DOM → Markdown 转换引擎
├── styles/
│   └── viewer.css         # Markdown 预览样式
└── icons/                 # 插件图标
```

## 核心流程

### 1. URL 匹配检测

- 页面加载时，`content.js` 读取 `chrome.storage.sync` 中用户配置的 URL 规则
- 使用 Chrome match pattern 语法匹配当前页面 URL（如 `*://*.zhihu.com/*`）
- 匹配时注入浮动工具栏，不匹配时不做任何操作

### 2. 页面切换

**转为 Markdown：**
1. 保存 `document.body.innerHTML` 到变量 `originalHTML`
2. 调用 `converter.js` 遍历页面 DOM，生成 Markdown 文本
3. 将 body 内容替换为 Markdown 渲染视图
4. 工具栏按钮变为「查看原页面」

**查看原页面：**
1. 恢复 `originalHTML` 到 `document.body`
2. 工具栏按钮变回「转为 Markdown」

### 3. 浮动工具栏

- 固定定位在页面顶部
- 包含「转为 Markdown」/「查看原页面」切换按钮
- 显示当前规则匹配状态

## DOM → Markdown 转换规则

递归遍历 `document.body` 子节点：

| HTML 元素 | Markdown 输出 |
|-----------|--------------|
| `h1`-`h6` | `#` 到 `######` |
| `p` | 段落（前后空行） |
| `a` | `[text](href)` |
| `img` | `![alt](src)` |
| `ul`/`li` | `- item` |
| `ol`/`li` | `1. item` |
| `strong`/`b` | `**text**` |
| `em`/`i` | `*text*` |
| `code` | `` `code` `` |
| `pre` | ` ```code block``` ` |
| `blockquote` | `> text` |
| `table` | Markdown 表格语法 |
| `br` | 换行 |
| `div`/`section`/`article` | 递归子节点，不额外输出 |
| `script`/`style`/`nav`/`footer` | 跳过 |

**额外处理：**
- 忽略隐藏元素（`display: none`, `visibility: hidden`）
- 相对 URL 转绝对 URL
- 文本节点直接输出内容

## 弹窗（Popup）UI

- **规则列表**：显示所有 URL 匹配规则，每条有删除按钮
- **添加规则**：输入框 + 添加按钮，使用 Chrome match pattern 语法
- **当前页面状态**：显示当前页面是否匹配
- **立即转换按钮**：不依赖规则匹配，直接转换当前页面

## 数据结构

```json
{
  "rules": [
    { "id": "uuid", "pattern": "*://*.example.com/*", "enabled": true }
  ]
}
```

存储在 `chrome.storage.sync`，跨设备同步。

## 渲染视图样式

- GitHub 风格 Markdown 排版
- 最大宽度 800px，居中显示
- 合适的字体、行高、间距
- 代码块样式（纯 CSS，不做语法高亮）

## 权限需求

- `activeTab`：访问当前标签页
- `storage`：存储用户配置规则
- `scripting`：注入 content script
