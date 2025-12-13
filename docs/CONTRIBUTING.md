# Vue GitHub Assets Plugin - 开发规范

> 本文档定义了项目的开发规范和 UI 设计指南，请在每次开发前阅读。

## 一、代码规范

### 1.1 TypeScript 规范

```typescript
// ✅ 使用 Vue 3.3+ 的 MaybeRefOrGetter 类型
import { type MaybeRefOrGetter, toValue } from "vue";

interface Config {
  token: MaybeRefOrGetter<string>; // 支持 Ref、getter、原始值
}

// 使用时
const tokenValue = toValue(config.token);

// ✅ 明确的返回类型
async function upload(file: File): Promise<UploadResult> {}

// ✅ 使用接口定义复杂类型
interface UploadResult {
  success: boolean;
  url?: string;
  error?: Error;
}

// ❌ 避免 any
const data: any = response; // Bad
const data: unknown = response; // Good, then type-guard
```

### 1.2 Vue 组件规范

```vue
<script setup lang="ts">
// 1. 导入
import { ref, computed, onMounted } from "vue";
import type { PropType } from "vue";

// 2. Props 定义 (使用 TypeScript 泛型)
const props = defineProps<{
  config: StoreConfig;
  showFolders?: boolean;
}>();

// 3. Emits 定义
const emit = defineEmits<{
  select: [url: string];
  upload: [result: UploadResult];
}>();

// 4. Composables
const { loading, fileList } = useAssetStore(props.config);

// 5. 本地状态
const localState = ref(false);

// 6. Computed
const isEmpty = computed(() => fileList.value.length === 0);

// 7. Methods
function handleClick() {}

// 8. Lifecycle
onMounted(() => {});
</script>
```

### 1.3 命名规范

| 类型        | 规范                  | 示例               |
| ----------- | --------------------- | ------------------ |
| 组件文件    | PascalCase            | `AssetManager.vue` |
| Composables | camelCase + use 前缀  | `useAssetStore.ts` |
| 工具函数    | camelCase             | `cleanExif.ts`     |
| CSS 变量    | kebab-case + vga 前缀 | `--vga-bg-primary` |
| 常量        | UPPER_SNAKE_CASE      | `MAX_FILE_SIZE`    |

---

## 二、UI 设计规范 (iOS 风格)

### 2.1 设计原则

1. **清晰 (Clarity)** - 文字清晰可读，图标精确表意
2. **遵从 (Deference)** - 内容优先，UI 辅助
3. **深度 (Depth)** - 通过层次和动效传达空间感

### 2.2 间距系统 (8px Grid)

```css
/* 基础单位: 8px */
--vga-space-1: 4px; /* 0.5x */
--vga-space-2: 8px; /* 1x - 基础 */
--vga-space-3: 12px; /* 1.5x */
--vga-space-4: 16px; /* 2x */
--vga-space-5: 24px; /* 3x */
--vga-space-6: 32px; /* 4x */
--vga-space-7: 48px; /* 6x */
--vga-space-8: 64px; /* 8x */
```

**使用场景:**

- 组件内间距: `8px` ~ `16px`
- 组件间间距: `16px` ~ `24px`
- 区块间间距: `24px` ~ `32px`

### 2.3 圆角 (Border Radius)

```css
--vga-radius-xs: 4px; /* 小按钮、标签 */
--vga-radius-sm: 8px; /* 输入框、小卡片 */
--vga-radius-md: 12px; /* 卡片、对话框 */
--vga-radius-lg: 14px; /* 大卡片、面板 */
--vga-radius-xl: 20px; /* 模态框 */
--vga-radius-full: 9999px; /* 胶囊按钮 */
```

**规则:**

- 主要容器: `12px` ~ `14px`
- 按钮: `8px` (常规) 或 `9999px` (胶囊)
- 输入框: `8px`
- ❌ **禁止使用毛玻璃效果 (backdrop-filter: blur)**

### 2.4 颜色系统

