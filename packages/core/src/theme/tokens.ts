// "Spice market" identity — matches fabrythingweb src/food/theme.js FOOD / FOOD_DARK.
// Dark mode uses a warm charcoal (roasted-coffee browns), not a blue-grey, and lifts
// `primary` since the light-mode chili goes muddy and fails contrast on dark surfaces.
export const brand = { primary: '#E8452B', secondary: '#F4A62A' };

export const theme = {
  light: {
    bg: '#FDF8F3',
    surface: '#FFFFFF',
    text: '#241812',
    muted: '#8C7B6E',
    line: '#EFE6DC',
    primary: '#E8452B',
    primaryDeep: '#C4361F',
    secondary: '#F4A62A',
    success: '#2F7D4F',
  },
  dark: {
    bg: '#17110E',
    surface: '#211915',
    text: '#F6EDE5',
    muted: '#AD9C8E',
    line: '#33261F',
    primary: '#FF6B4F',
    primaryDeep: '#E8452B',
    secondary: '#FFBC4D',
    success: '#4CAF7A',
  },
  space: (n: number) => n * 8,
  radius: 12,
};
