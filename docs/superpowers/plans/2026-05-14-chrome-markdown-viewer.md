# Chrome Markdown Viewer 插件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Chrome 插件，将匹配用户配置 URL 规则的页面转换为 Markdown 渲染视图，支持一键切换回原页面。

**Architecture:** Manifest V3 插件，content script 负责页面检测和视图切换，独立的 converter 模块处理 DOM→Markdown 转换，popup 负责规则配置管理。数据通过 chrome.storage.sync 持久化。

**Tech Stack:** Chrome Extension Manifest V3, 原生 HTML/CSS/JS, chrome.storage.sync API

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `manifest.json` | 插件配置、权限声明、content script 注册 |
| `content/converter.js` | DOM → Markdown 转换引擎，纯函数模块 |
| `content/content.js` | 主逻辑：URL 匹配、工具栏注入、视图切换 |
| `popup/popup.html` | 弹窗 UI 结构 |
| `popup/popup.js` | 弹窗逻辑：规则增删查、立即转换 |
| `styles/toolbar.css` | 浮动工具栏样式 |
| `styles/viewer.css` | Markdown 渲染视图样式 |
| `icons/icon16.png` | 16x16 图标 |
| `icons/icon48.png` | 48x48 图标 |
| `icons/icon128.png` | 128x128 图标 |

---

### Task 1: 项目骨架与 Manifest 配置

**Files:**
- Create: `manifest.json`
- Create: `icons/icon16.png`
- Create: `icons/icon48.png`
- Create: `icons/icon128.png`

- [ ] **Step 1: 创建目录结构**

```bash
cd D:/dev/work/web_markdown_view
mkdir -p content popup styles icons
```

- [ ] **Step 2: 创建 manifest.json**

创建 `manifest.json`：

```json
{
  "manifest_version": 3,
  "name": "网页 Markdown 查看器",
  "version": "1.0.0",
  "description": "将网页转换为 Markdown 格式查看，支持自定义 URL 匹配规则",
  "permissions": ["activeTab", "storage"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/converter.js", "content/content.js"],
      "css": ["styles/toolbar.css", "styles/viewer.css"],
      "run_at": "document_idle"
    }
  ]
}
```

注意：`content_scripts.matches` 用 `<all_urls>` 以便 content script 在所有页面加载，但实际转换行为由 JS 中的规则匹配控制。如果用户未配置任何规则且未点击「立即转换」，content script 不做任何操作。

- [ ] **Step 3: 创建占位图标**

使用简单 SVG 转 PNG 的方式创建图标，或手动创建纯色占位图标。最简方案：创建一个简单的 16x16、48x48、128x128 的纯色 PNG 图标文件。

可以用以下 Python 脚本生成（如果 Python 可用），或手动用其他工具生成：

```python
import struct, zlib

def create_png(size, color=(66, 133, 244)):
    width = height = size
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            cx, cy = width // 2, height // 2
            r = size // 4
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                raw += bytes(color)
            else:
                raw += bytes((255, 255, 255))
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

for s in [16, 48, 128]:
    with open(f'icons/icon{s}.png', 'wb') as f:
        f.write(create_png(s))
```

运行: `python -c "上述脚本内容"` 或直接将脚本保存后执行。

- [ ] **Step 4: 创建空的占位文件**

```bash
touch content/converter.js content/content.js
touch popup/popup.html popup/popup.js
touch styles/toolbar.css styles/viewer.css
```

- [ ] **Step 5: 提交**

```bash
git add manifest.json icons/ content/ popup/ styles/
git commit -m "chore: 初始化 Chrome 插件项目骨架"
```

---

### Task 2: DOM → Markdown 转换引擎

**Files:**
- Create: `content/converter.js`

- [ ] **Step 1: 实现 converter.js**

创建 `content/converter.js`，实现完整的 DOM → Markdown 转换：

