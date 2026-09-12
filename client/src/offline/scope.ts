import { getCachedInstallation, getDeploymentMode, setCachedInstallation, setDeploymentMode } from './storage';
import { useOfflineStatusStore } from './status.store';

interface DeploymentStatus {
  deploymentMode?: 'online' | 'offline';
}

export async function rememberOnlineScope(status: DeploymentStatus | null | undefined): Promise<void> {
  if (!status?.deploymentMode) return;
  await setDeploymentMode(status.deploymentMode);
  await setCachedInstallation(status);
  useOfflineStatusStore.getState().setEnabled(status.deploymentMode === 'online');
}

export async function hydrateOnlineScope(): Promise<boolean> {
  const mode = await getDeploymentMode();
  const cached = (await getCachedInstallation()) as DeploymentStatus | null;
  const enabled = mode === 'online' || cached?.deploymentMode === 'online';
  useOfflineStatusStore.getState().setEnabled(enabled);
  return enabled;
}

export async function isOnlineDeployment(): Promise<boolean> {
  if (useOfflineStatusStore.getState().enabled) return true;
  return hydrateOnlineScope();
}
