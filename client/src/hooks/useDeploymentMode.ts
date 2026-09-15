import { useQuery } from '@tanstack/react-query';
import { installationApi } from '@/api/installation.api';

export function useDeploymentMode(): 'online' | 'offline' | undefined {
  const { data } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });
  return data?.deploymentMode;
}

/** AI Assistant is an Online-only UI entry point. Hidden until mode is known to be online. */
export function useShowAiAssistant(canUseAiAssistant: boolean): boolean {
  const mode = useDeploymentMode();
  return canUseAiAssistant && mode === 'online';
}
