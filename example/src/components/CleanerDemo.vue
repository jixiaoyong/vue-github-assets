<script setup lang="ts">
    import { ref } from 'vue';
    import { cleanupExifFromFile, formatFileSize } from '@jixiaoyong/vue-github-assets';

    const file = ref<File | null>(null);
    const cleanedFile = ref<File | null>(null);
    const cleanedUrl = ref<string | null>(null);
    const processing = ref(false);
    const error = ref<string | null>(null);
    const logs = ref<string[]>([]); // To show added/removed fields

    const handleFileSelect = (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            file.value = input.files[0];
            // Reset output
            cleanedFile.value = null;
            if (cleanedUrl.value) {
                URL.revokeObjectURL(cleanedUrl.value);
                cleanedUrl.value = null;
            }
            error.value = null;
            logs.value = [];
        }
    };

    const processFile = async () => {
        if (!file.value) return;

        processing.value = true;
        error.value = null;
        logs.value = [];

        try {
            const result = await cleanupExifFromFile(file.value);

            if (result.success && result.file) {
                cleanedFile.value = result.file;
                cleanedUrl.value = URL.createObjectURL(result.file);

                // Collect logs
                if (result.removedFields.length > 0) {
                    logs.value.push('Removed:');
                    result.removedFields.forEach(f => logs.value.push(` - ${f}`));
                } else {
                    logs.value.push('No privacy fields found to remove.');
                }

                if (result.addedFields.length > 0) {
                    logs.value.push('Added/Modified:');
                    result.addedFields.forEach(f => logs.value.push(` - ${f}`));
                }

                if (result.convertedFrom) {
                    logs.value.unshift(`Converted from ${result.convertedFrom}`);
                }

            } else {
                error.value = result.error || 'Unknown error occurred';
            }
        } catch (err) {
            error.value = err instanceof Error ? err.message : String(err);
        } finally {
            processing.value = false;
        }
    };

    const downloadFile = () => {
        if (!cleanedUrl.value || !cleanedFile.value) return;
        const a = document.createElement('a');
        a.href = cleanedUrl.value;
        a.download = cleanedFile.value.name; // Uses original name or new name from tool
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
</script>

<template>
    <div class="cleaner-demo">
        <h3>Privacy Information Cleaner</h3>
        <p class="description">
            Upload an image (JPEG/HEIC) to strip privacy-sensitive EXIF data (GPS, Device Info, etc.) locally on your
            device.
        </p>

        <div class="input-section">
            <input type="file" @change="handleFileSelect" accept="image/jpeg,image/heic,image/heif" />
            <button v-if="file" @click="processFile" :disabled="processing" class="vga-btn">
                {{ processing ? 'Processing...' : 'Clean Privacy Info' }}
            </button>
        </div>

        <div v-if="error" class="error-msg">
            {{ error }}
        </div>

        <div v-if="cleanedFile" class="result-section">
            <div class="comparison">
                <div class="file-info original">
                    <h4>Original</h4>
                    <p>Size: {{ formatFileSize(file?.size || 0) }}</p>
                </div>
                <div class="arrow">→</div>
                <div class="file-info cleaned">
                    <h4>Cleaned</h4>
                    <p>Size: {{ formatFileSize(cleanedFile.size) }}</p>
                </div>
            </div>

            <div class="actions">
                <button @click="downloadFile" class="vga-btn vga-btn-primary">
                    Download Cleaned Image
                </button>
            </div>

            <div class="logs" v-if="logs.length > 0">
                <h4>Operation Log:</h4>
                <ul>
                    <li v-for="(log, index) in logs" :key="index">{{ log }}</li>
                </ul>
            </div>

            <div class="preview" v-if="cleanedUrl">
                <h4>Preview (Cleaned):</h4>
                <img :src="cleanedUrl" alt="Cleaned preview" />
            </div>
        </div>
    </div>
</template>

<style scoped>
    .cleaner-demo {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        margin-top: 20px;
    }

    .description {
        color: #666;
        margin-bottom: 20px;
    }

    .input-section {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }

    .vga-btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid #ddd;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .vga-btn:hover {
        background: #f5f5f5;
    }

    .vga-btn-primary {
        background: #0366d6;
        color: white;
        border: none;
    }

    .vga-btn-primary:hover {
        background: #0255b3;
    }

    .error-msg {
        color: #d73a49;
        background: #ffeef0;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 20px;
    }

    .comparison {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 20px;
        background: #f6f8fa;
        padding: 15px;
        border-radius: 6px;
    }

    .file-info h4 {
        margin: 0 0 5px 0;
        font-size: 0.9rem;
        color: #586069;
    }

    .file-info p {
        margin: 0;
        font-weight: 600;
    }

    .arrow {
        color: #999;
        font-size: 1.2rem;
    }

    .logs {
        margin-top: 20px;
        font-size: 0.85rem;
        color: #586069;
        background: #f6f8fa;
        padding: 15px;
        border-radius: 6px;
    }

    .logs h4 {
        margin-top: 0;
        margin-bottom: 5px;
    }

    .logs ul {
        margin: 0;
        padding-left: 20px;
    }

    .preview {
        margin-top: 20px;
    }

    .preview img {
        max-width: 100%;
        max-height: 400px;
        border-radius: 4px;
        border: 1px solid #eee;
    }
</style>
