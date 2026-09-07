import { registerSW } from 'virtual:pwa-register';

export function registerPwaServiceWorker(): void {
  if (import.meta.env.DEV) {
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        registration.update().catch(() => undefined);
      }
    },
  });
}
