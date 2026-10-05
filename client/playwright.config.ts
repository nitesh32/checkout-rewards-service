import { defineConfig } from '@playwright/test';

const BACKEND_PORT = 3100;
const CLIENT_PORT = 5199;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${CLIENT_PORT}`, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run e2e:server',
      cwd: '..',
      env: { PORT: String(BACKEND_PORT) },
      url: `http://localhost:${BACKEND_PORT}/docs/json`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${CLIENT_PORT} --strictPort`,
      env: { API_URL: `http://localhost:${BACKEND_PORT}` },
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: false,
    },
  ],
});
