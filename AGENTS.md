# 项目上下文: @jixiaoyong/vue-github-assets

## 0. 重要开发规范 (Critical Guidelines)

1. **语言要求 (Strict Language Rules)**:

   - **文档 (Documentation)**: `docs/`、`README.md` 等所有文档**必须使用中文**编写。
   - **方法注释 (Method Comments)**: 必须是**中英双语 (Bilingual)**。
     - 格式：中文描述在前，英文在后。
     - 示例：`/** 加载清单 / Load manifest */`
   - **普通注释 (Inline Comments)**: **中文优先** (Chinese First)。

2. **执行要求**:
   - 每次任务开始前请复查本文档。
   - 严格遵守上述语言规范。

## 1. 项目概述

这是一个私有的 Vue 3 插件，旨在使用 GitHub 仓库作为图片存储后端。
它采用了 **Headless (无头逻辑) + UI Kit** 的架构设计，既提供纯逻辑 Hooks，也提供开箱即用的 UI 组件。

**核心理念：**

- **隐私优先 (Privacy First)：** 所有图片必须在上传前在**本地**完成 EXIF/GPS 数据清洗。
- **高性能：** 使用 `wsrv.nl` 进行 CDN 加速和图片处理；使用 GitHub Raw 作为数据源。
- **零配置鉴权：** 插件本身**不处理** OAuth 登录流程。它只接受宿主应用 (Host App) 传入的一个已授权 Token。
- **Peer Dependencies：** 绝不打包 `vue` 或 `octokit`，避免依赖冲突。

开发的时候公开的方法，变量，类型等等应该提供中英文的介绍，普通的注释应该是中文优先，英文为辅。

## 2. 技术栈

- **框架：** Vue 3 (Composition API, `<script setup>`)
- **语言：** TypeScript
- **构建工具：** Vite (Library Mode 库模式)
- **构建输出：** ESM + CJS 双格式
- **API 客户端：** `@octokit/rest` (作为 Peer Dependency)
- **图片处理：** 使用 `piexifjs` 直接操作 EXIF 二进制数据 (**禁止使用 Canvas 重绘**，避免丢失图像质量)
- **CDN：** 主用 `wsrv.nl`，备用 `statically.io`
- **图标库：** Lucide Icons
- **发布目标：** GitHub Packages (私有)

## 3. 架构与目录结构

### 目录结构

```
src/
├── composables/           # 无头逻辑 Hooks
│   ├── useAssetStore.ts   # 核心入口
│   ├── useUploader.ts     # 上传逻辑
│   └── useFolderManager.ts
├── components/            # UI 组件
│   ├── AssetManager.vue   # 完整管理器
│   ├── AssetUploader.vue  # 拖拽上传区
│   ├── SmartImage.vue     # CDN 优化图片
│   ├── AssetGrid.vue      # 图片网格
│   └── FolderTree.vue     # 文件夹树
├── utils/
│   ├── exif-cleaner.ts    # 基于 piexifjs (从现有 JS 移植)
│   ├── image-compressor.ts
│   └── url-transformer.ts
├── styles/
│   └── variables.css      # CSS 变量 (主题)
└── types/
    └── index.ts
```

### 依赖策略

- `vue` 和 `@octokit/rest` 必须列在 `package.json` 的 `peerDependencies` 中。
- 必须确保构建时排除这些依赖，防止与宿主应用冲突。
- `piexifjs` 作为 devDependency，构建时 tree-shake。
- HEIC 支持动态加载 `libheif-js`（按需）。

## 4. 核心工作流 (严格逻辑)

### A. 鉴权 (Authentication)

- 宿主应用提供一个配置对象：`{ token: MaybeRefOrGetter<string>, owner, repo, branch }`。
- 插件使用 Vue 3.3+ 的 `toValue()` 处理响应式 Token。
- 如果 Token 为空，API 调用应暂停或抛出清晰错误，而不是发起无效请求。

### B. 图片上传 (Upload on Select)

1. **输入：** 用户选择文件 (`File` 对象)。
2. **预处理：**
   - 运行 `cleanExif(file)` 移除敏感元数据（可通过 `skipExifClean` 跳过）。
   - 可选压缩（默认不压缩）。
   - 转为 Base64 (移除 `data:image/...;base64,` 前缀)。
3. **上传：**
   - 使用 `octokit.repos.createOrUpdateFileContents`。
   - 路径格式：`{basePath}/{filename}` (保持原文件名，允许覆盖)。
   - Commit Message: "Upload via Asset Plugin"。
4. **输出：** 返回 **GitHub Pages URL** (`https://jixiaoyong.github.io/images/xxx.jpg`)。
   - **对外：** 返回 Pages URL（语义化好，适合写入 Markdown）。
   - **内部加载：** SmartImage 自动转换为 Raw → CDN 链接，实现"秒传秒看"。

### C. 图片展示 (CDN 集成)

- **数据源：** 调用 GitHub API 获取列表 (`octokit.repos.getContent`)。
- **URL 转换链：**
  ```
  GitHub Pages URL → Raw URL → CDN URL
  jixiaoyong.github.io/images/a.jpg
      ↓
  raw.githubusercontent.com/jixiaoyong/images/main/a.jpg
      ↓
  wsrv.nl/?url={rawUrl}&output=webp&q=75
  ```
- **CDN 降级：** 主用 wsrv.nl，失败时降级到 statically.io，如果都失败就返回原始的链接。

### D. SmartImage 缓存策略

#### 缓存模式

