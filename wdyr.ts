import React from "react";

// Only run in development
if (typeof __DEV__ === "undefined" || __DEV__) {
	try {
		const whyDidYouRender = require("@welldone-software/why-did-you-render");
		whyDidYouRender(React, {
			trackAllPureComponents: false,
			trackHooks: false,
			logOwnerReasons: false,
			collapseGroups: false, // Set to false to see all logs expanded
			logOnDifferentValues: false, // Log ALL re-renders, not just avoidable ones
			// Don't use include filter - rely on explicit whyDidYouRender flags
			exclude: [
				/^RCT/,
				/^Text/,
				/^View/,
				/^Pressable/,
				/^ScrollView/,
				/^ActivityIndicator/,
				/^MaterialIcons/,
			],
			onlyLogs: false,
		});
		// Log initialization - this should appear in console
		console.log("[WDYR] Why Did You Render initialized successfully");
	} catch (error) {
		console.warn("[WDYR] Failed to initialize:", error);
	}
}