```javascript
// content/converter.js
// DOM → Markdown 转换引擎

const MarkdownConverter = {
  // 需要跳过的标签
  SKIP_TAGS: new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'FOOTER', 'HEADER', 'SVG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IFRAME']),

  // 块级容器标签（递归子节点，不额外输出）
  CONTAINER_TAGS: new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'SPAN', 'FORM', 'FIGURE']),

  convert(root) {
    const parts = [];
    this._walk(root, parts, { listDepth: 0 });
    return this._cleanMarkdown(parts.join(''));
  },

  _walk(node, parts, ctx) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        parts.push(text.replace(/\s+/g, ' '));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName;

    if (this.SKIP_TAGS.has(tag)) return;
    if (this._isHidden(node)) return;

    // 标题
    if (/^H([1-6])$/.test(tag)) {
      const level = parseInt(RegExp.$1);
      const text = this._getInlineText(node);
      parts.push('\n\n' + '#'.repeat(level) + ' ' + text.trim() + '\n\n');
      return;
    }

    // 段落
    if (tag === 'P') {
      parts.push('\n\n');
      this._walkChildren(node, parts, ctx);
      parts.push('\n\n');
      return;
    }

    // 链接
    if (tag === 'A') {
      const href = node.href || '';
      const text = this._getInlineText(node);
      if (text.trim() && href) {
        parts.push('[' + text.trim() + '](' + href + ')');
      } else {
        parts.push(text);
      }
      return;
    }

    // 图片
    if (tag === 'IMG') {
      const src = node.src || '';
      const alt = node.alt || '';
      parts.push('\n\n![' + alt + '](' + src + ')\n\n');
      return;
    }

    // 无序列表
    if (tag === 'UL') {
      parts.push('\n\n');
      this._walkListItems(node, parts, '-', ctx);
      parts.push('\n');
      return;
    }

    // 有序列表
    if (tag === 'OL') {
      parts.push('\n\n');
      this._walkListItems(node, parts, '1.', ctx);
      parts.push('\n');
      return;
    }

    // 列表项
    if (tag === 'LI') {
      // 由父级 UL/OL 处理，这里做兜底
      this._walkChildren(node, parts, ctx);
      return;
    }

    // 加粗
    if (tag === 'STRONG' || tag === 'B') {
      parts.push('**');
      this._walkChildren(node, parts, ctx);
      parts.push('**');
      return;
    }

    // 斜体
    if (tag === 'EM' || tag === 'I') {
      parts.push('*');
      this._walkChildren(node, parts, ctx);
      parts.push('*');
      return;
    }

    // 行内代码
    if (tag === 'CODE') {
      // 如果父元素是 PRE，由 PRE 处理
      if (node.parentElement && node.parentElement.tagName === 'PRE') {
        parts.push(node.textContent);
        return;
      }
      parts.push('`');
      parts.push(node.textContent);
      parts.push('`');
      return;
    }

    // 代码块
    if (tag === 'PRE') {
      const codeEl = node.querySelector('code');
      const codeText = codeEl ? codeEl.textContent : node.textContent;
      parts.push('\n\n```\n' + codeText + '\n```\n\n');
      return;
    }

    // 引用
    if (tag === 'BLOCKQUOTE') {
      parts.push('\n\n');
      const inner = [];
      this._walkChildren(node, inner, ctx);
      const text = inner.join('').trim();
      const lines = text.split('\n');
      for (const line of lines) {
        parts.push('> ' + line + '\n');
      }
      parts.push('\n');
      return;
    }

    // 表格
    if (tag === 'TABLE') {
      parts.push('\n\n');
      this._convertTable(node, parts);
      parts.push('\n\n');
      return;
    }

    // 换行
    if (tag === 'BR') {
      parts.push('\n');
      return;
    }

    // 水平线
    if (tag === 'HR') {
      parts.push('\n\n---\n\n');
      return;
    }

    // 容器标签：递归子节点
    if (this.CONTAINER_TAGS.has(tag)) {
      this._walkChildren(node, parts, ctx);
      return;
    }

    // 其他未知标签：也递归子节点
    this._walkChildren(node, parts, ctx);
  },

  _walkChildren(node, parts, ctx) {
    for (const child of node.childNodes) {
      this._walk(child, parts, ctx);
    }
  },

  _walkListItems(listNode, parts, marker, ctx) {
    const items = listNode.children;
    let index = 1;
    for (const item of items) {
      if (item.tagName === 'LI') {
        const indent = '  '.repeat(ctx.listDepth);
        const currentMarker = marker === '1.' ? (index + '.') : marker;
        parts.push(indent + currentMarker + ' ');
        const innerCtx = { ...ctx, listDepth: ctx.listDepth + 1 };
        this._walkChildren(item, parts, innerCtx);
        parts.push('\n');
        index++;
      }
    }
  },

  _convertTable(table, parts) {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return;

    const data = [];
    for (const row of rows) {
      const cells = [];
      const tds = row.querySelectorAll('th, td');
      for (const td of tds) {
        cells.push(this._getInlineText(td).trim().replace(/\|/g, '\\|'));
      }
      data.push(cells);
    }

    if (data.length === 0) return;

    // 表头
    const header = data[0];
    parts.push('| ' + header.join(' | ') + ' |\n');

    // 分隔行
    parts.push('| ' + header.map(() => '---').join(' | ') + ' |\n');

    // 数据行
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // 补齐列数
      while (row.length < header.length) row.push('');
      parts.push('| ' + row.join(' | ') + ' |\n');
    }
  },

  _getInlineText(node) {
    const parts = [];
    this._walk(node, parts, { listDepth: 0 });
    return parts.join('');
  },

  _isHidden(node) {
    const style = window.getComputedStyle(node);
    return style.display === 'none' || style.visibility === 'hidden';
  },

  _cleanMarkdown(md) {
    // 合并多个连续空行为最多两个
    md = md.replace(/\n{3,}/g, '\n\n');
    // 去除开头和结尾的空白
    md = md.trim();
    return md + '\n';
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add content/converter.js
git commit -m "feat: 实现 DOM → Markdown 转换引擎"
```

---

### Task 3: 浮动工具栏样式

**Files:**
- Create: `styles/toolbar.css`

- [ ] **Step 1: 创建工具栏样式**

创建 `styles/toolbar.css`：

```css
/* 浮动工具栏样式 */
.md-viewer-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  line-height: 1.5;
}

