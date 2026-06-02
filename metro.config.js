const { getDefaultConfig } = require("expo/metro-config");
const fs = require("node:fs");

const config = getDefaultConfig(__dirname);

// allow wasm files
config.resolver.assetExts.push("wasm");

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
	const resolveRequest = defaultResolveRequest ?? context.resolveRequest;
	const resolution = resolveRequest(context, moduleName, platform);

	if (
		resolution?.type === "sourceFile" &&
		(resolution.filePath.includes("/node_modules/@lexical/") ||
			resolution.filePath.includes("/node_modules/lexical/")) &&
		resolution.filePath.endsWith(".node.mjs")
	) {
		const browserFilePath = resolution.filePath.replace(/\.node\.mjs$/, ".mjs");
		if (fs.existsSync(browserFilePath)) {
			return {
				...resolution,
				filePath: browserFilePath,
			};
		}
	}

	return resolution;
};

module.exports = config;
