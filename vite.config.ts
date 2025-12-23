import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isLibrary = mode === 'library'

  return {
    plugins: [
      react(),
      isLibrary && dts({
        include: ['src'],
        exclude: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
        insertTypesEntry: true,
      }),
    ].filter(Boolean),

    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Proxying:', req.method, req.url, '->', proxyReq.path);
            });
          }
        },
        '/health': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },

    build: isLibrary ? {
      // Library build configuration
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'HubAndSpokeWireguard',
        formats: ['es', 'umd'],
        fileName: (format) =>
          format === 'es'
            ? 'hub-and-spoke-wireguard.js'
            : 'hub-and-spoke-wireguard.umd.cjs',
      },
      rollupOptions: {
        // Externalize peer dependencies
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            'react/jsx-runtime': 'react/jsx-runtime',
          },
        },
      },
      sourcemap: true,
      emptyOutDir: true,
    } : {
      // Standard app build for preview/testing
      outDir: 'dist',
      sourcemap: true,
    },
  }
})
