# Vue GitHub Assets

A Vue 3 plugin for managing image assets in GitHub repositories with privacy protection, CDN optimization, and iOS-style UI.

**[English](README.en.md)** | **[中文](README.md)**

---

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Components](#components)
- [Utilities](#utilities)
- [Theme Customization](#theme-customization)
- [Images Repository Setup](#images-repository-setup)
- [Documentation](#documentation)

---

## Features

- **Privacy Protection** - Local EXIF cleanup (GPS, device info, etc.) before upload, no privacy data uploaded
- **Zero Conflicts** - Uses peerDependencies to avoid Vue/Octokit multi-instance issues
- **iOS-style UI** - Modern design with light/dark theme support, mobile-optimized
- **Fast Loading** - Manifest indexing with Stale-While-Revalidate caching strategy
- **CDN Acceleration** - wsrv.nl primary + statically.io fallback with auto-degradation
- **Folder Management** - Create subdirectories for organized assets
- **Drag & Drop Upload** - Built-in drop zone with batch upload support
- **Multi-format Copy** - URL / Markdown / HTML format options
- **Standalone Tools** - Export `cleanupExifFromFile` for independent use

## Installation

### 1. Install Dependencies

```bash
# Ensure peer dependencies are installed
npm install vue@^3.3.0 @octokit/rest@^19.0.0

# Install from GitHub repository
npm install github:jixiaoyong/vue-github-assets

# Or specify a version (recommended)
npm install github:jixiaoyong/vue-github-assets#v0.1.1
```

### 2. Troubleshooting

The build script runs automatically during installation. If you encounter issues:

1. **Requirements**: Make sure Git and Node.js 20.19+ are installed
2. **Network**: Ensure you can access GitHub

## Quick Start

### Basic Usage

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
  console.log("Upload success:", result.url);
  // https://jixiaoyong.github.io/images/blog/xxx.jpg
}
</script>

<template>
  <AssetManager :config="config" @select="(url) => console.log('Selected:', url)" />
</template>
```

### SmartImage CDN Optimization

```vue
<script setup>
import { SmartImage } from "@jixiaoyong/vue-github-assets";
</script>

<template>
  <!-- Auto-converts to CDN URL with WebP output -->
  <SmartImage
    src="https://jixiaoyong.github.io/images/photo.jpg"
    :width="800"
    lazy
  />

  <!-- Skip cache for frequently changing images -->
  <SmartImage src="..." mutable />
</template>
```

### Standalone Privacy Cleanup Tool

`cleanupExifFromFile` can clean image privacy info locally without uploading.

```typescript
import { cleanupExifFromFile } from "@jixiaoyong/vue-github-assets";

async function clean(file: File) {
  // 1. Clean EXIF
  const { file: cleanedFile, removedTags } = await cleanupExifFromFile(file);

  console.log("Removed tags:", removedTags);
  // ["GPS", "Exif.Image.Make", "Exif.Image.Model", ...]

  // 2. Use cleaned file for other purposes (e.g., upload to S3, preview)
  const url = URL.createObjectURL(cleanedFile);
}
```

## API Reference

### useAssetStore(config, options?)

Core composable for asset management.

#### Config (`StoreConfig`)

| Property       | Type                       | Required | Description                     |
| -------------- | -------------------------- | -------- | ------------------------------- |
| `token`        | `MaybeRefOrGetter<string>` | Yes      | GitHub Token (supports reactive) |
| `owner`        | `string`                   | Yes      | GitHub username                  |
| `repo`         | `string`                   | Yes      | Repository name                  |
| `branch`       | `string`                   | No       | Branch name (default: `main`)    |
| `basePath`     | `string`                   | No       | Base path in repository          |
| `generatePath` | `(file: File) => string`   | No       | Custom file path generator       |

#### Options (`UseAssetStoreOptions`)

| Property              | Type                                 | Description                        |
| --------------------- | ------------------------------------ | ---------------------------------- |
| `onExifCleanupFailed` | `(failedItems) => Promise<Action[]>` | Callback when EXIF cleanup fails   |

#### Return Value

| Property/Method         | Type                      | Description              |
| ----------------------- | ------------------------- | ------------------------ |
| `loading`               | `Ref<boolean>`            | Loading state            |
| `error`                 | `Ref<Error \| null>`      | Error object             |
| `fileList`              | `Ref<AssetItem[]>`        | File list                |
| `folders`               | `Ref<FolderItem[]>`       | Folder list              |
| `currentPath`           | `Ref<string>`             | Current directory path   |
| `upload(file, opts?)`   | `Promise<UploadResult>`   | Upload single file       |
| `uploadMultiple(files)` | `Promise<UploadResult[]>` | Batch upload             |
| `remove(item)`          | `Promise<void>`           | Delete file              |
| `removeMultiple(items)` | `Promise<void>`           | Batch delete             |
| `createFolder(name)`    | `Promise<void>`           | Create folder            |
| `forceRefresh(path)`    | `Promise<void>`           | Force refresh cache      |
| `getDisplayUrl(item)`   | `string`                  | Get GitHub Pages URL     |
| `getOptimizedUrl(item)` | `string`                  | Get CDN optimized URL    |

## Components

### AssetManager

Complete asset management UI with folder tree, upload zone, and image grid.

```vue
<AssetManager
  :config="config"
  :show-folders="true"
  :copy-formats="['url', 'markdown', 'html']"
  @select="handleSelect"
/>
```

### SmartImage

CDN-optimized image component with automatic URL transformation.

```vue
<SmartImage
  src="https://jixiaoyong.github.io/images/photo.jpg"
  :width="800"
  :quality="75"
  lazy
  mutable  <!-- Skip cache -->
/>
```

**URL Transformation:**
```
Input:  https://jixiaoyong.github.io/images/photos/cat.jpg
  -> Raw URL: https://raw.githubusercontent.com/jixiaoyong/images/main/photos/cat.jpg
  -> CDN URL: https://wsrv.nl/?url={rawUrl}&output=webp&q=75&w=800
```

### AssetUploader

Drag-and-drop upload component with built-in EXIF cleanup.

```vue
<AssetUploader :config="config" @upload="handleUpload" />
```

### FolderTree

Recursive folder tree component.

```vue
<FolderTree
  :folders="['a/b', 'a/c']"
  :current-path="currentPath"
  @select="selectPath"
/>
```

## Utilities

### EXIF Cleaner

Privacy cleaning for JPEG and HEIC/HEIF images.

```typescript
import {
  cleanupExifFromFile,  // Clean single file
  cleanupExifFromBlob,  // Clean blob
  cleanupExifBatch,     // Batch cleanup
  isJpegFormat,         // Format detection
  isHeicFormat,
  isSupportedFormat,
  PRIVACY_TAGS,         // Privacy tag list
  USEFUL_TAGS,          // Preserved tag list
} from "@jixiaoyong/vue-github-assets";
```

### URL Transformer

Utilities for converting between GitHub Pages, Raw, and CDN URLs.

```typescript
import {
  toRawUrl,           // Pages URL -> Raw URL
  toCdnUrl,           // Raw/Pages URL -> CDN URL
  toDisplayUrl,       // Any URL -> Pages URL
  buildUrlChain,      // Build complete URL chain
  isGitHubPagesUrl,   // URL detection
  isGitHubRawUrl,
} from "@jixiaoyong/vue-github-assets";
```

### Image Compressor

Optional image compression before upload.

```typescript
import { compressImage } from "@jixiaoyong/vue-github-assets";

const compressed = await compressImage(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  convertToWebP: true,
});
```

## Theme Customization

```css
:root {
  --vga-accent: #your-brand-color;
  --vga-radius-md: 16px;
}
```

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for complete CSS variable reference.

## Images Repository Setup

### GitHub Action Auto-sync

Add the following configuration to your images repository. It auto-updates `.vga-manifest.json` on file changes:

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

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the manifest generation script.

## Documentation

- [Architecture Design](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Host Application Setup](docs/HOST_SETUP.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run example app
npm run example

# Build for production
npm run build

# Run tests
npm test
```

## License

MIT (c) [jixiaoyong](https://github.com/jixiaoyong)
