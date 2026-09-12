import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    skipOfflineFallback?: boolean;
  }
}
