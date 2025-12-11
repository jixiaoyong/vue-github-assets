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
| `basePath`     | `string`                   | (可选) 仓库内的文件夹路径      |
| `generatePath` | `(file: File) => string`   | (可选) 自定义文件路径生成函数  |

### 选项 (`UseAssetStoreOptions`)

| 属性                  | 类型                                 | 说明                      |
| --------------------- | ------------------------------------ | ------------------------- |
| `onExifCleanupFailed` | `(failedItems) => Promise<Action[]>` | EXIF 清理失败时的回调函数 |

### 返回值

- `fileList`: 当前路径下的资源列表
- `folders`: 子文件夹列表
- `currentPath`: 当前目录路径
- `loading`: 加载状态
- `error`: 错误对象或 null
- `upload(file, options?)`: 上传单个文件
- `uploadMultiple(files, options?)`: 批量上传文件
- `remove(item)`: 删除资源
- `createFolder(name)`: 创建新文件夹 (通过 .gitkeep)
- `forceRefresh(path)`: 强制刷新某个项目的缓存
- `getOptimizedUrl(item, options)`: 获取项目的 CDN 优化链接

## 组件

### AssetManager

完整的资源管理界面组件。

```vue
<AssetManager :config="config" :show-folders="true" :show-uploader="true" />
```

### SmartImage

CDN 优化的图片组件，包含缓存管理和加载状态。

```vue
<SmartImage
  src="https://jixiaoyong.github.io/images/foo.jpg"
  :width="800"
  :quality="80"
  lazy
/>
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

### ExifWarningDialog

EXIF 清理失败时的处理弹窗。通常集成在 AssetManager 内部使用。

## 工具函数

### exif-cleaner

```typescript
import { cleanupExifFromFile } from "@jixiaoyong/vue-github-assets";

const result = await cleanupExifFromFile(file);
```
