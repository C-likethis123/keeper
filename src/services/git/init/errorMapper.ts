import { NOTES_ROOT } from "@/services/notes/Notes";
import { Platform } from "react-native";
import { Directory } from "expo-file-system";
import type { CloneErrorResolution, GitInitErrorMapper } from "./types";

const TLS_CERT_ERROR_PREFIX = "tls_cert_invalid";

export class DefaultGitInitErrorMapper implements GitInitErrorMapper {
	private isCertificateFailure(message: string): boolean {
		const normalized = message.toLowerCase();
		return (
			normalized.includes(TLS_CERT_ERROR_PREFIX) ||
			normalized.includes("ssl certificate is invalid") ||
			normalized.includes("certificate validation failed") ||
			normalized.includes("certificate verify failed")
		);
	}

	private buildCertificateFailureMessage(errorMessage: string): string {
		return [
			"TLS certificate validation failed while cloning from GitHub.",
			`Error detail: ${errorMessage}`,
			"Verify automatic date/time on the device, update the device trust store, and confirm https://github.com opens in the device browser before retrying.",
		].join(" ");
	}

	async resolveCloneFailure(error: unknown): Promise<CloneErrorResolution> {
		console.error("[GitInitializationService] Clone error:", error);

		if (!(error instanceof Error)) {
			return {
				failureMessage:
					"Failed to clone repository. Check network connection and repository access permissions",
			};
		}

		const errorMessage = error.message.toLowerCase();
		const errorCode = (error as Error & { code?: string }).code;

		if (
			errorMessage.includes("commitnotfetched") ||
			errorMessage.includes("not available locally") ||
			errorMessage.includes("notfounderror")
		) {
			console.error(
				"[GitInitializationService] Clone failed due to repository corruption",
			);
			console.error(
				"[GitInitializationService] Attempting to clean up corrupted repository...",
			);
			if (Platform.OS !== "web") {
				const notesRootDir = new Directory(NOTES_ROOT);
				if (notesRootDir.exists) {
					await Promise.resolve(notesRootDir.delete());
				}
			}
			return {};
		}

		if (
			errorMessage.includes("authentication failed") ||
			errorMessage.includes("401") ||
			errorMessage.includes("403")
		) {
			console.error("[GitInitializationService] Authentication error details:");
			console.error("  - Error:", error.message);
			return {};
		}

		if (this.isCertificateFailure(errorMessage)) {
			const failureMessage = this.buildCertificateFailureMessage(error.message);
			console.error("[GitInitializationService] TLS certificate error:");
			console.error(
				"[GitInitializationService] 1) Verify device automatic date/time is enabled",
			);
			console.error(
				"[GitInitializationService] 2) Update device trust store / system certificates",
			);
			console.error(
				"[GitInitializationService] 3) Confirm https://github.com opens in the same device browser",
			);
			console.error(
				"[GitInitializationService] 4) Retry clone after the above checks",
			);
			return { failureMessage };
		}

		if (
			errorMessage.includes("network") ||
			errorMessage.includes("fetch") ||
			errorMessage.includes("connection")
		) {
			console.error("[GitInitializationService] Network error:", error.message);
			return {};
		}

		if (
			errorMessage.includes("permission") ||
			errorCode === "EACCES" ||
			errorCode === "EPERM"
		) {
			console.error(
				"[GitInitializationService] File system permission error. Ensure app has storage permissions",
			);
			return {};
		}

		if (errorCode === "ENOENT" || errorMessage.includes("enoent")) {
			console.warn(
				"[GitInitializationService] ENOENT error during clone - this may be expected, but clone failed",
			);
			return {};
		}

		return {
			failureMessage:
				"Failed to clone repository. Check network connection and repository access permissions",
		};
	}
}
