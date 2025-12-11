import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        vue(),
        dts({
            insertTypesEntry: true,
            include: ['src/**/*.ts', 'src/**/*.vue'],
        }),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'VueGithubAssets',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
            // External dependencies that shouldn't be bundled
            external: ['vue', '@octokit/rest', 'libheif-js', 'piexifjs', 'lucide-vue-next'],
            output: {
                // Global variables for UMD build
                globals: {
                    vue: 'Vue',
                    '@octokit/rest': 'Octokit',
                },
                // Preserve CSS
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') return 'style.css';
                    return assetInfo.name || 'asset';
                },
            },
        },
        // Generate sourcemaps for debugging
        sourcemap: true,
        // Minify for production
        minify: 'esbuild',
    },
});
