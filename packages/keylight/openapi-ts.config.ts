import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './docs/openapi.yaml',
  output: {
    path: './src/generated',
    importFileExtension: '.js',
    postProcess: ['oxfmt'],
  },
  plugins: [
    {
      name: '@hey-api/typescript',
    },
    {
      name: '@hey-api/sdk',
    },
    {
      name: '@hey-api/client-fetch',
    },
  ],
})
