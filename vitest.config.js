import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['**/__tests__/**/*.spec.js'],
      // .claude/ holds agent worktrees: full copies of the repo with their own tests.
      exclude: [...configDefaults.exclude, 'tests/**', '.claude/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
