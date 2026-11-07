import { defineConfig } from 'tsdown'

export default defineConfig([
  { entry: { index: 'src/index.ts', 'preset-route': 'src/preset-route.ts' },
    outDir: 'lib', format: 'esm', platform: 'node', dts: true, sourcemap: true, clean: true,
    deps: { neverBundle: [/^@deepseek-ai\//, /^@anthropic-ai\//] } },
  { entry: { client: 'src/client.tsx' }, outDir: 'lib', format: 'cjs', platform: 'browser',
    dts: false, sourcemap: true, clean: false,
    external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-settings'],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-claude-code", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    } },
])
