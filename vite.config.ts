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