| 模式        | 实现                               | 适用场景                 |
| ----------- | ---------------------------------- | ------------------------ |
| **默认**    | 依赖 CDN 响应的 `Cache-Control` 头 | 大多数静态图片           |
| **mutable** | 每次请求加 `?t=时间戳` 穿透缓存    | 频繁变化的图片（如头像） |

```vue
<SmartImage src="..." />
<!-- 默认，走 CDN 缓存 -->
<SmartImage src="..." mutable />
<!-- 跳过缓存 -->
```

#### 版本更新检测

当用户上传新图片覆盖旧文件（文件名不变）时：

- 提供 `forceRefresh()` 方法清理缓存
- 该方法会给 SmartImage 内部 URL 加时间戳，强制重新加载

```typescript
const { forceRefresh } = useAssetStore(config);
// 用户确认覆盖后调用
await forceRefresh("path/to/image.jpg");
```

#### 宿主应用职责

缓存配置（`_headers`、PWA）由宿主应用负责，详见 `docs/HOST_SETUP.md`。

### E. 文件夹管理

- 支持创建子目录分类图片
- 支持路径导航

### F. Manifest 索引机制

为加速文件列表加载，在 images 仓库根目录维护一个索引文件。

#### 文件结构

```
images/
├── .vga-manifest.json   ← 索引文件 (vga = Vue GitHub Assets)
├── blog/
│   └── photo1.jpg
└── avatars/
    └── user.png
```

#### Manifest 格式

```typescript
interface VgaManifest {
  version: string; // "1.0.0" - 格式版本，支持未来迁移
  lastUpdated: string; // ISO 时间戳
  lastSyncedSha: string; // 上次校验时的根目录 SHA（用于增量对比）

  files: {
    name: string;
    path: string;
    size: number;
    sha: string; // 文件 SHA，用于检测变化
    mimeType?: string;
    uploadedAt?: string;
    tags?: string[]; // 预留：未来可支持标签
  }[];

  folders: string[]; // 所有文件夹路径
}
```

#### 加载策略 (Stale-While-Revalidate)

```
1. UI 加载 → 立即显示 manifest 缓存 (极速)
2. 后台校验 → 调用 GitHub API 获取真实数据
3. 对比差异 → 如有变化，更新 manifest 并刷新 UI
```

#### 校验时机

| 时机         | 行为                                |
| ------------ | ----------------------------------- |
| **首次加载** | 显示 manifest → 后台校验 → 同步差异 |
| **操作失败** | 检测到 404/409 等错误时触发完整校验 |
| **手动刷新** | 用户点击刷新按钮时                  |

#### 增量校验优化

```typescript
// 只比较根目录 SHA，有变化才递归
const rootContent = await octokit.repos.getContent({ path: "" });
const currentSha = computeTreeHash(rootContent);

if (currentSha === manifest.lastSyncedSha) {
  // 无变化，跳过完整校验
  return;
}
// 有变化，执行完整校验
await fullSync();
```

#### 并发冲突处理

使用 GitHub API 的 SHA 条件更新，避免覆盖其他用户的修改：

```typescript
await octokit.repos.createOrUpdateFileContents({
  path: ".vga-manifest.json",
  sha: manifest.sha, // 如果被其他人改过会返回 409
  content: newContent,
});
// 409 时：重新获取最新 manifest → 合并 → 重试
```

## 5. UI 设计规范 (iOS 风格)

### 核心原则

- **圆角：** 12-14px (主要容器)、8px (按钮/输入框)
- **间距：** 8px 网格系统
- **动画：** Spring 弹性曲线 `cubic-bezier(0.175, 0.885, 0.32, 1.275)`
- **主题：** 支持 `prefers-color-scheme` 自动切换亮色/暗色
- **字体：** -apple-system, SF Pro Text (系统字体优先)

### 禁止项

- ❌ **不使用毛玻璃效果** (backdrop-filter: blur)

### 内置功能

- 拖拽上传区域
- 多格式复制（GitHub Pages URL / Markdown / HTML）

## 6. 编码规范

### Vue 组件

- 使用 `<script setup lang="ts">`。
- 使用 scoped CSS。
- Props 接收 `config` 对象，使用 `MaybeRefOrGetter<string>` 支持响应式 Token。
- 尽可能将逻辑抽离到 `composables` 中。

### TypeScript

- 使用严格类型 (Strict Typing)。避免使用 `any`。
- 为所有 API 响应和 Props 定义 interface。
- Token 类型使用 `MaybeRefOrGetter<string>`，配合 `toValue()` 处理。

### 错误处理

- 处理 `401 Unauthorized`：抛出特定错误代码，以便宿主应用引导用户重新登录。
- 处理 `409 Conflict`：如果文件名冲突，根据策略决定覆盖或重命名。
- 增加 `error: Ref<Error | null>` 状态，便于 UI 展示错误信息。

## 7. 集成示例 (宿主应用侧)

```typescript
import {
  useAssetStore,
  AssetManager,
  SmartImage,
} from "@jixiaoyong/vue-github-assets";

// 配置支持响应式 Token
const config = reactive({
  token: computed(() => userStore.token),
  owner: "jixiaoyong",
  repo: "images",
  basePath: "blog/",
});

const { upload, forceRefresh } = useAssetStore(config);

// 上传
const result = await upload(file);
console.log(result.url); // https://jixiaoyong.github.io/images/blog/xxx.jpg

// 强制刷新某个图片缓存
await forceRefresh("blog/xxx.jpg");
```

```vue
<!-- 使用 SmartImage 自动 CDN 优化 -->
<SmartImage src="https://jixiaoyong.github.io/images/photo.jpg" :width="800" />

<!-- 频繁变化的图片，跳过缓存 -->
<SmartImage src="..." mutable />
```