.md-viewer-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.md-viewer-toolbar-status {
  font-size: 12px;
  color: #8b949e;
}

.md-viewer-toolbar-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.md-viewer-toolbar-btn-primary {
  background: #238636;
  color: #ffffff;
}

.md-viewer-toolbar-btn-primary:hover {
  background: #2ea043;
}

.md-viewer-toolbar-btn-secondary {
  background: #30363d;
  color: #c9d1d9;
}

.md-viewer-toolbar-btn-secondary:hover {
  background: #484f58;
}

.md-viewer-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.md-viewer-toolbar-close {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  border-radius: 4px;
}

.md-viewer-toolbar-close:hover {
  color: #f0f0f0;
  background: #30363d;
}

/* 工具栏存在时，页面内容下移避免遮挡 */
body.md-viewer-has-toolbar {
  padding-top: 48px !important;
}
```

- [ ] **Step 2: 提交**

```bash
git add styles/toolbar.css
git commit -m "feat: 添加浮动工具栏样式"
```

---

### Task 4: Markdown 渲染视图样式

**Files:**
- Create: `styles/viewer.css`

- [ ] **Step 1: 创建 Markdown 渲染样式**

创建 `styles/viewer.css`（GitHub 风格）：

```css
/* Markdown 渲染视图样式 - GitHub 风格 */
.md-viewer-body {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: #1f2328;
  background: #ffffff;
  word-wrap: break-word;
}

.md-viewer-body h1 {
  font-size: 2em;
  font-weight: 700;
  margin: 0.67em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #d0d7de;
}

.md-viewer-body h2 {
  font-size: 1.5em;
  font-weight: 600;
  margin: 1em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #d0d7de;
}

.md-viewer-body h3 {
  font-size: 1.25em;
  font-weight: 600;
  margin: 1em 0;
}

.md-viewer-body h4 {
  font-size: 1em;
  font-weight: 600;
  margin: 1em 0;
}

.md-viewer-body h5, .md-viewer-body h6 {
  font-size: 0.875em;
  font-weight: 600;
  margin: 1em 0;
}

.md-viewer-body p {
  margin: 0 0 1em 0;
}

.md-viewer-body a {
  color: #0969da;
  text-decoration: none;
}

.md-viewer-body a:hover {
  text-decoration: underline;
}

.md-viewer-body strong {
  font-weight: 600;
}

.md-viewer-body em {
  font-style: italic;
}

.md-viewer-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  background: #eff1f3;
  border-radius: 6px;
}

.md-viewer-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background: #f6f8fa;
  border-radius: 6px;
  margin: 0 0 1em 0;
}

.md-viewer-body pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  background: transparent;
  border-radius: 0;
}

.md-viewer-body blockquote {
  padding: 0 1em;
  margin: 0 0 1em 0;
  color: #656d76;
  border-left: 0.25em solid #d0d7de;
}

