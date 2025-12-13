# API 文档

## useAssetStore

管理资源的核心 Composable。

```typescript
import { useAssetStore } from '@jixiaoyong/vue-github-assets';

const store = useAssetStore(config, options?);
```

### 配置 (`StoreConfig`)

| 属性           | 类型                       | 说明                           |
| -------------- | -------------------------- | ------------------------------ |
| `token`        | `MaybeRefOrGetter<string>` | GitHub Personal Access Token   |
| `owner`        | `string`                   | 仓库拥有者 (用户名/组织名)     |
| `repo`         | `string`                   | 仓库名称                       |
| `branch`       | `string`                   | (可选) 分支名称，默认为 'main' |
| `initialPath`  | `string`                   | (可选) 初始展示路径 (默认: '' 即根目录) |
| `generatePath` | `(file: File) => string`   | (可选) 自定义文件路径生成函数  |

### 选项 (`UseAssetStoreOptions`)

| 属性                  | 类型                                 | 说明                      |
| --------------------- | ------------------------------------ | ------------------------- |
| `onExifCleanupFailed` | `(failedItems) => Promise<Action[]>` | EXIF 清理失败时的回调函数 |

### 返回值 (`UseAssetStoreReturn`)

#### 状态

| 属性          | 类型                 | 说明           |
| ------------- | -------------------- | -------------- |
| `loading`     | `Ref<boolean>`       | 加载状态       |
| `error`       | `Ref<Error \| null>` | 错误对象或 null|
| `fileList`    | `Ref<AssetItem[]>`   | 当前路径下的资源列表 |
| `folders`     | `Ref<FolderItem[]>`  | 子文件夹列表   |
| `currentPath` | `Ref<string>`        | 当前目录路径   |

#### 方法

| 方法                        | 类型                      | 说明                       |
| --------------------------- | ------------------------- | -------------------------- |
| `upload(file, options?)`    | `Promise<UploadResult>`   | 上传单个文件               |
| `uploadMultiple(files, options?)` | `Promise<UploadResult[]>` | 批量上传文件          |
| `remove(item)`              | `Promise<void>`           | 删除资源                   |
| `removeMultiple(items)`     | `Promise<void>`           | 批量删除资源               |
| `createFolder(name)`        | `Promise<void>`           | 创建新文件夹 (通过 .gitkeep) |
| `fetchList(path?)`          | `Promise<void>`           | 获取指定路径的资源列表     |
| `forceRefresh(path)`        | `Promise<void>`           | 强制刷新某个项目的缓存     |
| `getDisplayUrl(item)`       | `string`                  | 获取 GitHub Pages URL      |
| `getOptimizedUrl(item, options)` | `string`             | 获取 CDN 优化链接          |

---

## useUploader

上传逻辑 Composable，通常由 `useAssetStore` 内部使用。

```typescript
import { useUploader } from '@jixiaoyong/vue-github-assets';
```

### 上传选项 (`UploadOptions`)

| 属性            | 类型              | 说明                         |
| --------------- | ----------------- | ---------------------------- |
| `skipExifClean` | `boolean`         | 跳过 EXIF 清洗 (默认: false) |
| `compress`      | `CompressOptions` | 压缩选项 (默认: null = 不压缩) |
| `folder`        | `string`          | 目标文件夹                   |

### 压缩选项 (`CompressOptions`)

| 属性           | 类型      | 说明            |
| -------------- | --------- | --------------- |
| `maxWidth`     | `number`  | 最大宽度        |
| `maxHeight`    | `number`  | 最大高度        |
| `quality`      | `number`  | 质量 (0-1)      |
| `convertToWebP`| `boolean` | 转换为 WebP 格式|

### 上传结果 (`UploadResult`)

| 属性      | 类型      | 说明                |
| --------- | --------- | ------------------- |
| `success` | `boolean` | 是否成功            |
| `url`     | `string`  | GitHub Pages URL    |
| `rawUrl`  | `string`  | Raw URL             |
| `error`   | `Error`   | 错误信息 (如果失败) |

---

## useManifest

Manifest 索引管理 Composable，用于加速文件列表加载。

```typescript
import { useManifest } from '@jixiaoyong/vue-github-assets';
```

