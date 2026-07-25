import { AxiosInstance } from 'axios';
import { endpoints } from '../api/endpoints';

export interface PushDeps {
  getPermissions(): Promise<{ granted: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  getExpoPushToken(): Promise<string>;
  platform: 'ios' | 'android';
}

export async function registerForPush(
  api: AxiosInstance, app: 'customer' | 'rider' | 'restaurant', deps: PushDeps,
): Promise<string | null> {
  let perm = await deps.getPermissions();
  if (!perm.granted) perm = await deps.requestPermissions();
  if (!perm.granted) return null;
  const token = await deps.getExpoPushToken();
  await api.post(endpoints.deviceRegister, { expo_token: token, app, platform: deps.platform });
  return token;
}
