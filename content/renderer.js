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
    // 图片（在链接之前处理）
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      return '<img alt="' + this._escapeHtml(alt) + '" src="' + this._sanitizeUrl(src) + '">';
    });
    // 链接
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, href) => {
      return '<a href="' + this._sanitizeUrl(href) + '">' + this._renderInline(linkText) + '</a>';
    });
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
      const cells = line.split('|');
      // 去掉首尾空元素（由前后的 | 产生）
      if (cells.length > 0 && cells[0].trim() === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
      return cells.map(cell => cell.trim());
    };

    const headers = parseRow(tableLines[0]);
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
  },

  _sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
        return '';
      }
    } catch (e) {
      // 相对路径等无效 URL，尝试用 location 解析
      if (url && !url.toLowerCase().startsWith('javascript:') && !url.toLowerCase().startsWith('data:')) {
        return this._escapeHtml(url);
      }
      return '';
    }
    return this._escapeHtml(url);
  }
};
