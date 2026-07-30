import { render, screen, fireEvent } from '@testing-library/react-native';
import Hub from './index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@fabrything/core', () => ({ t: (k: string) => k }));

afterEach(() => {
  mockPush.mockReset();
});

test('reaches the store surface', async () => {
  await render(<Hub />);
  fireEvent.press(screen.getByText('browseStore'));
  expect(mockPush).toHaveBeenCalledWith('/store');
});

test('reaches the existing food surface', async () => {
  await render(<Hub />);
  fireEvent.press(screen.getByText('orderFood'));
  expect(mockPush).toHaveBeenCalledWith('/food');
});
