# 重构混淆代码为可编辑代码计划

## 项目分析

### 当前文件状态

| 文件 | 大小 | 状态 | 职责 |
|------|------|------|------|
| popup.js | ~2KB | 已混淆 | 弹窗UI逻辑、配置管理、消息通信 |
| background.js | ~10KB | 已混淆 | 后台Service Worker、脚本注入、图片代理、文件下载 |
| inpage-toolbar.js | ~21KB | 已混淆 | 页面内嵌工具栏、状态展示 |
| runner.js | ~1KB | 已混淆 | 执行流程控制、滚动截图 |
| capture.js | ~125KB | 已压缩 | DOM解析、元素提取、样式计算、Figma格式生成 |

### 技术架构（来自产品文档）

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome Extension                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   Popup     │    │ Background  │    │  Content    │             │
│  │   (UI层)    │◄──▶│   Service   │◄──▶│   Script    │             │
│  │             │    │   Worker    │    │             │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                  │                  │                     │
│         ▼                  ▼                  ▼                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  popup.js   │    │background.js│    │ capture.js  │             │
│  │  popup.css  │    │             │    │ runner.js   │             │
│  │  popup.html │    │             │    │inpage-      │             │
│  │             │    │             │    │ toolbar.js  │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 重构策略

### 方案选择

由于 `capture.js` 是核心引擎且体积巨大（125KB），完整重写风险较高。采用**部分重构**策略：

1. **完全重写**：popup.js、background.js、inpage-toolbar.js、runner.js
2. **保留现有**：capture.js（核心引擎，保持稳定）

### 消息通信协议

```javascript
// Popup → Background
{
  action: 'startCapture',
  config: {
    proxyMode: boolean,
    concurrency: number
  }
}

// Background → Popup
{
  status: 'progress' | 'success' | 'error',
  progress: number,
  message: string,
  data?: any
}
```

---

## 实施步骤

### 步骤 1：重构 popup.js

**文件**：`src/popup.js`

**功能**：
- 初始化UI状态
- 加载用户配置（proxyMode、concurrency）
- 绑定事件监听器
- 发送消息到 background
- 显示状态反馈
- 支持 i18n 国际化

**代码结构**：
```javascript
// 常量定义
const STORAGE_KEY = 'figmaCaptureProxyEnabled';
const CONCURRENCY_KEY = 'proxyFetchConcurrency';
const DEFAULT_CONCURRENCY = '8';
const ALLOWED_CONCURRENCY = new Set(['4','6','8','10','12','16','20','infinite']);

// DOM 元素
const toggle = document.getElementById('assetProxyToggle');
const concurrency = document.getElementById('proxyConcurrency');
const captureBtn = document.getElementById('captureBtn');
const status = document.getElementById('status');

// 状态管理函数
function setStatus(message) { ... }
function setBusy(busy) { ... }
function normalizeConcurrency(value) { ... }

// 配置加载
async function loadConfig() { ... }

// 事件绑定
toggle.addEventListener('change', ...);
concurrency.addEventListener('change', ...);
captureBtn.addEventListener('click', ...);

// 初始化
loadConfig();
```

---

### 步骤 2：重构 background.js

**文件**：`src/background.js`

**功能**：
- 监听来自 popup 的消息
- 注入 capture.js 和 runner.js 脚本
- 管理图片代理队列
- 并发控制
- 处理图片请求代理
- 下载生成的 Figma 文件

**代码结构**：
```javascript
// 常量定义
const WORLD = 'MAIN';
const CAPTURE_FILE = 'capture.js';
const RUNNER_FILE = 'runner.js';
const TOOLBAR_FILE = 'inpage-toolbar.js';

// 代理配置
const FIGMA_CAPTURE_CONCURRENCY_KEY = 'proxyFetchConcurrency';
const FIGMA_CAPTURE_PROXY_SESSION_KEY = 'figmaCaptureProxySessionV1';
const FIGMA_CAPTURE_FETCH_TIMEOUT_MS = 8000;

// 代理状态管理
let figmaProxyActive = 0;
let figmaProxyMaxConcurrency = 8;
const figmaProxyQueue = [];
const figmaProxyInFlight = new Map();
const figmaProxyMemCache = new Map();

// 核心函数
async function injectScriptFile(tabId, file) { ... }
async function runCapture(tabId) { ... }
async function handleProxyFetch(request) { ... }
function processProxyQueue() { ... }

// 消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { ... });
```

