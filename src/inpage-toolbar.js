const TOOLBAR_ID = '__figma_capture_toolbar__';
const STYLE_ID = '__figma_capture_toolbar_style__';
const CONCURRENCY_KEY = 'proxyFetchConcurrency';
const DEFAULT_CONCURRENCY = '8';
const ALLOWED_CONCURRENCY = new Set(['4', '6', '8', '10', '12', '16', '20', 'infinite']);

function normalizeConcurrency(value) {
  const strValue = String(value ?? '');
  return ALLOWED_CONCURRENCY.has(strValue) ? strValue : DEFAULT_CONCURRENCY;
}

function removeToolbar() {
  const existing = document.getElementById(TOOLBAR_ID);
  if (existing) existing.remove();
  
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

function createStyles() {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${TOOLBAR_ID} {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #1a1a2e;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    #${TOOLBAR_ID} .title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    
    #${TOOLBAR_ID} .icon {
      width: 16px;
      height: 16px;
    }
    
    #${TOOLBAR_ID} .progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    #${TOOLBAR_ID} .progress-bar {
      width: 100px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
    }
    
    #${TOOLBAR_ID} .progress-fill {
      height: 100%;
      background: #4ade80;
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    
    #${TOOLBAR_ID} .progress-text {
      color: rgba(255, 255, 255, 0.8);
      min-width: 40px;
      text-align: right;
    }
    
    #${TOOLBAR_ID} .cancel-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    
    #${TOOLBAR_ID} .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  `;
  document.head.appendChild(style);
}

function createToolbar() {
  removeToolbar();
  createStyles();
  
  const toolbar = document.createElement('div');
  toolbar.id = TOOLBAR_ID;
  toolbar.innerHTML = `
    <div class="title">
      <img class="icon" src="${chrome.runtime.getURL('logo/icon16.png')}" alt="Web to Figma" />
      <span>${chrome.i18n.getMessage('toolbarTitle') || 'Web to Figma'}</span>
    </div>
    <div class="progress">
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <span class="progress-text">0%</span>
    </div>
    <button class="cancel-btn">${chrome.i18n.getMessage('cancel') || '取消'}</button>
  `;
  
  document.body.appendChild(toolbar);
  
  const cancelBtn = toolbar.querySelector('.cancel-btn');
  cancelBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'cancelCapture' });
    removeToolbar();
  });
  
  return toolbar;
}

function updateProgress(progress, message) {
  const toolbar = document.getElementById(TOOLBAR_ID);
  if (!toolbar) return;
  
  const progressFill = toolbar.querySelector('.progress-fill');
  const progressText = toolbar.querySelector('.progress-text');
  
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${Math.round(progress)}%`;
  }
}

function showStatus(status, message) {
  const toolbar = document.getElementById(TOOLBAR_ID);
  if (!toolbar) return;
  
  const progressText = toolbar.querySelector('.progress-text');
  if (progressText && message) {
    progressText.textContent = message;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, progress, status, text } = message;
  
  if (action === 'showToolbar') {
    createToolbar();
    sendResponse({ success: true });
    return false;
  }
  
  if (action === 'hideToolbar') {
    removeToolbar();
    sendResponse({ success: true });
    return false;
  }
  
  if (action === 'updateProgress') {
    updateProgress(progress, text);
    sendResponse({ success: true });
    return false;
  }
  
  if (action === 'showStatus') {
    showStatus(status, text);
    sendResponse({ success: true });
    return false;
  }
  
  return false;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Web to Figma toolbar script loaded');
  });
} else {
  console.log('Web to Figma toolbar script loaded');
}
