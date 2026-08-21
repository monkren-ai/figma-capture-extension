const STORAGE_KEY = 'figmaCaptureProxyEnabled';
const CONCURRENCY_KEY = 'proxyFetchConcurrency';
const DEFAULT_CONCURRENCY = '8';
const ALLOWED_CONCURRENCY = new Set(['4', '6', '8', '10', '12', '16', '20', 'infinite']);

const toggle = document.getElementById('assetProxyToggle');
const concurrency = document.getElementById('proxyConcurrency');
const captureBtn = document.getElementById('captureBtn');
const status = document.getElementById('status');

function setStatus(message) {
  status.textContent = message || '';
}

function setBusy(busy) {
  captureBtn.disabled = busy;
  captureBtn.textContent = busy 
    ? chrome.i18n.getMessage('captureButtonCapturing') || '采集中...'
    : chrome.i18n.getMessage('captureButton') || '开始采集';
}

function normalizeConcurrency(value) {
  const strValue = String(value ?? '');
  return ALLOWED_CONCURRENCY.has(strValue) ? strValue : DEFAULT_CONCURRENCY;
}

async function loadConfig() {
  const result = await chrome.storage.local.get([STORAGE_KEY, CONCURRENCY_KEY]);
  toggle.checked = result[STORAGE_KEY] || false;
  concurrency.value = normalizeConcurrency(result[CONCURRENCY_KEY]);
  setStatus(chrome.i18n.getMessage('statusReady') || '准备就绪');
}

async function saveConfig() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: toggle.checked,
    [CONCURRENCY_KEY]: concurrency.value
  });
}

toggle.addEventListener('change', async () => {
  await saveConfig();
  const statusMsg = toggle.checked 
    ? chrome.i18n.getMessage('proxyModeEnabled') || '已开启跨域图片代理模式'
    : chrome.i18n.getMessage('proxyModeDisabled') || '已关闭跨域图片代理模式';
  setStatus(statusMsg);
});

concurrency.addEventListener('change', async () => {
  const value = normalizeConcurrency(concurrency.value);
  concurrency.value = value;
  await chrome.storage.local.set({ [CONCURRENCY_KEY]: value });
  setStatus((chrome.i18n.getMessage('concurrencySet') || '图片采集并发已设为：') + value);
});

captureBtn.addEventListener('click', async () => {
  setBusy(true);
  setStatus(chrome.i18n.getMessage('statusCapturing') || '采集中...');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'enableAssetProxyFetch',
      proxyMode: toggle.checked,
      concurrency: concurrency.value
    });
    
    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
    
    if (response?.success) {
      setStatus(chrome.i18n.getMessage('statusSuccess') || '采集完成！');
    } else {
      const errorMsg = response?.error || chrome.i18n.getMessage('unknownError') || '未知错误';
      setStatus((chrome.i18n.getMessage('captureFailed') || '采集失败：') + errorMsg);
    }
  } catch (error) {
    setStatus((chrome.i18n.getMessage('captureFailed') || '采集失败：') + error.message);
  } finally {
    setBusy(false);
  }
});

loadConfig();
