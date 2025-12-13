# Changelog / 更新日志

## [0.2.0] - 2025-12-13

### ⚠️ Breaking Changes / 破坏性变更

- `select` event renamed to `confirm` / `select` 事件重命名为 `confirm`
- `confirm` now returns `(urls: string[], items: AssetItem[])` instead of `(url, item)` / `confirm` 现在返回数组格式，支持多选
- `upload` event returns `{ url, item }[]` instead of `UploadResult[]` / `upload` 事件返回格式变更
- `delete` event returns `{ url, item }[]` instead of `AssetItem` / `delete` 事件返回格式变更

### Added / 新增

- New `copy` event for tracking copy actions / 新增 `copy` 事件用于追踪复制操作
- Export `AssetOperationResult` and `CopyFormat` types / 导出 `AssetOperationResult` 和 `CopyFormat` 类型
- Example app now shows Toast for all events / Example 应用现在展示所有事件的 Toast 提示

---

## [0.1.1] - 2025-12-13

### Security / 安全

- Upgrade vite to 7.2.7 (fix esbuild CORS vulnerability) / 升级 vite 修复 esbuild 安全漏洞
- Upgrade @vitejs/plugin-vue to 6.0.3 / 升级 Vue 插件

### Changed / 变更

- Require Node.js 20.19+ / 要求 Node.js 20.19+
- Add .nvmrc file / 添加 .nvmrc 版本锁定文件

---

## [0.1.0] - 2025-12-13

### Added / 新增

- Core asset management composables / 核心资源管理 Composables
- UI components: AssetManager, SmartImage, AssetUploader, FolderTree / UI 组件
- EXIF privacy cleaner (JPEG, HEIC) / EXIF 隐私清理工具
- CDN optimization (wsrv.nl + statically.io) / CDN 加速
- Manifest indexing with SWR caching / Manifest 索引缓存
- iOS-style UI with light/dark theme / iOS 风格界面
- TypeScript support / TypeScript 支持
- Chinese & English documentation / 中英文文档