.md-viewer-body ul, .md-viewer-body ol {
  padding-left: 2em;
  margin: 0 0 1em 0;
}

.md-viewer-body li {
  margin: 0.25em 0;
}

.md-viewer-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 1em 0;
  overflow: auto;
}

.md-viewer-body th, .md-viewer-body td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}

.md-viewer-body th {
  font-weight: 600;
  background: #f6f8fa;
}

.md-viewer-body tr:nth-child(even) {
  background: #f6f8fa;
}

.md-viewer-body img {
  max-width: 100%;
  height: auto;
}

.md-viewer-body hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background: #d0d7de;
  border: 0;
}
```

- [ ] **Step 2: 提交**

```bash
git add styles/viewer.css
git commit -m "feat: 添加 GitHub 风格 Markdown 渲染样式"
```

---

### Task 5: Markdown 文本 → HTML 渲染

**Files:**
- Create: `content/renderer.js`

这是一个简单的 Markdown 文本转 HTML 的渲染器，让生成的 Markdown 文本能在浏览器中以格式化形式展示。我们不引入外部库，自写一个轻量级渲染器。

- [ ] **Step 1: 实现 renderer.js**

创建 `content/renderer.js`：

```javascript
// content/renderer.js
// 简单的 Markdown 文本 → HTML 渲染器

const MarkdownRenderer = {
  render(md) {
    let html = '';
    const lines = md.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 代码块
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        let code = '';
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          code += (code ? '\n' : '') + this._escapeHtml(lines[i]);
          i++;
        }
        i++; // 跳过结束的 ```
        html += '<pre><code' + (lang ? ' class="language-' + this._escapeHtml(lang) + '"' : '') + '>' + code + '</code></pre>\n';
        continue;
      }

      // 标题
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = this._renderInline(headingMatch[2]);
        html += '<h' + level + '>' + text + '</h' + level + '>\n';
        i++;
        continue;
      }

      // 水平线
      if (/^---+$/.test(line.trim())) {
        html += '<hr>\n';
        i++;
        continue;
      }

      // 引用
      if (line.startsWith('> ')) {
        let quoteLines = [];
        while (i < lines.length && lines[i].startsWith('> ')) {
          quoteLines.push(lines[i].slice(2));
          i++;
        }
        html += '<blockquote>' + this._renderInline(quoteLines.join('<br>')) + '</blockquote>\n';
        continue;
      }

      // 无序列表
      if (/^[-*]\s+/.test(line)) {
        html += '<ul>\n';
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^[-*]\s+/, '');
          html += '  <li>' + this._renderInline(itemText) + '</li>\n';
          i++;
        }
        html += '</ul>\n';
        continue;
      }

      // 有序列表
      if (/^\d+\.\s+/.test(line)) {
        html += '<ol>\n';
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^\d+\.\s+/, '');
          html += '  <li>' + this._renderInline(itemText) + '</li>\n';
          i++;
        }
        html += '</ol>\n';
        continue;
      }

      // 表格
      if (line.includes('|') && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
        const tableLines = [];
        while (i < lines.length && lines[i].includes('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        html += this._renderTable(tableLines);
        continue;
      }

      // 空行
      if (line.trim() === '') {
        i++;
        continue;
      }

      // 普通段落
      let paraLines = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('> ') && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        html += '<p>' + this._renderInline(paraLines.join('<br>')) + '</p>\n';
      }
    }

    return html;
  },

  _renderInline(text) {
    // 图片（在链接之前处理，因为 ![alt](src) 包含 []
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
    // 链接
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // 加粗
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // 斜体
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // 行内代码
    text = text.replace(/`(.+?)`/g, '<code>$1</code>');
    return text;
  },

  _renderTable(tableLines) {
    if (tableLines.length < 2) return '';

    const parseRow = (line) => {
      return line.split('|')
        .map(cell => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length);
    };

    const headers = parseRow(tableLines[0]);
    // tableLines[1] 是分隔行，跳过
    let html = '<table>\n<thead>\n<tr>\n';
    for (const h of headers) {
      html += '  <th>' + this._renderInline(h) + '</th>\n';
    }
    html += '</tr>\n</thead>\n<tbody>\n';

    for (let i = 2; i < tableLines.length; i++) {
      const cells = parseRow(tableLines[i]);
      html += '<tr>\n';
      for (const c of cells) {
        html += '  <td>' + this._renderInline(c) + '</td>\n';
      }
      html += '</tr>\n';
    }

    html += '</tbody>\n</table>\n';
    return html;
  },

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
```

- [ ] **Step 2: 更新 manifest.json，添加 renderer.js 到 content_scripts**

在 `manifest.json` 的 `content_scripts.js` 数组中，在 `content/content.js` 之前添加 `"content/renderer.js"`：

```json
"js": ["content/converter.js", "content/renderer.js", "content/content.js"]
```

- [ ] **Step 3: 提交**

```bash
git add content/renderer.js manifest.json
git commit -m "feat: 实现 Markdown 文本 → HTML 渲染器"
```

---

### Task 6: Content Script 主逻辑

**Files:**
- Create: `content/content.js`

- [ ] **Step 1: 实现 content.js**

创建 `content/content.js`：

```javascript
// content/content.js
// 主逻辑：URL 匹配检测、工具栏注入、视图切换

