import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@vistect/domain': path.resolve(__dirname, '../../packages/domain/src'),
            '@vistect/graph': path.resolve(__dirname, '../../packages/graph/src'),
            '@vistect/charting': path.resolve(__dirname, '../../packages/charting/src'),
            '@vistect/render-html': path.resolve(__dirname, '../../packages/render-html/src'),
            '@vistect/render-pdf': path.resolve(__dirname, '../../packages/render-pdf/src'),
            '@vistect/webmcp': path.resolve(__dirname, '../../packages/webmcp/src'),
            '@vistect/storage': path.resolve(__dirname, '../../packages/storage/src'),
            '@vistect/testing': path.resolve(__dirname, '../../packages/testing/src'),
        },
    },
    build: {
        target: 'es2022',
        minify: 'esbuild',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-zustand': ['zustand'],
                    'vendor-elk': ['elkjs'],
                    'vendor-dagre': ['dagre'],
                    'vendor-pdf': ['pdf-lib'],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
    server: {
        port: 3000,
        open: true,
    },
    define: {
        'import.meta.env.WEB_MCP_SPEC_VERSION': JSON.stringify('chrome-149-origin-trial-2026-05'),
    },
});
//# sourceMappingURL=vite.config.js.map