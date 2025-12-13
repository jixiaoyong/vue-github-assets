import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        vue(),
        cssInjectedByJsPlugin(),
        dts({
            rollupTypes: true,
            insertTypesEntry: true,
            include: ['src/**/*.ts', 'src/**/*.vue'],
            tsconfigPath: resolve(__dirname, 'tsconfig.json'),
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
        // Disable sourcemaps for production (smaller package size)
        sourcemap: false,
        // Minify for production
        minify: 'esbuild',
    },
});
