# 为 Web to Figma 插件添加中文版本计划

## 当前状态分析

### 已有中文内容
- `popup.html` 已设置 `lang="zh-CN"`，界面文本均为中文
- `manifest.json` 的 description 已包含中文说明

### 需要国际化的内容
- `manifest.json` 中的 `name` 和 `default_title` 为英文
- 缺少 Chrome Extension 国际化机制（i18n API）

---

## 实施方案

采用 Chrome Extension 官方推荐的 i18n 方案，支持中英文双语切换。

### 文件结构变更

```
figma-capture-extension/
├── _locales/                    # 新增：国际化文件夹
│   ├── en/                      # 英文语言包
│   │   └── messages.json
│   └── zh_CN/                   # 简体中文语言包
│       └── messages.json
├── manifest.json                # 修改：使用 i18n 引用
├── popup.html                   # 修改：使用 i18n 消息
├── popup.js                     # 修改：动态加载 i18n 文本
└── ... (其他文件不变)
```

---

## 实施步骤

### 步骤 1：创建英文语言包
**文件**：`_locales/en/messages.json`

包含所有需要翻译的文本：
- 扩展名称
- 扩展描述
- 弹窗标题
- 配置选项标签
- 按钮文本
- 状态消息
- 提示信息

### 步骤 2：创建中文语言包
**文件**：`_locales/zh_CN/messages.json`

包含中文翻译内容。

### 步骤 3：修改 manifest.json
- 添加 `default_locale` 字段
- 将 `name` 改为 `__MSG_extensionName__`
- 将 `description` 改为 `__MSG_extensionDesc__`
- 将 `default_title` 改为 `__MSG_browserActionTitle__`

### 步骤 4：修改 popup.html
- 将硬编码的中文文本替换为 i18n 占位符
- 使用 `data-i18n` 属性标记需要翻译的元素

### 步骤 5：修改 popup.js
- 添加 i18n 初始化逻辑
- 动态替换页面文本为对应语言

---

## 详细内容规划

### messages.json 结构（英文版）

```json
{
  "extensionName": {
    "message": "Web to Figma",
    "description": "Extension name"
  },
  "extensionDesc": {
    "message": "Capture web pages and convert to editable Figma designs with one click.",
    "description": "Extension description"
  },
  "browserActionTitle": {
    "message": "Capture page for Figma",
    "description": "Browser action tooltip"
  },
  "popupTitle": {
    "message": "Web to Figma",
    "description": "Popup title"
  },
  "proxyModeLabel": {
    "message": "Cross-origin image proxy mode",
    "description": "Proxy mode toggle label"
  },
  "concurrencyLabel": {
    "message": "Image capture concurrency",
    "description": "Concurrency select label"
  },
  "concurrencyInfinite": {
    "message": "Unlimited",
    "description": "Infinite concurrency option"
  },
  "hintText": {
    "message": "Proxy is off by default. Concurrency only affects image capture speed and stability when proxy is enabled.",
    "description": "Hint text below options"
  },
  "captureButton": {
    "message": "Start Capture",
    "description": "Capture button text"
  },
  "statusReady": {
    "message": "Ready",
    "description": "Ready status"
  },
  "statusCapturing": {
    "message": "Capturing...",
  },
  "statusSuccess": {
    "message": "Capture complete!"
  },
  "statusError": {
    "message": "Capture failed"
  }
}
```

### messages.json 结构（中文版）

```json
{
  "extensionName": {
    "message": "Web to Figma",
    "description": "扩展名称"
  },
  "extensionDesc": {
    "message": "Web to Figma 一键抓取网页并转换为可编辑设计稿，By 派大鑫（小红书）。",
    "description": "扩展描述"
  },
  "browserActionTitle": {
    "message": "抓取页面到 Figma",
    "description": "浏览器操作提示"
  },
  "popupTitle": {
    "message": "Web to Figma",
    "description": "弹窗标题"
  },
  "proxyModeLabel": {
    "message": "跨域图片代理模式",
    "description": "代理模式开关标签"
  },
  "concurrencyLabel": {
    "message": "图片采集并发",
    "description": "并发选择标签"
  },
  "concurrencyInfinite": {
    "message": "无限",
    "description": "无限并发选项"
  },
  "hintText": {
    "message": "默认关闭代理。并发仅影响开启代理后的图片抓取速度与稳定性。",
    "description": "提示文本"
  },
  "captureButton": {
    "message": "开始采集",
    "description": "采集按钮文本"
  },
  "statusReady": {
    "message": "准备就绪",
    "description": "就绪状态"
  },
  "statusCapturing": {
    "message": "采集中..."
  },
  "statusSuccess": {
    "message": "采集完成！"
  },
  "statusError": {
    "message": "采集失败"
  }
}
```

---

## 语言切换机制

Chrome Extension 会根据浏览器语言设置自动选择对应的语言包：
- 浏览器语言为中文 → 使用 `zh_CN` 语言包
- 浏览器语言为英文或其他 → 使用 `en` 语言包（默认）

---

## 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `_locales/en/messages.json` | 新建 | 英文语言包 |
| `_locales/zh_CN/messages.json` | 新建 | 中文语言包 |
| `manifest.json` | 修改 | 添加 default_locale，使用 i18n 引用 |
| `popup.html` | 修改 | 使用 i18n 占位符 |
| `popup.js` | 修改 | 添加 i18n 初始化逻辑 |

---

## 预期效果

1. **中文浏览器用户**：看到完整的中文界面
2. **英文浏览器用户**：看到完整的英文界面
3. **其他语言用户**：默认显示英文界面
