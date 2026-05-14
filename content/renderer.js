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
