const WORLD = 'MAIN';
const CAPTURE_FILE = 'capture.js';
const TOOLBAR_FILE = 'src/inpage-toolbar.js';
const RUNNER_FILE = 'src/runner.js';

const FIGMA_CAPTURE_CONCURRENCY_KEY = 'proxyFetchConcurrency';
const FIGMA_CAPTURE_ALLOWED_CONCURRENCY = new Set([4, 6, 8, 10, 12, 16, 20]);
const FIGMA_CAPTURE_DEFAULT_CONCURRENCY = 8;

const FIGMA_CAPTURE_PROXY_SESSION_KEY = 'figmaCaptureProxySessionV1';
const FIGMA_CAPTURE_PROXY_DIAG_KEY = 'figmaCaptureProxyDiagnosticsV1';
const FIGMA_CAPTURE_PROXY_MAX_DIAG = 500;
const FIGMA_CAPTURE_FETCH_TIMEOUT_MS = 8000;

const figmaProxyQueue = [];
const figmaProxyInFlight = new Map();
const figmaProxyMemCache = new Map();

let figmaProxyActive = 0;
let figmaProxyMaxConcurrency = FIGMA_CAPTURE_DEFAULT_CONCURRENCY;
let figmaProxySessionLoaded = false;
let figmaProxySessionCache = {};
let figmaProxyDiagnostics = [];
let figmaProxyEnabled = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function injectScriptFileMain(tabId, file) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: [file]
  });
}

async function injectScriptFileIsolated(tabId, file) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [file]
  });
}

async function loadConcurrencyConfig() {
  try {
    const result = await chrome.storage.local.get([FIGMA_CAPTURE_CONCURRENCY_KEY]);
    const value = result[FIGMA_CAPTURE_CONCURRENCY_KEY];
    
    if (value === 'infinite') {
      figmaProxyMaxConcurrency = 999;
    } else {
      const num = parseInt(value, 10);
      figmaProxyMaxConcurrency = FIGMA_CAPTURE_ALLOWED_CONCURRENCY.has(num) ? num : FIGMA_CAPTURE_DEFAULT_CONCURRENCY;
    }
  } catch (error) {
    console.error('Failed to load concurrency config:', error);
    figmaProxyMaxConcurrency = FIGMA_CAPTURE_DEFAULT_CONCURRENCY;
  }
}

async function loadProxySession() {
  if (figmaProxySessionLoaded) return;
  
  try {
    const result = await chrome.storage.local.get([FIGMA_CAPTURE_PROXY_SESSION_KEY]);
    figmaProxySessionCache = result[FIGMA_CAPTURE_PROXY_SESSION_KEY] || {};
    figmaProxySessionLoaded = true;
  } catch (error) {
    console.error('Failed to load proxy session:', error);
    figmaProxySessionCache = {};
  }
}

async function saveProxySession() {
  try {
    await chrome.storage.local.set({ [FIGMA_CAPTURE_PROXY_SESSION_KEY]: figmaProxySessionCache });
  } catch (error) {
    console.error('Failed to save proxy session:', error);
  }
}

function addDiagnostic(entry) {
  figmaProxyDiagnostics.push({
    ...entry,
    timestamp: Date.now()
  });
  
  if (figmaProxyDiagnostics.length > FIGMA_CAPTURE_PROXY_MAX_DIAG) {
    figmaProxyDiagnostics = figmaProxyDiagnostics.slice(-FIGMA_CAPTURE_PROXY_MAX_DIAG);
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      mode: 'cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function handleProxyFetch(request) {
  const { url, imageId } = request;
  
  if (figmaProxyMemCache.has(url)) {
    return { url, data: figmaProxyMemCache.get(url), cached: true };
  }
  
  if (figmaProxySessionCache[url]) {
    figmaProxyMemCache.set(url, figmaProxySessionCache[url]);
    return { url, data: figmaProxySessionCache[url], cached: true };
  }
  
  return new Promise((resolve) => {
    const inFlightKey = url;
    
    if (figmaProxyInFlight.has(inFlightKey)) {
      figmaProxyInFlight.get(inFlightKey).push(resolve);
      return;
    }
    
    if (figmaProxyActive >= figmaProxyMaxConcurrency) {
      figmaProxyQueue.push({ request, resolve });
      return;
    }
    
    figmaProxyInFlight.set(inFlightKey, [resolve]);
    figmaProxyActive++;
    
    fetchWithTimeout(url, FIGMA_CAPTURE_FETCH_TIMEOUT_MS)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result;
          figmaProxyMemCache.set(url, base64);
          figmaProxySessionCache[url] = base64;
          figmaProxyActive--;
          
          addDiagnostic({ type: 'success', url });
          
          const resolvers = figmaProxyInFlight.get(inFlightKey);
          figmaProxyInFlight.delete(inFlightKey);
          resolvers.forEach(r => r({ url, data: base64 }));
          
          processProxyQueue();
        };
        reader.onerror = () => {
          figmaProxyActive--;
          addDiagnostic({ type: 'error', url, error: 'FileReader error' });
          
          const resolvers = figmaProxyInFlight.get(inFlightKey);
          figmaProxyInFlight.delete(inFlightKey);
          resolvers.forEach(r => r({ url, error: 'FileReader error' }));
          
          processProxyQueue();
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        figmaProxyActive--;
        addDiagnostic({ type: 'error', url, error: error.message });
        
        const resolvers = figmaProxyInFlight.get(inFlightKey);
        figmaProxyInFlight.delete(inFlightKey);
        resolvers.forEach(r => r({ url, error: error.message }));
        
        processProxyQueue();
      });
  });
}