### Manifest 数据结构 (`VgaManifest`)

```typescript
interface VgaManifest {
  version: string;        // 格式版本
  lastUpdated: string;    // ISO 时间戳
  lastSyncedSha: string;  // 根目录 SHA
  files: AssetItem[];     // 文件列表
  folders: string[];      // 文件夹列表
}

interface AssetItem {
  name: string;           // 文件名
  path: string;           // 相对路径
  size: number;           // 文件大小 (bytes)
  sha: string;            // Git SHA
  mimeType?: string;      // MIME 类型
  uploadedAt?: string;    // 上传时间
}
```

---

## 组件

### AssetManager

完整的资源管理界面组件。/ Complete asset management UI component.

```vue
<AssetManager
  :config="config"
  :show-folders="true"
  :show-uploader="true"
  :copy-formats="['url', 'markdown', 'html']"
  @confirm="handleConfirm"
  @upload="handleUpload"
  @delete="handleDelete"
  @copy="handleCopy"
  @error="handleError"
/>
```

| Props          | 类型 / Type   | 默认值 / Default | 说明 / Description              |
| -------------- | ------------- | ---------------- | ------------------------------- |
| `config`       | `StoreConfig` | -                | 仓库配置 (必填) / Required config |
| `showFolders`  | `boolean`     | `true`           | 显示文件夹树 / Show folder tree |
| `showUploader` | `boolean`     | `true`           | 显示上传区域 / Show uploader    |
| `copyFormats`  | `string[]`    | `['url']`        | 复制格式选项 / Copy format options |

| Events    | 参数 / Parameters                                    | 说明 / Description                    |
| --------- | ---------------------------------------------------- | ------------------------------------- |
| `confirm` | `(urls: string[], items: AssetItem[])`               | 确认选择时触发 / On confirm selection |
| `upload`  | `(results: { url: string, item: AssetItem }[])`      | 上传成功后触发 / After successful upload |
| `delete`  | `(results: { url: string, item: AssetItem }[])`      | 删除成功后触发 / After successful delete |
| `copy`    | `(content: string, format: CopyFormat, item: AssetItem)` | 复制链接时触发 / On copy link |
| `error`   | `(error: Error)`                                     | 操作出错时触发 / On error             |

---

### SmartImage

CDN 优化的图片组件，包含缓存管理和加载状态。

```vue
<SmartImage
  src="https://jixiaoyong.github.io/images/foo.jpg"
  :width="800"
  :quality="80"
  lazy
  mutable
/>
```

| Props     | 类型      | 默认值  | 说明                   |
| --------- | --------- | ------- | ---------------------- |
| `src`     | `string`  | -       | 图片 URL (必填)        |
| `width`   | `number`  | -       | 输出宽度               |
| `height`  | `number`  | -       | 输出高度               |
| `quality` | `number`  | `75`    | 输出质量 (1-100)       |
| `lazy`    | `boolean` | `false` | 启用懒加载             |
| `mutable` | `boolean` | `false` | 跳过缓存 (加时间戳)    |

**URL 转换逻辑:**

```
输入: https://jixiaoyong.github.io/images/photos/cat.jpg
  -> Raw URL: https://raw.githubusercontent.com/jixiaoyong/images/main/photos/cat.jpg
  -> CDN URL: https://wsrv.nl/?url={rawUrl}&output=webp&q=75&w=800
```

---

### AssetUploader

支持拖拽上传的组件，内置 EXIF 清理功能。

```vue
<AssetUploader
  :config="config"
  :accept="['image/*']"
  :multiple="true"
  :max-size="10 * 1024 * 1024"
  @upload="handleUpload"
  @error="handleError"
>
  <!-- 自定义上传区内容 -->
  <template #default="{ isDragging }">
    <div :class="{ dragging: isDragging }">
      拖拽图片到此处
    </div>
  </template>
</AssetUploader>
```

| Props     | 类型          | 默认值       | 说明           |
| --------- | ------------- | ------------ | -------------- |
| `config`  | `StoreConfig` | -            | 仓库配置 (必填)|
| `accept`  | `string[]`    | `['image/*']`| 接受的文件类型 |
| `multiple`| `boolean`     | `true`       | 允许多选       |
| `maxSize` | `number`      | `10MB`       | 最大文件大小   |

