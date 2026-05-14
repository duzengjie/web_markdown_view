// popup/popup.js
// 弹窗逻辑：规则增删查、立即转换

(function() {
  'use strict';

  const statusEl = document.getElementById('status');
  const convertBtn = document.getElementById('convertBtn');
  const ruleInput = document.getElementById('ruleInput');
  const addBtn = document.getElementById('addBtn');
  const ruleList = document.getElementById('ruleList');

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function loadRules() {
    chrome.storage.sync.get({ rules: [] }, function(data) {
      renderRuleList(data.rules);
      updateStatus(data.rules);
    });
  }

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

  function addRule() {
    const pattern = ruleInput.value.trim();
    if (!pattern) return;

    chrome.storage.sync.get({ rules: [] }, function(data) {
      const rules = data.rules;

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

  function updateStatus(rules) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0]) return;
      const url = tabs[0].url;

      chrome.tabs.sendMessage(tabs[0].id, { action: 'checkMatch' }, function(response) {
        if (chrome.runtime.lastError || !response) {
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

  function notifyContentScripts() {
    chrome.tabs.query({}, function(tabs) {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'rulesUpdated' }).catch(() => {});
      }
    });
  }

  addBtn.addEventListener('click', addRule);
  ruleInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addRule();
  });
  convertBtn.addEventListener('click', convertNow);

  loadRules();
})();
