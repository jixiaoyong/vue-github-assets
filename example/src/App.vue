<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { AssetManager, type StoreConfig } from '@jixiaoyong/vue-github-assets';

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

  // State to verify connectivity
  const isConfigured = computed(() => {
    return config.value.token && config.value.owner && config.value.repo;
  });
</script>

<template>
  <div class="demo-container">
    <header class="demo-header">
      <h1>Vue GitHub Assets Demo</h1>
      <button class="vga-btn vga-btn-secondary" @click="showConfig = !showConfig">
        {{ showConfig ? 'Hide Config' : 'Setup Config' }}
      </button>
    </header>

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
      <AssetManager :config="config" :show-folders="true" :show-uploader="true" />
    </div>

    <div v-else class="empty-state">
      <p>Please configure the plugin to continue.</p>
    </div>
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
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
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
  }

  .vga-btn-secondary {
    background: #fff;
    border-color: #ddd;
    color: #333;
  }

  .vga-btn-secondary:hover {
    background: #f5f5f5;
  }
</style>
