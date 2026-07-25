const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Expo Router treats every file under app/ as a route. The Jest smoke test
// lives at app/index.test.tsx (co-located with the screen it covers), so it
// must be excluded from Metro's route bundling — otherwise `expo start` /
// `expo export` fail trying to bundle @testing-library/react-native (which
// pulls in Node-only modules like `console`) into the app itself.
config.resolver.blockList = [...config.resolver.blockList, /\/app\/.*\.test\.[jt]sx?$/];

module.exports = config;
