module.exports = {
	preset: "jest-expo",
	transform: {
		"\\.[jt]sx?$": [
			"babel-jest",
			{
				babelrc: false,
				configFile: false,
				presets: ["babel-preset-expo"],
				plugins: ["babel-plugin-dynamic-import-node"],
			},
		],
	},
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	testMatch: ["**/__tests__/**/*.test.ts?(x)", "**/*.jest.test.ts?(x)"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^lib0/webcrypto$": "<rootDir>/node_modules/lib0/dist/webcrypto.node.cjs",
	},
	testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
	transformIgnorePatterns: [
		"node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*))",
	],
	clearMocks: true,
	watchman: false,
};
