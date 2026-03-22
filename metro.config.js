const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// allow wasm files
config.resolver.assetExts.push("wasm");

module.exports = config;
