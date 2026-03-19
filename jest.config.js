module.exports = {
	preset: "jest-expo",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	testMatch: ["**/*.jest.test.ts?(x)"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@react-navigation/([^/]+)$":
			"<rootDir>/node_modules/@react-navigation/$1/src/index.tsx",
	},
	testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
	transformIgnorePatterns: [
		"node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|@react-navigation/.*))",
	],
	watchman: false,
};
