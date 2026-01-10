import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        dts({ include: ['src/Coverflow.tsx'] })
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/Coverflow.tsx'),
            name: 'Coverflow',
            fileName: 'cover-flow',
            formats: ['es', 'umd']
        },
        rollupOptions: {
            external: ['react', 'react-dom'],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM'
                }
            }
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.ts',
    },
})
