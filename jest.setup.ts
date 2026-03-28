import "react-native-gesture-handler/jestSetup";
import { jest } from "@jest/globals";

globalThis.jest = jest;

process.env.EXPO_PUBLIC_GITHUB_OWNER ??= "keeper-test-owner";
process.env.EXPO_PUBLIC_GITHUB_REPO ??= "keeper-test-repo";
process.env.EXPO_PUBLIC_GITHUB_TOKEN ??= "keeper-test-token";

jest.mock("expo-file-system", () => ({
	__esModule: true,
	Paths: {
		cache: { uri: "file:///tmp/" },
		document: { uri: "file:///tmp/" },
	},
	Directory: class Directory {
		exists = false;
		name = "";

		create() {}

		delete() {}

		list() {
			return [];
		}
	},
	File: class File {
		exists = false;
		name = "";
		modificationTime = 0;

		async write(..._args: unknown[]) {}

		async text() {
			return "";
		}

		delete() {}
	},
}));

jest.mock("nanoid", () => ({
	__esModule: true,
	nanoid: () => "generated-note-id",
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: {
		getItem: jest.fn(),
		setItem: jest.fn(),
		removeItem: jest.fn(),
		clear: jest.fn(),
	},
}));

jest.mock("react-native-webview", () => {
	const React = require("react");
	const { View } = require("react-native");

	return {
		WebView: React.forwardRef((props: Record<string, unknown>, ref) =>
			React.createElement(View, {
				...props,
				ref,
				testID: props.testID ?? "mock-webview",
			}),
		),
	};
});
