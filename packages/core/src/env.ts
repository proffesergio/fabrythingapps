export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'https://fabrythingweb.onrender.com/api/';
}
