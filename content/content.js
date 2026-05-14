// content/content.js
// 主逻辑：URL 匹配检测、工具栏注入、视图切换

(function() {
  'use strict';

  let originalHTML = null;
  let isMarkdownView = false;
  let toolbar = null;

  // URL 匹配（Chrome match pattern → 正则）
  function matchUrl(pattern, url) {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
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
    originalHTML = document.body.innerHTML;

    const markdown = MarkdownConverter.convert(document.body);
    const renderedHtml = MarkdownRenderer.render(markdown);

    const container = document.createElement('div');
    container.className = 'md-viewer-body';
    container.innerHTML = renderedHtml;

    const toolbarEl = toolbar;
    document.body.innerHTML = '';
    if (toolbarEl) {
      document.body.appendChild(toolbarEl);
    }
    document.body.appendChild(container);

    isMarkdownView = true;

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

    toolbar = null;
    initToolbar();
  }

  // 检查是否为默认匹配的 Markdown 文件 URL
  function isDefaultMatch(url) {
    return /\.md(\?.*)?(#.*)?(\/\*)?\/?$/i.test(url) || /\.md\/raw/i.test(url) || /\.md\b/i.test(url.split('?')[0].split('#')[0]);
  }

  // 初始化
  function initToolbar() {
    chrome.storage.sync.get({ rules: [] }, function(data) {
      const currentUrl = window.location.href;
      const isMatched = isDefaultMatch(currentUrl) || checkUrlMatch(currentUrl, data.rules);
      if (isMatched) {
        createToolbar(true);
      }
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
      return true;
    }

    if (request.action === 'rulesUpdated') {
      removeToolbar();
      if (isMarkdownView) {
        restoreOriginal();
      }
      initToolbar();
    }
  });

  initToolbar();
})();
