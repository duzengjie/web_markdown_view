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
        cells.push(this._getInlineText(td).trim().replace(/\|/g, '\|'));
      }
      data.push(cells);
    }

    if (data.length === 0) return;

    const header = data[0];
    parts.push('| ' + header.join(' | ') + ' |\n');
    parts.push('| ' + header.map(() => '---').join(' | ') + ' |\n');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
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
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.trim();
    return md + '\n';
  }
};