function processProxyQueue() {
  while (figmaProxyQueue.length > 0 && figmaProxyActive < figmaProxyMaxConcurrency) {
    const { request, resolve } = figmaProxyQueue.shift();
    
    const inFlightKey = request.url;
    if (figmaProxyInFlight.has(inFlightKey)) {
      figmaProxyInFlight.get(inFlightKey).push(resolve);
      continue;
    }
    
    figmaProxyInFlight.set(inFlightKey, [resolve]);
    figmaProxyActive++;
    
    fetchWithTimeout(request.url, FIGMA_CAPTURE_FETCH_TIMEOUT_MS)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result;
          figmaProxyMemCache.set(request.url, base64);
          figmaProxySessionCache[request.url] = base64;
          figmaProxyActive--;
          
          addDiagnostic({ type: 'success', url: request.url });
          
          const resolvers = figmaProxyInFlight.get(inFlightKey);
          figmaProxyInFlight.delete(inFlightKey);
          resolvers.forEach(r => r({ url: request.url, data: base64 }));
          
          processProxyQueue();
        };
        reader.onerror = () => {
          figmaProxyActive--;
          const resolvers = figmaProxyInFlight.get(inFlightKey);
          figmaProxyInFlight.delete(inFlightKey);
          resolvers.forEach(r => r({ url: request.url, error: 'FileReader error' }));
          processProxyQueue();
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        figmaProxyActive--;
        addDiagnostic({ type: 'error', url: request.url, error: error.message });
        
        const resolvers = figmaProxyInFlight.get(inFlightKey);
        figmaProxyInFlight.delete(inFlightKey);
        resolvers.forEach(r => r({ url: request.url, error: error.message }));
        
        processProxyQueue();
      });
  }
}

async function runCapture(tabId) {
  await injectScriptFileMain(tabId, CAPTURE_FILE);
  await sleep(300);
  
  await injectScriptFileIsolated(tabId, TOOLBAR_FILE);
  await sleep(100);
  
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'showToolbar' });
  } catch (e) {
    console.log('Toolbar message failed, continuing...', e);
  }
  
  await injectScriptFileMain(tabId, RUNNER_FILE);
  
  let attempts = 0;
  const maxAttempts = 60;
  let result = null;
  
  while (attempts < maxAttempts) {
    await sleep(1000);
    
    try {
      const [{ result: captureResult }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          if (window.__figmaCaptureResult) {
            return window.__figmaCaptureResult;
          }
          if (window.__figmaCaptureError) {
            throw new Error(window.__figmaCaptureError);
          }
          return null;
        }
      });
      
      if (captureResult) {
        result = captureResult;
        break;
      }
    } catch (e) {
      console.log('Capture check error:', e);
    }
    
    attempts++;
  }
  
  if (!result) {
    throw new Error('Capture timed out after 60 seconds');
  }
  
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;
  
  if (action === 'enableAssetProxyFetch') {
    (async () => {
      try {
        figmaProxyEnabled = message.proxyMode || false;
        await loadConcurrencyConfig();
        
        if (figmaProxyEnabled) {
          await loadProxySession();
        }
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        
        const result = await runCapture(tab.id);
        
        if (result) {
          const blob = new Blob([result], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          await chrome.downloads.download({
            url: url,
            filename: `figma-capture-${Date.now()}.fig`,
            saveAs: true
          });
          
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'hideToolbar' });
          } catch (e) {}
          
          if (figmaProxyEnabled) {
            await saveProxySession();
          }
          
          sendResponse({ success: true });
        } else {
          throw new Error('Capture returned no result');
        }
      } catch (error) {
        console.error('Capture error:', error);
        
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            await chrome.tabs.sendMessage(tab.id, { action: 'hideToolbar' });
          }
        } catch (e) {}
        
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
  
  if (action === 'proxyFetch') {
    if (!figmaProxyEnabled) {
      sendResponse({ url: message.url, error: 'Proxy mode not enabled' });
      return false;
    }
    
    (async () => {
      const result = await handleProxyFetch(message);
      sendResponse(result);
    })();
    
    return true;
  }
  
  if (action === 'getDiagnostics') {
    sendResponse({ diagnostics: figmaProxyDiagnostics });
    return false;
  }
  
  if (action === 'clearSession') {
    figmaProxySessionCache = {};
    figmaProxyMemCache.clear();
    chrome.storage.local.remove([FIGMA_CAPTURE_PROXY_SESSION_KEY]);
    sendResponse({ success: true });
    return false;
  }
  
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Web to Figma extension installed');
  loadConcurrencyConfig();
});
