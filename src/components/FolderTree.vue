<script setup lang="ts">
    /**
     * FolderTree.vue
     * Recursive component for displaying folder structure
     */
    import { computed } from 'vue';
    import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-vue-next';

    // ============================================
    // Types
    // ============================================

    interface Props {
        folders: string[];
        currentPath?: string;
        level?: number;
    }

    const props = withDefaults(defineProps<Props>(), {
        currentPath: '',
        level: 0,
    });

    const emit = defineEmits<{
        select: [path: string];
    }>();

    // ============================================
    // Logic
    // ============================================

    interface TreeNode {
        name: string;
        path: string;
        children: TreeNode[];
    }

    const tree = computed(() => {
        const root: TreeNode[] = [];
        const map: Record<string, TreeNode> = {};

        // Sort folders to ensure parents come before children
        const sortedFolders = [...props.folders].sort();

        for (const path of sortedFolders) {
            const parts = path.split('/');
            const name = parts[parts.length - 1];
            const parentPath = parts.slice(0, -1).join('/');

            const node: TreeNode = {
                name,
                path,
                children: [],
            };

            map[path] = node;

            if (parentPath && map[parentPath]) {
                // Parent exists, add as child
                map[parentPath].children.push(node);
            } else if (!parentPath) {
                // Top-level folder
                root.push(node);
            } else {
                // Orphan folder (parent doesn't exist in list)
                // Display with full path as name at root level
                node.name = path; // Show full path like "dart/event_loop"
                root.push(node);
            }
        }

        return root;
    });

    function isExpanded(path: string): boolean {
        // Always expand if current path starts with this folder
        if (props.currentPath.startsWith(path)) return true;
        // TODO: Add manual toggle state if needed
        return false;
    }

    function handleSelect(path: string) {
        emit('select', path);
    }
</script>

<template>
    <ul class="vga-folder-tree">
        <!-- Root Item (All Files) -->
        <li v-if="level === 0" class="vga-folder-item">
            <div class="vga-folder-row" :class="{ 'vga-folder-row--active': currentPath === '' }"
                @click="handleSelect('')">
                <span class="vga-folder-indent" />
                <FolderOpen v-if="currentPath === ''" :size="16" class="vga-folder-icon" />
                <Folder v-else :size="16" class="vga-folder-icon" />
                <span class="vga-folder-name">All Assets</span>
            </div>
        </li>

        <!-- Recursive Tree -->
        <li v-for="node in tree" :key="node.path" class="vga-folder-item">
            <div class="vga-folder-row" :class="{ 'vga-folder-row--active': currentPath === node.path }"
                :style="{ paddingLeft: `${level * 16}px` }" @click="handleSelect(node.path)">
                <!-- Toggle Icon -->
                <button v-if="node.children.length > 0" class="vga-folder-toggle" @click.stop>
                    <ChevronDown v-if="isExpanded(node.path)" :size="12" />
                    <ChevronRight v-else :size="12" />
                </button>
                <span v-else class="vga-folder-spacer" />

                <!-- Folder Icon -->
                <FolderOpen v-if="currentPath === node.path || (isExpanded(node.path) && node.children.length > 0)"
                    :size="16" class="vga-folder-icon" />
                <Folder v-else :size="16" class="vga-folder-icon" />

                <!-- Name -->
                <span class="vga-folder-name">{{ node.name }}</span>
            </div>

            <!-- Children -->
            <FolderTree v-if="node.children.length > 0"
                :folders="props.folders.filter(f => f.startsWith(node.path + '/'))" :current-path="currentPath"
                :level="level + 1" @select="handleSelect" />
        </li>
    </ul>
</template>

<style scoped>
    .vga-folder-tree {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: var(--vga-text-sm);
        color: var(--vga-text-secondary);
    }

    .vga-folder-item {
        display: flex;
        flex-direction: column;
    }

    .vga-folder-row {
        display: flex;
        align-items: center;
        height: 32px;
        padding-right: var(--vga-space-2);
        cursor: pointer;
        border-radius: var(--vga-radius-sm);
        transition: all 0.2s ease;
        user-select: none;
    }

    .vga-folder-row:hover {
        background: var(--vga-bg-secondary);
        color: var(--vga-text-primary);
    }

    .vga-folder-row--active {
        background: var(--vga-bg-tertiary);
        color: var(--vga-accent);
        font-weight: var(--vga-font-medium);
    }

    .vga-folder-indent {
        width: 8px;
    }

    .vga-folder-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border: none;
        background: none;
        color: inherit;
        cursor: pointer;
        opacity: 0.6;
    }

    .vga-folder-toggle:hover {
        opacity: 1;
    }

    .vga-folder-spacer {
        width: 20px;
    }

    .vga-folder-icon {
        margin-right: var(--vga-space-2);
        opacity: 0.8;
    }

    .vga-folder-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
