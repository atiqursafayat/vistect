import { defineConfig } from 'vitest/config';
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
    test: {
        environment: 'happy-dom',
        globals: true,
        include: ['src/**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
        setupFiles: ['./vitest.setup.ts'],
    },
});
//# sourceMappingURL=vitest.config.js.map