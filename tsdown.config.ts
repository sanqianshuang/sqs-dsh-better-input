import { defineConfig } from 'tsdown'
import { clientBundle } from './tsdown.client.ts'

export default defineConfig([
  {
    name: 'sanqianshuang-better-input',
    entry: {
      index: 'src/index.ts',
      typert: 'src/typert.ts',
      remote: 'src/remote.ts'
    },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    dts: false,
    clean: true,
    sourcemap: true,
    outExtensions: () => ({
      js: '.js',
      dts: '.d.ts'
    })
  },
  clientBundle('sanqianshuang-better-input', 'src/client.ts')
])
