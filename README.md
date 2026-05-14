# 网页 Markdown 查看器

一个 Chrome 浏览器插件，将网页内容转换为 Markdown 格式渲染视图，支持一键切换回原始页面。

## 功能

- **自动匹配**：URL 中包含 `.md` 的页面自动显示工具栏
- **自定义规则**：支持配置 URL 匹配规则（Chrome match pattern 语法）
- **一键转换**：将页面内容转为 GitHub 风格的 Markdown 渲染视图
- **双向切换**：在 Markdown 视图和原始页面之间自由切换
- **立即转换**：弹窗中的「立即转换当前页面」按钮可手动触发任意页面

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解解压的扩展程序」
4. 选择本项目根目录

## 使用

### 自动模式

打开 URL 中包含 `.md` 的页面，页面顶部会自动出现工具栏，点击「转为 Markdown」即可。

### 手动模式

点击浏览器工具栏的插件图标，在弹窗中点击「立即转换当前页面」。

### 配置规则

点击插件图标 → 在「URL 匹配规则」区域添加规则，例如：

- `*://*.zhihu.com/*`
- `*://mp.weixin.qq.com/*`
- `*://*.github.io/*`

## 项目结构

```
├── manifest.json          # Manifest V3 配置
├── content/
│   ├── converter.js       # DOM → Markdown 转换引擎
│   ├── renderer.js        # Markdown → HTML 渲染器
│   └── content.js         # 主逻辑：URL 匹配、工具栏、视图切换
├── popup/
│   ├── popup.html         # 弹窗 UI
│   └── popup.js           # 规则管理逻辑
├── styles/
│   ├── toolbar.css        # 浮动工具栏样式
│   └── viewer.css         # Markdown 渲染样式
└── icons/                 # 插件图标
```

## 技术栈

- Chrome Extension Manifest V3
- 原生 HTML / CSS / JavaScript
- chrome.storage.sync API