(function() {
  'use strict';

  let originalHTML = null;
  let isMarkdownView = false;
  let toolbar = null;

  // URL 匹配
  function matchUrl(pattern, url) {
    // Chrome match pattern: *://*.example.com/*
    // 转为正则
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/:\/\//g, '://')
      .replace(/\.\*/g, '.*');
    try {
      const regex = new RegExp('^' + regexStr + '$');
      return regex.test(url);
    } catch (e) {
      return false;
    }
  }

  function checkUrlMatch(url, rules) {
    if (!rules || !Array.isArray(rules)) return false;
    return rules.some(rule => rule.enabled && matchUrl(rule.pattern, url));
  }

  // 创建浮动工具栏
  function createToolbar(isMatched) {
    if (toolbar) return;

    toolbar = document.createElement('div');
    toolbar.className = 'md-viewer-toolbar';

    const left = document.createElement('div');
    left.className = 'md-viewer-toolbar-left';

    const status = document.createElement('span');
    status.className = 'md-viewer-toolbar-status';
    status.textContent = isMatched ? '✓ 当前页面已匹配规则' : '未匹配规则（可手动转换）';

    left.appendChild(status);

    const right = document.createElement('div');
    right.className = 'md-viewer-toolbar-right';

    const convertBtn = document.createElement('button');
    convertBtn.className = 'md-viewer-toolbar-btn md-viewer-toolbar-btn-primary';
    convertBtn.id = 'md-viewer-convert-btn';
    convertBtn.textContent = '转为 Markdown';
    convertBtn.addEventListener('click', toggleView);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'md-viewer-toolbar-close';
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭工具栏';
    closeBtn.addEventListener('click', removeToolbar);

    right.appendChild(convertBtn);
    right.appendChild(closeBtn);

    toolbar.appendChild(left);
    toolbar.appendChild(right);

    document.body.appendChild(toolbar);
    document.body.classList.add('md-viewer-has-toolbar');
  }

  function removeToolbar() {
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
      document.body.classList.remove('md-viewer-has-toolbar');
    }
    // 如果当前在 Markdown 视图，切回原页面
    if (isMarkdownView) {
      restoreOriginal();
    }
  }

  // 视图切换
  function toggleView() {
    if (isMarkdownView) {
      restoreOriginal();
    } else {
      convertToMarkdown();
    }
  }

  function convertToMarkdown() {
    // 保存原始 HTML
    originalHTML = document.body.innerHTML;

    // 转换
    const markdown = MarkdownConverter.convert(document.body);

    // 渲染为 HTML
    const renderedHtml = MarkdownRenderer.render(markdown);

    // 创建渲染容器
    const container = document.createElement('div');
    container.className = 'md-viewer-body';
    container.innerHTML = renderedHtml;

    // 替换页面内容（保留工具栏）
    const toolbarEl = toolbar;
    document.body.innerHTML = '';
    if (toolbarEl) {
      document.body.appendChild(toolbarEl);
    }
    document.body.appendChild(container);

    isMarkdownView = true;

    // 更新按钮
    const btn = document.getElementById('md-viewer-convert-btn');
    if (btn) {
      btn.textContent = '查看原页面';
      btn.className = 'md-viewer-toolbar-btn md-viewer-toolbar-btn-secondary';
    }
  }

  function restoreOriginal() {
    if (originalHTML) {
      document.body.innerHTML = originalHTML;
      originalHTML = null;
    }
    isMarkdownView = false;

    // 重新创建工具栏（因为 innerHTML 被恢复了）
    toolbar = null;
    initToolbar();
  }

  // 初始化
  function initToolbar() {
    chrome.storage.sync.get({ rules: [] }, function(data) {
      const currentUrl = window.location.href;
      const isMatched = checkUrlMatch(currentUrl, data.rules);
      createToolbar(isMatched);
    });
  }

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'convertNow') {
      if (!toolbar) {
        createToolbar(false);
      }
      if (!isMarkdownView) {
        convertToMarkdown();
      }
      sendResponse({ success: true });
    }

    if (request.action === 'checkMatch') {
      chrome.storage.sync.get({ rules: [] }, function(data) {
        const isMatched = checkUrlMatch(window.location.href, data.rules);
        sendResponse({ matched: isMatched });
      });
      return true; // 异步响应
    }

    if (request.action === 'rulesUpdated') {
      // 规则更新后，重新检查并刷新工具栏状态
      if (toolbar) {
        removeToolbar();
      }
      if (isMarkdownView) {
        restoreOriginal();
      }
      initToolbar();
    }
  });

  // 页面加载时初始化
  initToolbar();
})();
```

- [ ] **Step 2: 提交**

```bash
git add content/content.js
git commit -m "feat: 实现 content script 主逻辑"
```

---

### Task 7: Popup 弹窗 UI

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.js`

