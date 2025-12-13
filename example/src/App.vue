<script setup lang="ts">
import { AssetManager, type AssetItem, type AssetOperationResult, type CopyFormat, type StoreConfig } from '@jixiaoyong/vue-github-assets';
import { computed, ref } from 'vue';
import CleanerDemo from './components/CleanerDemo.vue';

// 配置 / Configuration
// 实际使用时建议将 Token 放在环境变量中
// For production, it's recommended to put Token in environment variables
const config = ref<StoreConfig>({
  token: import.meta.env.VITE_GITHUB_TOKEN || '',
  owner: import.meta.env.VITE_GITHUB_OWNER || '',
  repo: import.meta.env.VITE_GITHUB_REPO || '',
  branch: import.meta.env.VITE_GITHUB_BRANCH || '',
  basePath: import.meta.env.VITE_GITHUB_BASE_PATH || '',
});

const showConfig = ref(false);
const activeTab = ref<'manager' | 'cleaner'>('manager');

// State to verify connectivity
const isConfigured = computed(() => {
  return config.value.token && config.value.owner && config.value.repo;
});

// ============================================
// Toast State / Toast 状态
// ============================================
const toastMessage = ref<string | null>(null);
const toastType = ref<'success' | 'info' | 'error'>('info');

function showToast(message: string, type: 'success' | 'info' | 'error' = 'info') {
  toastMessage.value = message;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = null;
  }, 3000);
}

// ============================================
// Event Handlers / 事件处理
// ============================================

function handleConfirm(urls: string[], items: AssetItem[]) {
  const names = items.map(i => i.name).join(', ');
  showToast(`✅ 已确认选择 / Confirmed: ${names}`, 'success');
  console.log('[confirm]', { urls, items });
}

function handleUpload(results: AssetOperationResult[]) {
  const count = results.length;
  const names = results.map(r => r.item.name || r.url.split('/').pop()).join(', ');
  showToast(`📤 上传成功 / Uploaded ${count} file(s): ${names}`, 'success');
  console.log('[upload]', results);
}

function handleDelete(results: AssetOperationResult[]) {
  const names = results.map(r => r.item.name).join(', ');
  showToast(`🗑️ 已删除 / Deleted: ${names}`, 'info');
  console.log('[delete]', results);
}

function handleCopy(content: string, format: CopyFormat, item: AssetItem) {
  const formatLabel = format === 'url' ? 'URL' : format === 'markdown' ? 'Markdown' : 'HTML';
  showToast(`📋 已复制 ${formatLabel} / Copied ${formatLabel}`, 'success');
  console.log('[copy]', { content, format, item });
}

function handleError(error: Error) {
  showToast(`❌ 错误 / Error: ${error.message}`, 'error');
  console.error('[error]', error);
}
</script>

<template>
  <div class="demo-container">
    <header class="demo-header">
      <h1>Vue GitHub Assets Demo</h1>
      <div class="header-actions">
        <button class="vga-btn" :class="{ 'vga-btn-active': activeTab === 'manager' }" @click="activeTab = 'manager'">
          Asset Manager
        </button>
        <button class="vga-btn" :class="{ 'vga-btn-active': activeTab === 'cleaner' }" @click="activeTab = 'cleaner'">
          Privacy Cleaner
        </button>
        <button class="vga-btn vga-btn-secondary" @click="showConfig = !showConfig" v-if="activeTab === 'manager'">
          {{ showConfig ? 'Hide Config' : 'Setup Config' }}
        </button>
      </div>
    </header>

    <!-- Privacy Cleaner Demo -->
    <div v-if="activeTab === 'cleaner'" class="cleaner-wrapper">
      <CleanerDemo />
    </div>

    <!-- Asset Manager Demo -->
    <template v-else>
      <!-- Configuration Form -->
      <div v-if="showConfig || !isConfigured" class="config-panel">
        <h3>Configuration</h3>
        <div class="hint">
          Provide your GitHub details to test the asset manager.
          Best practice: create a `.env.local` file in `example/` with:
          <pre>
  VITE_GITHUB_TOKEN=your_token
  VITE_GITHUB_OWNER=your_username
  VITE_GITHUB_REPO=your_repo
          </pre>
        </div>

        <div class="form-group">
          <label>Token:</label>
          <input v-model="config.token" type="password" placeholder="ghp_..." class="vga-input" />
        </div>
        <div class="form-group">
          <label>Owner:</label>
          <input v-model="config.owner" type="text" placeholder="Username" class="vga-input" />
        </div>
        <div class="form-group">
          <label>Repo:</label>
          <input v-model="config.repo" type="text" placeholder="Repository" class="vga-input" />
        </div>
        <div class="form-group">
          <label>Branch:</label>
          <input v-model="config.branch" type="text" placeholder="main" class="vga-input" />
        </div>
        <div class="form-group">
          <label>Base Path:</label>
          <input v-model="config.basePath" type="text" placeholder="assets" class="vga-input" />
        </div>
      </div>

      <!-- Asset Manager Instance -->
      <div v-if="isConfigured" class="manager-wrapper">
        <AssetManager :config="config" :show-folders="true" :show-uploader="true" @confirm="handleConfirm"
          @upload="handleUpload" @delete="handleDelete" @copy="handleCopy" @error="handleError" />
      </div>

      <div v-else class="empty-state">
        <p>Please configure the plugin to continue.</p>
      </div>
    </template>

    <!-- Toast Notification -->
    <Transition name="toast">
      <div v-if="toastMessage" class="demo-toast" :class="`demo-toast--${toastType}`">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style>
/* Reset & Base Styles */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f5f7fa;
  color: #333;
}

.demo-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .demo-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 4px;
    /* Space for potential scrollbar */
  }

  .vga-btn {
    white-space: nowrap;
    font-size: 0.85rem;
    padding: 6px 12px;
  }
}

/* Config Panel */
.config-panel {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.config-panel h3 {
  margin-top: 0;
}

.hint {
  font-size: 0.9rem;
  color: #666;
  background: #f0f4f8;
  padding: 10px;
  border-radius: 4px;
}

.form-group {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.form-group label {
  width: 100px;
  font-weight: 500;
}

.vga-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  max-width: 400px;
}

/* Manager Wrapper */
.manager-wrapper {
  flex: 1;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 20px;
  min-height: 0;
  /* For scrolling */
  overflow: hidden;
}

.cleaner-wrapper {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 50px;
  color: #888;
}

/* Simple Button Styles suitable for demo */
.vga-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  background: transparent;
}

.vga-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.vga-btn-active {
  background: #e1e4e8;
  font-weight: 600;
}

.vga-btn-secondary {
  background: #fff;
  border-color: #ddd;
  color: #333;
}

.vga-btn-secondary:hover {
  background: #f5f5f5;
}

/* Toast Styles */
.demo-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  max-width: 90vw;
  text-align: center;
}

.demo-toast--success {
  background: #34c759;
  color: white;
}

.demo-toast--info {
  background: #007aff;
  color: white;
}

.demo-toast--error {
  background: #ff3b30;
  color: white;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  transform: translateX(-50%) translateY(20px);
  opacity: 0;
}
</style>
