module.exports = {
  preset: 'jest-expo',
  // A cold jest cache (every CI run, after `npm ci`) makes the first
  // react-native transform take ~7s, past jest's 5s default.
  testTimeout: 30000,
};
