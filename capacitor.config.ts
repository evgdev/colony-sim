import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.colonysim.game',
  appName: 'Colony Sim',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
