const { withAppBuildGradle } = require("expo/config-plugins");

const PATCH = String.raw`
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    sources.exclude("**/dist/**/*")
    sources.exclude("**/web-build/**/*")
    sources.exclude("**/.expo/**/*")
    sources.exclude("**/src-tauri/target/**/*")
}
`;

module.exports = function withAndroidBundleInputExcludes(config) {
	return withAppBuildGradle(config, (config) => {
		if (!config.modResults.contents.includes('sources.exclude("**/dist/**/*")')) {
			config.modResults.contents = `${config.modResults.contents.trimEnd()}\n${PATCH}`;
		}
		return config;
	});
};
