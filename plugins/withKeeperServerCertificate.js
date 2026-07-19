const fs = require("node:fs/promises");
const path = require("node:path");
const {
	withAndroidManifest,
	withDangerousMod,
} = require("expo/config-plugins");

const CERTIFICATE_RESOURCE_NAME = "keeper_server_ca";
const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="@raw/${CERTIFICATE_RESOURCE_NAME}" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

function withNetworkSecurityManifest(config) {
	return withAndroidManifest(config, (config) => {
		const application = config.modResults.manifest.application?.[0];
		if (!application) {
			throw new Error("Android manifest application element is missing");
		}

		application.$ ??= {};
		application.$["android:networkSecurityConfig"] =
			"@xml/network_security_config";
		return config;
	});
}

function withNetworkSecurityResources(config, certificatePath) {
	return withDangerousMod(config, [
		"android",
		async (config) => {
			const sourceCertificate = path.resolve(
				config.modRequest.projectRoot,
				certificatePath,
			);
			const resourceRoot = path.join(
				config.modRequest.platformProjectRoot,
				"app",
				"src",
				"main",
				"res",
			);
			const rawDirectory = path.join(resourceRoot, "raw");
			const xmlDirectory = path.join(resourceRoot, "xml");

			await Promise.all([
				fs.mkdir(rawDirectory, { recursive: true }),
				fs.mkdir(xmlDirectory, { recursive: true }),
			]);
			await Promise.all([
				fs.copyFile(
					sourceCertificate,
					path.join(rawDirectory, `${CERTIFICATE_RESOURCE_NAME}.crt`),
				),
				fs.writeFile(
					path.join(xmlDirectory, "network_security_config.xml"),
					NETWORK_SECURITY_CONFIG,
					"utf8",
				),
			]);

			return config;
		},
	]);
}

module.exports = function withKeeperServerCertificate(config, options = {}) {
	const certificatePath =
		options.certificatePath ?? "assets/certs/keeper_server_ca.crt";
	return withNetworkSecurityResources(
		withNetworkSecurityManifest(config),
		certificatePath,
	);
};
