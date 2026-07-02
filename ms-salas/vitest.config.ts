import { defineConfig } from 'vitest/config';

// Config propia para que vitest no herede el vite.config.ts del frontend
// (que carga el plugin de React, innecesario para tests de backend).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
