export default ({ config }) => {
	return {
		...config,
		expo: {
			name: "Keeper",
			slug: "keeper-pwa",
			version: "1.0.0",
			web: {
				output: "static",
				favicon: "./assets/images/favicon.png",
			},
			plugins: [
				"expo-router",
			],
			experiments: {
				typedRoutes: true,
				reactCompiler: true,
			},
		},
	};
};
