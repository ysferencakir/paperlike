import type { CapacitorConfig } from '@capacitor/cli';
import { networkInterfaces } from 'os';

function getLocalIp(): string | undefined {
  for (const iface of Object.values(networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return undefined;
}

const isDev = process.env.CAP_DEV === 'true';
const devIp = process.env.CAP_DEV_IP ?? getLocalIp();

const config: CapacitorConfig = {
  appId: 'com.ysferencakir.paperlike',
  appName: 'Paperlike',
  webDir: 'out',
  ...(isDev && devIp
    ? {
        server: {
          url: `http://${devIp}:3000`,
          cleartext: true,
        },
      }
    : {}),
};

export default config;
