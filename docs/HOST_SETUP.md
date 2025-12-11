# 宿主应用配置指南

本文档说明如何在宿主应用中配置缓存策略，以确保网站更新后用户能及时看到最新内容。

## 问题背景

| 层级              | 问题                    | 影响                                  |
| ----------------- | ----------------------- | ------------------------------------- |
| 浏览器缓存        | 本地存了旧 HTML         | 单个用户看不到更新                    |
| CDN 缓存          | Cloudflare 节点缓存旧版 | 区域用户看不到更新                    |
| Service Worker    | PWA 拦截请求返回旧版    | 所有用户看不到更新                    |
| GitHub Pages 延迟 | 部署需 5 分钟           | 所有用户（本插件已通过 Raw URL 解决） |

## Cloudflare Pages 配置

在项目 `public/` 目录创建 `_headers` 文件：

```
# 所有 HTML 文件 - 不缓存，每次验证
/*
  Cache-Control: public, max-age=0, must-revalidate

# 版本检测文件 - 绝对不缓存
/version.json
  Cache-Control: no-cache, no-store, must-revalidate

# 静态资源（带 hash）- 永久缓存
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

## GitHub Pages 配置

GitHub Pages 不支持 `_headers` 文件，使用 HTML meta 标签：

```html
<head>
  <meta
    http-equiv="Cache-Control"
    content="no-cache, no-store, must-revalidate"
  />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
</head>
```

## PWA 配置 (vite-plugin-pwa)

```javascript
// vite.config.js
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // 排除版本文件的预缓存
        globIgnores: ["**/version.json", "**/*.map"],

        // 自动更新
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,

        // 运行时缓存策略
        runtimeCaching: [
          {
            // version.json 强制走网络
            urlPattern: ({ url }) => url.pathname.includes("version.json"),
            handler: "NetworkOnly",
          },
          {
            // 图片资源走 CDN 缓存
            urlPattern: /\.(?:png|jpg|jpeg|webp|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
              },
            },
          },
        ],
      },
    }),
  ],
});
```

## 版本检测

如果使用 `version.json` 检测版本，请求时加时间戳穿透缓存：

```javascript
// App.vue 或 main.ts
async function checkVersion() {
  const response = await fetch(`/version.json?t=${Date.now()}`);
  const { version } = await response.json();

  const localVersion = localStorage.getItem("app-version");
  if (localVersion && localVersion !== version) {
    // 版本变化，刷新页面
    localStorage.setItem("app-version", version);
    location.reload();
  } else {
    localStorage.setItem("app-version", version);
  }
}

// 每次路由跳转时检测
router.afterEach(() => {
  checkVersion();
});
```

## 本插件已解决的问题

本插件通过以下策略规避了 GitHub Pages 部署延迟：

1. **使用 Raw URL 作为数据源**：`git push` 后秒级可见
2. **SmartImage 自动转换**：GitHub Pages URL → Raw URL → CDN URL
3. **forceRefresh() 方法**：覆盖上传后可强制刷新图片缓存

无需额外配置，插件内部已处理图片缓存问题。