```css
/* Light Theme */
:root {
  /* 背景色 */
  --vga-bg-primary: #ffffff;
  --vga-bg-secondary: #f2f2f7;
  --vga-bg-tertiary: #e5e5ea;
  --vga-bg-grouped: #f2f2f7;

  /* 文字色 */
  --vga-text-primary: #000000;
  --vga-text-secondary: rgba(60, 60, 67, 0.6);
  --vga-text-tertiary: rgba(60, 60, 67, 0.3);
  --vga-text-placeholder: rgba(60, 60, 67, 0.3);

  /* 功能色 */
  --vga-accent: #007aff; /* iOS Blue */
  --vga-accent-hover: #0056cc;
  --vga-destructive: #ff3b30; /* iOS Red */
  --vga-success: #34c759; /* iOS Green */
  --vga-warning: #ff9500; /* iOS Orange */

  /* 边框和分隔线 */
  --vga-border: rgba(60, 60, 67, 0.12);
  --vga-separator: rgba(60, 60, 67, 0.36);

  /* 阴影 */
  --vga-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --vga-shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --vga-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Dark Theme */
@media (prefers-color-scheme: dark) {
  :root {
    --vga-bg-primary: #000000;
    --vga-bg-secondary: #1c1c1e;
    --vga-bg-tertiary: #2c2c2e;
    --vga-bg-grouped: #1c1c1e;

    --vga-text-primary: #ffffff;
    --vga-text-secondary: rgba(235, 235, 245, 0.6);
    --vga-text-tertiary: rgba(235, 235, 245, 0.3);

    --vga-accent: #0a84ff;
    --vga-destructive: #ff453a;
    --vga-success: #30d158;
    --vga-warning: #ff9f0a;

    --vga-border: rgba(84, 84, 88, 0.65);
    --vga-separator: rgba(84, 84, 88, 0.65);

    --vga-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --vga-shadow-md: 0 2px 8px rgba(0, 0, 0, 0.4);
    --vga-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
}
```

### 2.5 动画规范 (Spring Animation)

```css
/* iOS 风格的弹性动画曲线 */
--vga-ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
--vga-ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--vga-ease-out: cubic-bezier(0, 0, 0.2, 1);

/* 持续时间 */
--vga-duration-fast: 150ms;
--vga-duration-normal: 250ms;
--vga-duration-slow: 350ms;
```

**动画使用场景:**

```css
/* 按钮点击 - 缩放反馈 */
.btn:active {
  transform: scale(0.97);
  transition: transform var(--vga-duration-fast) var(--vga-ease-spring);
}

/* 卡片悬停 */
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--vga-shadow-lg);
  transition: all var(--vga-duration-normal) var(--vga-ease-smooth);
}

/* 列表项进入 */
.list-item {
  animation: slideIn var(--vga-duration-normal) var(--vga-ease-spring);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 2.6 字体规范

```css
/* 系统字体栈 (iOS 优先) */
--vga-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
  "Helvetica Neue", Helvetica, Arial, sans-serif;

/* 字体大小 */
--vga-text-xs: 11px; /* Caption 2 */
--vga-text-sm: 13px; /* Footnote */
--vga-text-base: 15px; /* Subheadline */
--vga-text-md: 17px; /* Body (Default) */
--vga-text-lg: 20px; /* Title 3 */
--vga-text-xl: 22px; /* Title 2 */
--vga-text-2xl: 28px; /* Title 1 */
--vga-text-3xl: 34px; /* Large Title */

/* 字重 */
--vga-font-regular: 400;
--vga-font-medium: 500;
--vga-font-semibold: 600;
--vga-font-bold: 700;

/* 行高 */
--vga-leading-tight: 1.2;
--vga-leading-normal: 1.5;
--vga-leading-relaxed: 1.75;
```

### 2.7 响应式断点

```css
/* Mobile First */
--vga-screen-sm: 640px; /* 手机横屏 */
--vga-screen-md: 768px; /* 平板竖屏 */
--vga-screen-lg: 1024px; /* 平板横屏 / 小桌面 */
--vga-screen-xl: 1280px; /* 桌面 */
--vga-screen-2xl: 1536px; /* 大桌面 */

