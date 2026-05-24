import { withGradleProperties } from "expo/config-plugins";

const withBuildSpeedOptimizations = (config) => {
	return withGradleProperties(config, (config) => {
		const props = config.modResults;
		const set = (key, value) => {
			const existing = props.find((p) => p.type === "property" && p.key === key);
			if (existing) {
				existing.value = value;
			} else {
				props.push({ type: "property", key, value });
			}
		};
		set("org.gradle.jvmargs", "-Xmx4096m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8");
		set("org.gradle.caching", "true");
		set("org.gradle.daemon", "true");
		set("kotlin.incremental", "true");
		set("kotlin.incremental.useClasspathSnapshot", "true");
		// Single arch for local dev; build:android script overrides this for release
		set("reactNativeArchitectures", "arm64-v8a");
		return config;
	});
};

export default ({ config }) => {
	return withBuildSpeedOptimizations({
		...config,
		expo: {
			name: "Keeper",
			slug: "native",
			version: "1.0.0",
			orientation: "portrait",
			icon: "./assets/images/icon.png",
			scheme: "native",
			userInterfaceStyle: "automatic",
			newArchEnabled: true,
			ios: {
				supportsTablet: true,
				bundleIdentifier: "com.clikethis123.keeper",
			},
			android: {
				versionCode: 3,
				softwareKeyboardLayoutMode: "pan",
				adaptiveIcon: {
					backgroundColor: "#E6F4FE",
					foregroundImage: "./assets/images/android-icon-foreground.png",
					backgroundImage: "./assets/images/android-icon-background.png",
					monochromeImage: "./assets/images/android-icon-monochrome.png",
				},
				edgeToEdgeEnabled: true,
				predictiveBackGestureEnabled: false,
				package: "com.clikethis123.keeper",
			},
			web: {
				output: "static",
				favicon: "./assets/images/favicon.png",
			},
			plugins: [
				"expo-router",
				"expo-share-intent",
				[
					"expo-splash-screen",
					{
						image: "./assets/images/splash-icon.png",
						imageWidth: 200,
						resizeMode: "contain",
						backgroundColor: "#ffffff",
						dark: {
							backgroundColor: "#000000",
						},
					},
				],
				[
					"expo-sqlite",
					{
						enableFTS: true,
					},
				],
			],
			experiments: {
				typedRoutes: true,
				reactCompiler: true,
			},
			extra: {
				router: {},
				eas: {
					projectId: "0e09ac97-269f-48f9-ae60-4f4bda4ae973",
				},
			},
			runtimeVersion: {
				policy: "appVersion",
			},
			updates: {
				url: "https://u.expo.dev/0e09ac97-269f-48f9-ae60-4f4bda4ae973",
			},
		},
	});
};
