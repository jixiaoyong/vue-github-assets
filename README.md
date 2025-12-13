# Vue GitHub Assets

一个用于管理 GitHub 仓库图片资源的 Vue 3 插件，支持隐私保护、CDN 加速和 iOS 风格 UI。

A Vue 3 plugin for managing image assets in GitHub repositories with privacy protection, CDN optimization, and iOS-style UI.

**[English](README.en.md)** | **[中文](README.md)**

---

- [特性](#特性)
- [安装](#安装)
- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [组件](#组件)
- [工具函数](#工具函数)
- [主题定制](#主题定制)
- [Images 仓库配置](#images-仓库配置)
- [文档](#文档)

---

## 特性

- **隐私保护** - 上传前本地清洗 EXIF 信息（GPS、设备型号等），绝不上传隐私数据
- **零冲突** - 使用 peerDependencies，避免 Vue/Octokit 多实例问题
- **iOS 风格 UI** - 现代化设计，支持亮色/暗色主题，移动端适配优化
- **极速加载** - Manifest 索引 + Stale-While-Revalidate 缓存策略
- **CDN 加速** - wsrv.nl 主用 + statically.io 备用，自动降级
- **文件夹管理** - 支持创建子目录分类管理图片
- **拖拽上传** - 内置拖拽区域，支持批量上传
- **多格式复制** - 支持 URL / Markdown / HTML 格式
- **工具导出** - 提供独立的 `cleanupExifFromFile` 工具函数

## 安装

### 1. 安装依赖

```bash
# 确保已安装 peer dependencies
npm install vue@^3.3.0 @octokit/rest@^19.0.0

# 从 GitHub 仓库安装
npm install github:jixiaoyong/vue-github-assets

# 或指定版本 (推荐)
npm install github:jixiaoyong/vue-github-assets#v0.1.1
```

### 2. 故障排除

安装时会自动执行构建脚本，如遇问题请检查：

1. **环境要求**：确保安装了 Git 和 Node.js 20.19+
2. **网络问题**：确保能访问 GitHub

## 快速开始

### 基础用法

```vue
<script setup>
import { reactive, computed } from "vue";
import { useAssetStore, AssetManager } from "@jixiaoyong/vue-github-assets";

const config = reactive({
  token: computed(() => userStore.githubToken),
  owner: "jixiaoyong",
  repo: "images",
  basePath: "blog/",
});

const { upload, forceRefresh } = useAssetStore(config);

async function handleUpload(file) {
  const result = await upload(file);
  console.log("上传成功:", result.url);
  // https://jixiaoyong.github.io/images/blog/xxx.jpg
}
</script>

<template>
  <AssetManager :config="config" @select="(url) => console.log('选中:', url)" />
</template>
```

### SmartImage CDN 优化

```vue
<script setup>
import { SmartImage } from "@jixiaoyong/vue-github-assets";
</script>

<template>
  <!-- 自动转换为 CDN 链接并输出 WebP -->
  <SmartImage
    src="https://jixiaoyong.github.io/images/photo.jpg"
    :width="800"
    lazy
  />

  <!-- 频繁变化的图片，跳过缓存 -->
  <SmartImage src="..." mutable />
</template>
```

### 独立使用隐私清理工具

`cleanupExifFromFile` 可以在不上传文件的情况下，仅在本地清理图片的隐私信息。

```typescript
import { cleanupExifFromFile } from "@jixiaoyong/vue-github-assets";

async function clean(file: File) {
  // 1. 清理 EXIF
  const { file: cleanedFile, removedTags } = await cleanupExifFromFile(file);

  console.log("已移除的标签:", removedTags);
  // ["GPS", "Exif.Image.Make", "Exif.Image.Model", ...]

  // 2. 将清理后的文件用于其他用途（如上传到 S3 或预览）
  const url = URL.createObjectURL(cleanedFile);
}
```

## API 参考

### useAssetStore(config, options?)

核心资源管理 Composable。

#### 配置 (`StoreConfig`)

| 参数           | 类型                       | 必填 | 说明                     |
| -------------- | -------------------------- | ---- | ------------------------ |
| `token`        | `MaybeRefOrGetter<string>` | 是   | GitHub Token，支持响应式 |
| `owner`        | `string`                   | 是   | GitHub 用户名            |
| `repo`         | `string`                   | 是   | 仓库名                   |
| `branch`       | `string`                   | 否   | 分支名，默认 `main`      |
| `basePath`     | `string`                   | 否   | 基础路径                 |
| `generatePath` | `(file: File) => string`   | 否   | 自定义文件路径生成函数   |

#### 选项 (`UseAssetStoreOptions`)

| 参数                  | 类型                                 | 说明                      |
| --------------------- | ------------------------------------ | ------------------------- |
| `onExifCleanupFailed` | `(failedItems) => Promise<Action[]>` | EXIF 清理失败时的回调函数 |

#### 返回值

| 属性/方法               | 类型                      | 说明               |
| ----------------------- | ------------------------- | ------------------ |
| `loading`               | `Ref<boolean>`            | 加载状态           |
| `error`                 | `Ref<Error \| null>`      | 错误信息           |
| `fileList`              | `Ref<AssetItem[]>`        | 文件列表           |
| `folders`               | `Ref<FolderItem[]>`       | 文件夹列表         |
| `currentPath`           | `Ref<string>`             | 当前目录路径       |
| `upload(file, opts?)`   | `Promise<UploadResult>`   | 上传文件           |
| `uploadMultiple(files)` | `Promise<UploadResult[]>` | 批量上传           |
| `remove(item)`          | `Promise<void>`           | 删除文件           |
| `removeMultiple(items)` | `Promise<void>`           | 批量删除           |
| `createFolder(name)`    | `Promise<void>`           | 创建文件夹         |
| `forceRefresh(path)`    | `Promise<void>`           | 强制刷新缓存       |
| `getDisplayUrl(item)`   | `string`                  | 获取 GitHub Pages URL |
| `getOptimizedUrl(item)` | `string`                  | 获取 CDN 优化 URL  |

## 组件

### AssetManager

完整的资源管理器 UI，包含文件夹树、上传区和图片网格。

```vue
<AssetManager
  :config="config"
  :show-folders="true"
  :copy-formats="['url', 'markdown', 'html']"
  @select="handleSelect"
/>
```

### SmartImage

CDN 优化图片组件，自动转换 GitHub Pages URL。

```vue
<SmartImage
  src="https://jixiaoyong.github.io/images/photo.jpg"
  :width="800"
  :quality="75"
  lazy
  mutable  <!-- 跳过缓存 -->
/>
```

**URL 转换逻辑:**

```
输入: https://jixiaoyong.github.io/images/photos/cat.jpg
  -> 提取路径: photos/cat.jpg
  -> Raw URL: https://raw.githubusercontent.com/jixiaoyong/images/main/photos/cat.jpg
  -> CDN URL: https://wsrv.nl/?url={rawUrl}&output=webp&q=75&w=800
```

### AssetUploader

支持拖拽上传的组件，内置 EXIF 清理功能。

```vue
<AssetUploader :config="config" @upload="handleUpload" />
```

### FolderTree

递归文件夹树组件。

```vue
<FolderTree
  :folders="['a/b', 'a/c']"
  :current-path="currentPath"
  @select="selectPath"
/>
```

## 工具函数

### EXIF 清理器

支持 JPEG 和 HEIC/HEIF 格式的隐私信息清理。

```typescript
import {
  cleanupExifFromFile,  // 清理单个文件
  cleanupExifFromBlob,  // 清理 Blob
  cleanupExifBatch,     // 批量清理
  isJpegFormat,         // 格式检测
  isHeicFormat,
  isSupportedFormat,
  PRIVACY_TAGS,         // 隐私标签列表
  USEFUL_TAGS,          // 保留标签列表
} from "@jixiaoyong/vue-github-assets";
```

### URL 转换器

在 GitHub Pages、Raw 和 CDN 链接之间转换的工具函数。

```typescript
import {
  toRawUrl,           // Pages URL -> Raw URL
  toCdnUrl,           // Raw/Pages URL -> CDN URL
  toDisplayUrl,       // 任意 URL -> Pages URL
  buildUrlChain,      // 构建完整的 URL 链
  isGitHubPagesUrl,   // URL 检测
  isGitHubRawUrl,
} from "@jixiaoyong/vue-github-assets";
```

### 图片压缩器

上传前可选的图片压缩功能。

```typescript
import { compressImage } from "@jixiaoyong/vue-github-assets";

const compressed = await compressImage(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  convertToWebP: true,
});
```

## 主题定制

```css
:root {
  --vga-accent: #your-brand-color;
  --vga-radius-md: 16px;
}
```

完整的 CSS 变量参考请查看 [CONTRIBUTING.md](docs/CONTRIBUTING.md)。

## Images 仓库配置

### GitHub Action 自动同步

在你的 images 仓库添加以下配置，每次文件变化自动更新 `.vga-manifest.json`：

```yaml
# .github/workflows/update-manifest.yml
name: Update Asset Manifest

on:
  push:
    branches: [main]
    paths-ignore:
      - ".vga-manifest.json"

jobs:
  update-manifest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate Manifest
        run: node scripts/generate-manifest.js
      - name: Commit
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .vga-manifest.json
          git diff --staged --quiet || git commit -m "chore: update manifest"
          git push
```

生成脚本见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 文档

- [架构设计](docs/ARCHITECTURE.md)
- [API 参考](docs/API.md)
- [宿主应用配置](docs/HOST_SETUP.md)
- [开发规范](docs/CONTRIBUTING.md)

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行示例应用
npm run example

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 许可证

MIT (c) [jixiaoyong](https://github.com/jixiaoyong)
