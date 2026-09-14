import { AxiosInstance } from 'axios';

export async function probeApiHealth(api: AxiosInstance): Promise<boolean> {
  try {
    const res = await api.get('/health', { timeout: 4000, skipOfflineFallback: true });
    return res.data?.ok === true;
  } catch {
    return false;
  }
}