---

### 步骤 3：重构 inpage-toolbar.js

**文件**：`src/inpage-toolbar.js`

**功能**：
- 创建页面内嵌工具栏
- 显示采集进度
- 提供取消按钮
- 与 background 通信

**代码结构**：
```javascript
// 常量定义
const TOOLBAR_ID = '__figma_capture_toolbar__';

// 创建工具栏
function createToolbar() { ... }

// 更新进度
function updateProgress(progress, message) { ... }

// 移除工具栏
function removeToolbar() { ... }

// 事件监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { ... });
```

---

### 步骤 4：重构 runner.js

**文件**：`src/runner.js`

**功能**：
- 执行页面滚动
- 等待图片加载
- 调用 capture.js 的 captureForDesign 函数
- 返回采集结果

**代码结构**：
```javascript
// 主执行函数
(async () => {
  // 检查 capture.js 是否加载
  if (!window.figma?.captureForDesign) {
    throw new Error('window.figma.captureForDesign is not available.');
  }
  
  // 滚动页面以触发懒加载
  const scrollStep = Math.max(400, Math.floor(window.innerHeight * 0.8));
  for (let y = 0; y < document.body.scrollHeight; y += scrollStep) {
    window.scrollTo(0, y);
    await sleep(400);
  }
  
  // 回到顶部
  await sleep(1500);
  window.scrollTo(0, 0);
  
  // 等待所有图片加载
  const images = Array.from(document.images || []);
  await Promise.allSettled(images.map(img => 
    img.complete ? Promise.resolve() : new Promise(resolve => {
      img.addEventListener('load', resolve);
      img.addEventListener('error', resolve);
    })
  ));
  
  // 执行采集
  return await window.figma.captureForDesign();
})();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### 步骤 5：创建构建配置

**文件**：`package.json`

```json
{
  "name": "web-to-figma",
  "version": "1.0.0",
  "scripts": {
    "build": "node scripts/build.js",
    "watch": "node scripts/build.js --watch"
  },
  "devDependencies": {
    "esbuild": "^0.19.0"
  }
}
```

**文件**：`scripts/build.js`

使用 esbuild 进行打包和压缩。

---

### 步骤 6：更新项目结构

```
figma-capture-extension/
├── src/                      # 源代码目录
│   ├── popup.js              # 弹窗逻辑
│   ├── background.js         # 后台服务
│   ├── inpage-toolbar.js     # 页面工具栏
│   ├── runner.js             # 执行脚本
│   └── i18n.js               # 国际化
├── dist/                     # 构建输出目录
│   ├── popup.js
│   ├── background.js
│   ├── inpage-toolbar.js
│   └── runner.js
├── _locales/                 # 国际化文件
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── logo/                     # 图标资源
├── capture.js                # 核心引擎（保留）
├── popup.html
├── popup.css
├── manifest.json
├── package.json
└── scripts/
    └── build.js              # 构建脚本
```

---

## 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/popup.js` | 新建 | 重写的弹窗逻辑 |
| `src/background.js` | 新建 | 重写的后台服务 |
| `src/inpage-toolbar.js` | 新建 | 重写的页面工具栏 |
| `src/runner.js` | 新建 | 重写的执行脚本 |
| `src/i18n.js` | 移动 | 从根目录移动 |
| `package.json` | 新建 | 项目配置和构建脚本 |
| `scripts/build.js` | 新建 | 构建脚本 |
| `manifest.json` | 修改 | 更新文件路径引用 |
| `popup.html` | 修改 | 更新脚本引用路径 |

---

## 注意事项

1. **capture.js 保留**：核心抓取引擎保持不变，避免破坏复杂功能
2. **向后兼容**：保持与现有 capture.js 的接口兼容
3. **i18n 支持**：所有用户可见文本使用 chrome.i18n.getMessage()
4. **错误处理**：完善的错误捕获和用户反馈
5. **测试验证**：重构后需要完整测试所有功能

---

## 预期成果

1. 清晰可读的源代码
2. 完整的国际化支持
3. 便于后续维护和扩展
4. 保持原有功能完整性