- [ ] **Step 1: 创建 popup.html**

创建 `popup/popup.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 360px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      color: #1f2328;
      background: #ffffff;
    }

    .header {
      padding: 16px;
      border-bottom: 1px solid #d0d7de;
    }

    .header h1 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .header .status {
      font-size: 12px;
      color: #656d76;
    }

    .header .status.matched {
      color: #1a7f37;
    }

    .convert-btn {
      display: block;
      width: calc(100% - 32px);
      margin: 12px 16px;
      padding: 8px 16px;
      background: #238636;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .convert-btn:hover {
      background: #2ea043;
    }

    .section {
      padding: 12px 16px;
      border-top: 1px solid #d0d7de;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #656d76;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .add-rule {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .add-rule input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
    }

    .add-rule input:focus {
      border-color: #0969da;
    }

    .add-rule button {
      padding: 6px 12px;
      background: #0969da;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
    }

    .add-rule button:hover {
      background: #0550ae;
    }

    .rule-list {
      list-style: none;
    }

    .rule-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 6px;
      margin-bottom: 4px;
      background: #f6f8fa;
    }

    .rule-pattern {
      font-size: 13px;
      font-family: "SFMono-Regular", Consolas, monospace;
      word-break: break-all;
      flex: 1;
    }

    .rule-delete {
      background: none;
      border: none;
      color: #8b949e;
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
    }

    .rule-delete:hover {
      color: #cf222e;
      background: #ffebe9;
    }

    .empty-state {
      text-align: center;
      color: #8b949e;
      font-size: 13px;
      padding: 12px;
    }

    .help {
      font-size: 11px;
      color: #8b949e;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>网页 Markdown 查看器</h1>
    <div class="status" id="status">检查中...</div>
  </div>

  <button class="convert-btn" id="convertBtn">立即转换当前页面</button>

  <div class="section">
    <div class="section-title">URL 匹配规则</div>
    <div class="add-rule">
      <input type="text" id="ruleInput" placeholder="*://*.example.com/*" />
      <button id="addBtn">添加</button>
    </div>
    <ul class="rule-list" id="ruleList"></ul>
    <div class="help">
      使用 Chrome 匹配模式语法，如：*://*.zhihu.com/*
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 popup.js**

创建 `popup/popup.js`：

```javascript
// popup/popup.js
// 弹窗逻辑：规则增删查、立即转换