---

### FolderTree

递归文件夹树组件。

```vue
<FolderTree
  :folders="['a/b', 'a/c']"
  :current-path="currentPath"
  @select="selectPath"
/>
```

| Props         | 类型       | 说明           |
| ------------- | ---------- | -------------- |
| `folders`     | `string[]` | 文件夹路径列表 |
| `currentPath` | `string`   | 当前选中路径   |

---

### ExifWarningDialog

EXIF 清理失败时的处理弹窗。通常集成在 AssetManager 内部使用。

---

## 工具函数

### EXIF 清理器

```typescript
import {
  cleanupExifFromFile,
  cleanupExifFromBlob,
  cleanupExifBatch,
  cleanExif,
  isJpegFormat,
  isHeicFormat,
  isSupportedFormat,
  formatFileSize,
  PRIVACY_TAGS,
  USEFUL_TAGS,
} from "@jixiaoyong/vue-github-assets";
```

#### cleanupExifFromFile

清理单个文件的 EXIF 隐私信息。

```typescript
const result = await cleanupExifFromFile(file, options?);
```

| 参数    | 类型             | 说明       |
| ------- | ---------------- | ---------- |
| `file`  | `File`           | 要清理的文件 |
| `options` | `CleanupOptions` | 清理选项   |

**CleanupOptions:**

| 属性          | 类型     | 说明                    |
| ------------- | -------- | ----------------------- |
| `copyright`   | `string` | 替换版权信息            |
| `artist`      | `string` | 替换作者信息            |
| `offsetTime`  | `string` | 时区偏移 (如 "+08:00")  |
| `jpegQuality` | `number` | HEIC 转 JPEG 的质量     |

**CleanupResult:**

| 属性            | 类型       | 说明               |
| --------------- | ---------- | ------------------ |
| `success`       | `boolean`  | 是否成功           |
| `file`          | `File`     | 清理后的文件       |
| `blob`          | `Blob`     | 清理后的 Blob      |
| `originalSize`  | `number`   | 原始大小           |
| `cleanedSize`   | `number`   | 清理后大小         |
| `removedFields` | `string[]` | 已移除的字段列表   |
| `addedFields`   | `string[]` | 已添加的字段列表   |
| `error`         | `string`   | 错误信息 (如果失败)|

---

### URL 转换器

```typescript
import {
  toRawUrl,
  toCdnUrl,
  toDisplayUrl,
  buildUrlChain,
  isGitHubPagesUrl,
  isGitHubRawUrl,
} from "@jixiaoyong/vue-github-assets";
```

#### toRawUrl

将 GitHub Pages URL 转换为 Raw URL。

```typescript
const rawUrl = toRawUrl(pagesUrl, branch?);
// 输入: https://jixiaoyong.github.io/images/photo.jpg
// 输出: https://raw.githubusercontent.com/jixiaoyong/images/main/photo.jpg
```

#### toCdnUrl

将 Raw URL 或 Pages URL 转换为 CDN 优化链接。

```typescript
const cdnUrl = toCdnUrl(url, options?);
```

**CdnOptions:**

| 属性       | 类型                       | 默认值   | 说明       |
| ---------- | -------------------------- | -------- | ---------- |
| `provider` | `'wsrv' \| 'statically'`   | `'wsrv'` | CDN 提供商 |
| `width`    | `number`                   | `0`      | 输出宽度   |
| `height`   | `number`                   | `0`      | 输出高度   |
| `quality`  | `number`                   | `75`     | 输出质量   |
| `format`   | `'webp' \| 'original'`     | `'webp'` | 输出格式   |
| `cacheBust`| `boolean`                  | `false`  | 添加时间戳 |

#### buildUrlChain

构建完整的 URL 链。

```typescript
const { displayUrl, rawUrl, cdnUrl } = buildUrlChain(path, config, cdnOptions?);
```

---

### 图片压缩器

```typescript
import { compressImage } from "@jixiaoyong/vue-github-assets";

const compressedFile = await compressImage(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  convertToWebP: true,
});
```
