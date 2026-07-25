import { AxiosInstance } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { endpoints } from '../api/endpoints';

export interface LoginResult { access: string; refresh: string; role: string; username: string; }

interface AccessClaims { role?: string; username?: string; }

export async function login(api: AxiosInstance, identifier: string, password: string): Promise<LoginResult> {
  // Backend login returns a flat {access, refresh, message}; role/username are
  // claims on the access token, not in the body.
  const res = await api.post(endpoints.login, { username: identifier, password });
  const { access, refresh } = res.data;
  const claims = jwtDecode<AccessClaims>(access);
  return { access, refresh, role: claims.role ?? '', username: claims.username ?? '' };
}