(function() {
  'use strict';

  const statusEl = document.getElementById('status');
  const convertBtn = document.getElementById('convertBtn');
  const ruleInput = document.getElementById('ruleInput');
  const addBtn = document.getElementById('addBtn');
  const ruleList = document.getElementById('ruleList');

  // 生成唯一 ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // 加载规则列表
  function loadRules() {
    chrome.storage.sync.get({ rules: [] }, function(data) {
      renderRuleList(data.rules);
      updateStatus(data.rules);
    });
  }

  // 渲染规则列表
  function renderRuleList(rules) {
    ruleList.innerHTML = '';

    if (rules.length === 0) {
      ruleList.innerHTML = '<div class="empty-state">暂无规则，请添加</div>';
      return;
    }

    for (const rule of rules) {
      const li = document.createElement('li');
      li.className = 'rule-item';

      const pattern = document.createElement('span');
      pattern.className = 'rule-pattern';
      pattern.textContent = rule.pattern;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rule-delete';
      deleteBtn.textContent = '✕';
      deleteBtn.title = '删除此规则';
      deleteBtn.addEventListener('click', function() {
        deleteRule(rule.id);
      });

      li.appendChild(pattern);
      li.appendChild(deleteBtn);
      ruleList.appendChild(li);
    }
  }

  // 添加规则
  function addRule() {
    const pattern = ruleInput.value.trim();
    if (!pattern) return;

    chrome.storage.sync.get({ rules: [] }, function(data) {
      const rules = data.rules;

      // 检查重复
      if (rules.some(r => r.pattern === pattern)) {
        ruleInput.value = '';
        return;
      }

      rules.push({
        id: generateId(),
        pattern: pattern,
        enabled: true
      });

      chrome.storage.sync.set({ rules: rules }, function() {
        ruleInput.value = '';
        renderRuleList(rules);
        updateStatus(rules);
        notifyContentScripts();
      });
    });
  }

  // 删除规则
  function deleteRule(id) {
    chrome.storage.sync.get({ rules: [] }, function(data) {
      const rules = data.rules.filter(r => r.id !== id);
      chrome.storage.sync.set({ rules: rules }, function() {
        renderRuleList(rules);
        updateStatus(rules);
        notifyContentScripts();
      });
    });
  }

  // 更新状态显示
  function updateStatus(rules) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0]) return;
      const url = tabs[0].url;

      // 发送消息给 content script 检查匹配
      chrome.tabs.sendMessage(tabs[0].id, { action: 'checkMatch' }, function(response) {
        if (chrome.runtime.lastError || !response) {
          // content script 未加载，本地检查
          const isMatched = rules.some(rule => {
            if (!rule.enabled) return false;
            try {
              const regexStr = rule.pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '.*');
              return new RegExp('^' + regexStr + '$').test(url);
            } catch (e) {
              return false;
            }
          });
          setStatus(isMatched);
        } else {
          setStatus(response.matched);
        }
      });
    });
  }

  function setStatus(isMatched) {
    statusEl.textContent = isMatched ? '✓ 当前页面已匹配规则' : '当前页面未匹配规则';
    statusEl.className = 'status' + (isMatched ? ' matched' : '');
  }

  // 立即转换
  function convertNow() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'convertNow' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('发送消息失败:', chrome.runtime.lastError.message);
        }
        window.close();
      });
    });
  }

  // 通知 content scripts 规则已更新
  function notifyContentScripts() {
    chrome.tabs.query({}, function(tabs) {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'rulesUpdated' }).catch(() => {});
      }
    });
  }

  // 事件绑定
  addBtn.addEventListener('click', addRule);
  ruleInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addRule();
  });
  convertBtn.addEventListener('click', convertNow);

  // 初始化
  loadRules();
})();
```

- [ ] **Step 3: 提交**

```bash
git add popup/popup.html popup/popup.js
git commit -m "feat: 实现弹窗 UI 与规则管理逻辑"
```

---

### Task 8: 集成测试与收尾

**Files:**
- Modify: `manifest.json`（确认 renderer.js 已在 content_scripts 中）

- [ ] **Step 1: 确认 manifest.json 配置正确**

验证 `manifest.json` 的 content_scripts.js 数组为：

```json
"js": ["content/converter.js", "content/renderer.js", "content/content.js"]
```

- [ ] **Step 2: 在 Chrome 中加载插件测试**

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `D:\dev\work\web_markdown_view` 目录
4. 打开任意网页，点击插件图标
5. 在弹窗中添加规则如 `*://*/*` 或点击「立即转换当前页面」
6. 验证：
   - 页面内容被替换为 Markdown 渲染视图
   - 工具栏显示「查看原页面」按钮
   - 点击「查看原页面」能恢复原始页面
   - 点击「✕」能关闭工具栏

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: 完成网页 Markdown 查看器 Chrome 插件 v1.0"
```
