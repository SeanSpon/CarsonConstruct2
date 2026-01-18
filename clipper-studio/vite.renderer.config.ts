import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig(async (env: ConfigEnv): Promise<UserConfig> => {
  const { default: react } = await import('@vitejs/plugin-react');
  
  return {
    plugins: [react()],
  };
});