/* 图片网格列数 */
@media (max-width: 639px) {
  .asset-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 640px) and (max-width: 1023px) {
  .asset-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1024px) {
  .asset-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 三、组件设计模式

### 3.1 按钮样式

```css
.vga-btn {
  padding: 10px 20px;
  border-radius: var(--vga-radius-sm);
  font-size: var(--vga-text-base);
  font-weight: var(--vga-font-semibold);
  transition: all var(--vga-duration-fast) var(--vga-ease-smooth);
  cursor: pointer;
}

.vga-btn:active {
  transform: scale(0.97);
}

.vga-btn-primary {
  background: var(--vga-accent);
  color: white;
}

.vga-btn-secondary {
  background: var(--vga-bg-secondary);
  color: var(--vga-text-primary);
}

.vga-btn-destructive {
  background: var(--vga-destructive);
  color: white;
}

.vga-btn-ghost {
  background: transparent;
  color: var(--vga-accent);
}
```

### 3.2 卡片样式

```css
.vga-card {
  background: var(--vga-bg-primary);
  border-radius: var(--vga-radius-md);
  box-shadow: var(--vga-shadow-sm);
  border: 1px solid var(--vga-border);
  overflow: hidden;
  transition: all var(--vga-duration-normal) var(--vga-ease-smooth);
}

.vga-card:hover {
  box-shadow: var(--vga-shadow-md);
  transform: translateY(-1px);
}
```

### 3.3 输入框样式

```css
.vga-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--vga-bg-secondary);
  border: 1px solid transparent;
  border-radius: var(--vga-radius-sm);
  font-size: var(--vga-text-md);
  color: var(--vga-text-primary);
  transition: all var(--vga-duration-fast);
}

.vga-input:focus {
  outline: none;
  border-color: var(--vga-accent);
  background: var(--vga-bg-primary);
}

.vga-input::placeholder {
  color: var(--vga-text-placeholder);
}
```

---

## 四、图标规范

使用 SF Symbols 风格的图标，推荐以下图标库:

- **Lucide Icons** (推荐): 风格接近 SF Symbols
- **Heroicons**: 适合简洁风格
- **Phosphor Icons**: 多种变体可选

```vue
<!-- 推荐用法 -->
<template>
  <LucideUpload class="vga-icon" />
</template>

<style>
.vga-icon {
  width: 20px;
  height: 20px;
  stroke-width: 1.5;
}
</style>
```

---

## 五、Git 提交规范

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式 (不影响功能)
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

**示例:**

```
feat(upload): add batch upload support

- Add uploadMultiple method to useAssetStore
- Support parallel upload with Promise.allSettled
- Add progress tracking for each file

Closes #12
```

---

## 六、测试规范

### 6.1 单元测试

```typescript
// useAssetStore.test.ts
import { describe, it, expect, vi } from "vitest";
import { useAssetStore } from "./useAssetStore";

describe("useAssetStore", () => {
  it("should upload file and return GitHub Pages URL", async () => {
    const { upload } = useAssetStore({
      token: "test-token",
      owner: "jixiaoyong",
      repo: "images",
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const result = await upload(file);

    expect(result.success).toBe(true);
    expect(result.url).toContain("jixiaoyong.github.io");
  });
});
```

### 6.2 组件测试

```typescript
// AssetManager.test.ts
import { mount } from "@vue/test-utils";
import AssetManager from "./AssetManager.vue";

describe("AssetManager", () => {
  it("should emit select event when clicking use button", async () => {
    const wrapper = mount(AssetManager, {
      props: {
        config: {
          /* ... */
        },
      },
    });

    await wrapper.find(".use-btn").trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
  });
});
```

---

## 七、性能优化清单

- [ ] 图片使用 `loading="lazy"`
- [ ] 列表使用虚拟滚动 (当 > 100 项时)
- [ ] 组件按需导入
- [ ] CSS 变量避免重复计算
- [ ] 避免不必要的 watcher
- [ ] 使用 `shallowRef` 优化大型数组

---

## 八、版本发布清单

- [ ] 更新 `CHANGELOG.md`
- [ ] 更新版本号 (`npm version`)
- [ ] 运行完整测试
- [ ] 构建产物检查
- [ ] 生成类型声明
- [ ] 发布到 GitHub Packages
