import { AxiosInstance } from 'axios';
import { endpoints } from '../api/endpoints';

export interface MobileConfig {
  min_supported_version: Record<'customer' | 'rider' | 'restaurant', string>;
  feature_flags: Record<string, boolean>;
  support: { facebook_url: string; messenger_url: string };
  tile_url: string;
}

export async function fetchMobileConfig(api: AxiosInstance): Promise<MobileConfig> {
  const res = await api.get(endpoints.mobileConfig);
  return res.data.data as MobileConfig;
}
