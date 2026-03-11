const fs = require("node:fs/promises");
const path = require("node:path");
const {
	withDangerousMod,
	withMainApplication,
} = require("@expo/config-plugins");

const BRIDGE_PACKAGE = "com.clikethis123.keeper";
const BRIDGE_PACKAGE_PATH = BRIDGE_PACKAGE.replace(/\./g, path.sep);

const MODULE_SOURCE = `package com.clikethis123.keeper

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

class KeeperGitBridgeModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    init {
      System.loadLibrary("git_core")
    }
  }

  override fun getName(): String = "KeeperGitBridge"

  private external fun git_clone(url: String, path: String): Int
  private external fun git_last_error_message(): String?
  private external fun git_fetch(repoPath: String): Int
  private external fun git_checkout_ex(
    repoPath: String,
    reference: String,
    force: Int,
    noUpdateHead: Int
  ): Int
  private external fun git_current_branch_json(repoPath: String): String?
  private external fun git_list_branches_json(repoPath: String, remote: String?): String?
  private external fun git_merge_json(repoPath: String, optionsJson: String): Int
  private external fun git_commit(repoPath: String, message: String): Int
  private external fun git_push(repoPath: String): Int
  private external fun git_status_json(repoPath: String): String?
  private external fun git_head_oid_json(repoPath: String): String?
  private external fun git_changed_markdown_paths_json(
    repoPath: String,
    fromOid: String,
    toOid: String
  ): String?

  @ReactMethod
  fun clone(url: String, path: String, promise: Promise) {
    settleCode("clone", git_clone(url, path), promise)
  }

  @ReactMethod
  fun fetch(repoPath: String, promise: Promise) {
    settleCode("fetch", git_fetch(repoPath), promise)
  }

  @ReactMethod
  fun checkout(
    repoPath: String,
    reference: String,
    options: Map<String, Any>?,
    promise: Promise
  ) {
    val force = if (options?.get("force") == true) 1 else 0
    val noUpdateHead = if (options?.get("noUpdateHead") == true) 1 else 0
    settleCode(
      "checkout",
      git_checkout_ex(repoPath, reference, force, noUpdateHead),
      promise
    )
  }

  @ReactMethod
  fun currentBranch(repoPath: String, promise: Promise) {
    settlePayload("current_branch", git_current_branch_json(repoPath), promise)
  }

  @ReactMethod
  fun listBranches(repoPath: String, remote: String?, promise: Promise) {
    settlePayload("list_branches", git_list_branches_json(repoPath, remote), promise)
  }

  @ReactMethod
  fun merge(repoPath: String, options: Map<String, Any>, promise: Promise) {
    val ours = options["ours"] as? String
    val theirs = options["theirs"] as? String
    if (ours == null || theirs == null) {
      promise.reject("E_GIT_MERGE", "Rust git merge requires 'ours' and 'theirs'")
      return
    }

    val payload = JSONObject().apply {
      put("ours", ours)
      put("theirs", theirs)
      if (options.containsKey("fastForwardOnly")) {
        put("fast_forward_only", options["fastForwardOnly"])
      }
      (options["message"] as? String)?.let { put("message", it) }
      val author = options["author"] as? Map<*, *>
      if (author != null) {
        put(
          "author",
          JSONObject().apply {
            put("name", author["name"])
            put("email", author["email"])
          }
        )
      }
    }

    settleCode("merge", git_merge_json(repoPath, payload.toString()), promise)
  }

  @ReactMethod
  fun commit(repoPath: String, message: String, promise: Promise) {
    settleCode("commit", git_commit(repoPath, message), promise)
  }

  @ReactMethod
  fun push(repoPath: String, promise: Promise) {
    settleCode("push", git_push(repoPath), promise)
  }

  @ReactMethod
  fun status(repoPath: String, promise: Promise) {
    settlePayload("status", git_status_json(repoPath), promise)
  }

  @ReactMethod
  fun resolveHeadOid(repoPath: String, promise: Promise) {
    settlePayload("head_oid", git_head_oid_json(repoPath), promise)
  }

  @ReactMethod
  fun changedMarkdownPaths(
    repoPath: String,
    fromOid: String,
    toOid: String,
    promise: Promise
  ) {
    settlePayload(
      "changed_markdown_paths",
      git_changed_markdown_paths_json(repoPath, fromOid, toOid),
      promise
    )
  }

  private fun settleCode(op: String, code: Int, promise: Promise) {
    if (code == 0) {
      promise.resolve(null)
      return
    }

    val detail = consumeLastRustError()?.let { ": $it" } ?: ""
    promise.reject(
      "E_GIT_\${op.uppercase()}",
      "Rust git \$op failed with code=\$code\$detail"
    )
  }

  private fun settlePayload(op: String, payload: String?, promise: Promise) {
    if (payload == null) {
      promise.reject("E_GIT_\${op.uppercase()}", "Rust git \$op failed")
      return
    }
    promise.resolve(payload)
  }

  private fun consumeLastRustError(): String? {
    val raw = git_last_error_message() ?: return null
    return try {
      val parsed = JSONObject("{\\"value\\":$raw}").opt("value")
      when (parsed) {
        null -> null
        JSONObject.NULL -> null
        else -> parsed.toString().takeIf { it.isNotBlank() }
      }
    } catch (_: Exception) {
      raw.takeIf { it.isNotBlank() }
    }
  }
}
`;

const PACKAGE_SOURCE = `package com.clikethis123.keeper

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KeeperGitBridgePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(KeeperGitBridgeModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
`;

function addImport(contents) {
	return contents.includes("import com.clikethis123.keeper.KeeperGitBridgePackage")
		? contents
		: contents.replace(
				/(import expo\.modules\.ReactNativeHostWrapper\s*)/,
				"import com.clikethis123.keeper.KeeperGitBridgePackage\n$1",
			);
}

function addPackageRegistration(contents) {
	if (contents.includes("add(KeeperGitBridgePackage())")) {
		return contents;
	}

	return contents.replace(
		/(PackageList\(this\)\.packages\.apply\s*\{\s*)(\/\/ Packages that cannot be autolinked yet can be added manually here, for example:\s*\n)/m,
		"$1add(KeeperGitBridgePackage())\n              $2",
	);
}

async function writeAndroidBridgeFiles(projectRoot) {
	const javaRoot = path.join(
		projectRoot,
		"android",
		"app",
		"src",
		"main",
		"java",
		BRIDGE_PACKAGE_PATH,
	);
	await fs.mkdir(javaRoot, { recursive: true });
	await fs.writeFile(
		path.join(javaRoot, "KeeperGitBridgeModule.kt"),
		MODULE_SOURCE,
		"utf8",
	);
	await fs.writeFile(
		path.join(javaRoot, "KeeperGitBridgePackage.kt"),
		PACKAGE_SOURCE,
		"utf8",
	);
}

const withKeeperGitBridgeAndroidFiles = (config) =>
	withDangerousMod(config, [
		"android",
		async (cfg) => {
			await writeAndroidBridgeFiles(cfg.modRequest.projectRoot);
			return cfg;
		},
	]);

const withKeeperGitBridgeMainApplication = (config) =>
	withMainApplication(config, (cfg) => {
		cfg.modResults.contents = addPackageRegistration(
			addImport(cfg.modResults.contents),
		);
		return cfg;
	});

module.exports = function withKeeperGitBridge(config) {
	let nextConfig = withKeeperGitBridgeAndroidFiles(config);
	nextConfig = withKeeperGitBridgeMainApplication(nextConfig);
	return nextConfig;
};
