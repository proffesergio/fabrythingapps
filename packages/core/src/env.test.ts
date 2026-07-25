import { getApiBaseUrl } from './env';
test('defaults when env unset', () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  expect(getApiBaseUrl()).toMatch(/\/api\/$/);
});
