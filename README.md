# Vue GitHub Assets

<p align="center">
  <strong>🖼️ 一个优雅的 Vue 3 插件，用于管理 GitHub 仓库中的图片资源</strong>
</p>

<p align="center">
  <a href="#特性">特性</a> •
  <a href="#安装">安装</a> •
  <a href="#开发与调试">开发与调试</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#api">API</a> •
  <a href="#组件">组件</a> •
  <a href="#images-仓库配置">Images 仓库配置</a>
</p>

---

## ✨ 特性

- 🔐 **隐私保护** - 纯本地清洗 EXIF 信息（GPS、设备型号等），绝不上传隐私数据
- 📦 **零冲突** - 使用 peerDependencies，避免 Vue/Octokit 多实例问题
- 🎨 **iOS 风格 UI** - 现代化设计，移动端适配优化，支持亮色/暗色主题
- 🚀 **极速加载** - Manifest 索引 + 智能缩略图缓存复用策略
- ☁️ **CDN 加速** - wsrv.nl 主用 + statically.io 备用，自动降级
- 📁 **文件夹管理** - 支持创建子目录分类管理图片
- 🖱️ **拖拽上传** - 内置拖拽区域，支持批量上传
- 📋 **多格式复制** - 支持 URL / Markdown / HTML 格式
- 🛠️ **工具导出** - 提供独立的 `cleanupExifFromFile` 工具函数

## 📦 安装

### 1. 配置 npm registry

```bash
# 在项目根目录创建 .npmrc
echo "@jixiaoyong:registry=https://npm.pkg.github.com" >> .npmrc
```

### 2. 安装依赖

```bash
# 确保已安装 peer dependencies
npm install vue@^3.3.0 @octokit/rest@^19.0.0

# 安装插件
npm install @jixiaoyong/vue-github-assets
```

## 🚀 快速开始

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

## 📖 API

### `useAssetStore(config)`

| 参数       | 类型                       | 必填 | 说明                     |
| ---------- | -------------------------- | ---- | ------------------------ |
| `token`    | `MaybeRefOrGetter<string>` | ✅   | GitHub Token，支持响应式 |
| `owner`    | `string`                   | ✅   | GitHub 用户名            |
| `repo`     | `string`                   | ✅   | 仓库名                   |
| `branch`   | `string`                   | ❌   | 分支名，默认 `main`      |
| `basePath` | `string`                   | ❌   | 基础路径                 |

#### 返回值

| 属性/方法                | 类型                      | 说明         |
| ------------------------ | ------------------------- | ------------ |
| `loading`                | `Ref<boolean>`            | 加载状态     |
| `error`                  | `Ref<Error \| null>`      | 错误信息     |
| `fileList`               | `Ref<AssetItem[]>`        | 文件列表     |
| `upload(file, options?)` | `Promise<UploadResult>`   | 上传文件     |
| `uploadMultiple(files)`  | `Promise<UploadResult[]>` | 批量上传     |
| `remove(item)`           | `Promise<void>`           | 删除文件     |
| `forceRefresh(path)`     | `Promise<void>`           | 强制刷新缓存 |

## 🎨 组件

### `<AssetManager>`

完整的资源管理器 UI。

```vue
<AssetManager
  :config="config"
  :show-folders="true"
  :copy-formats="['url', 'markdown', 'html']"
  @select="handleSelect"
/>
```

### `<SmartImage>`

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

## 📁 Images 仓库配置

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

## 🎯 主题定制

```css
:root {
  --vga-accent: #your-brand-color;
  --vga-radius-md: 16px;
}
```

## 📄 文档

- [架构设计](docs/ARCHITECTURE.md)
- [API 参考](docs/API.md)
- [宿主应用配置](docs/HOST_SETUP.md)
- [开发规范](docs/CONTRIBUTING.md)

## 📄 License

MIT © [jixiaoyong](https://github.com/jixiaoyong)
