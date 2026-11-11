// Архив Expo. Пакетирование WebM и NativeWind; release-minifier убирает console/debugger без изменения исходников.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...config.resolver.assetExts, "webm"];

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    compress: {
      ...(config.transformer?.minifierConfig?.compress || {}),
      drop_console: true,
      drop_debugger: true,
    },
  },
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Use NativeWind's Metro integration; forcing filesystem mode bypasses it.
  forceWriteFileSystem: false,
});
