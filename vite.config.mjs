import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: path.join(directory, 'client'),
    plugins: [react(), tailwindcss()],
    build: {
        outDir: path.join(directory, 'dist'),
        emptyOutDir: true
    },
    server: {
        port: Number(process.env.CLIENT_PORT || 5174),
        strictPort: true,
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
