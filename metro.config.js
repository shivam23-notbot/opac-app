const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Prefer 'react-native' exports condition over 'import' on web to avoid
// ESM-only packages (e.g. zustand) shipping import.meta which crashes Metro.
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'default'];

module.exports = withNativeWind(config, { input: './global.css' });
