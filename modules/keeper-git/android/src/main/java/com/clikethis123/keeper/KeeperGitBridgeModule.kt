package com.clikethis123.keeper

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

class KeeperGitBridgeModule : Module() {
  companion object {
    init {
      System.loadLibrary("git_core")
    }
  }

  private external fun clone_git(url: String, path: String): Int
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

  override fun definition() = ModuleDefinition {
    Name("KeeperGitBridge")

    AsyncFunction("clone") { url: String, path: String, promise: Promise ->
      settleCode("clone", clone_git(url, path), promise)
    }

    AsyncFunction("fetch") { repoPath: String, promise: Promise ->
      settleCode("fetch", git_fetch(repoPath), promise)
    }

    AsyncFunction("checkout") { repoPath: String, reference: String, options: Map<String, Any?>?, promise: Promise ->
      val force = if (options?.get("force") == true) 1 else 0
      val noUpdateHead = if (options?.get("noUpdateHead") == true) 1 else 0
      settleCode(
        "checkout",
        git_checkout_ex(repoPath, reference, force, noUpdateHead),
        promise
      )
    }

    AsyncFunction("currentBranch") { repoPath: String, promise: Promise ->
      settlePayload("current_branch", git_current_branch_json(repoPath), promise)
    }

    AsyncFunction("listBranches") { repoPath: String, remote: String?, promise: Promise ->
      settlePayload("list_branches", git_list_branches_json(repoPath, remote), promise)
    }

    AsyncFunction("merge") { repoPath: String, options: Map<String, Any?>, promise: Promise ->
      val ours = options["ours"] as? String
      val theirs = options["theirs"] as? String
      if (ours == null || theirs == null) {
        promise.reject("E_GIT_MERGE", "Rust git merge requires 'ours' and 'theirs'", null)
        return@AsyncFunction
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

    AsyncFunction("commit") { repoPath: String, message: String, promise: Promise ->
      settleCode("commit", git_commit(repoPath, message), promise)
    }

    AsyncFunction("push") { repoPath: String, promise: Promise ->
      settleCode("push", git_push(repoPath), promise)
    }

    AsyncFunction("status") { repoPath: String, promise: Promise ->
      settlePayload("status", git_status_json(repoPath), promise)
    }

    AsyncFunction("resolveHeadOid") { repoPath: String, promise: Promise ->
      settlePayload("head_oid", git_head_oid_json(repoPath), promise)
    }

    AsyncFunction("changedMarkdownPaths") { repoPath: String, fromOid: String, toOid: String, promise: Promise ->
      settlePayload(
        "changed_markdown_paths",
        git_changed_markdown_paths_json(repoPath, fromOid, toOid),
        promise
      )
    }
  }

  private fun settleCode(op: String, code: Int, promise: Promise) {
    if (code == 0) {
      promise.resolve(null)
      return
    }

    val detail = consumeLastRustError()?.let { ": $it" } ?: ""
    promise.reject(
      "E_GIT_${op.uppercase()}",
      "Rust git $op failed with code=$code$detail",
      null
    )
  }

  private fun settlePayload(op: String, payload: String?, promise: Promise) {
    if (payload == null) {
      promise.reject("E_GIT_${op.uppercase()}", "Rust git $op failed", null)
      return
    }
    promise.resolve(parseJsonValue(payload))
  }

  private fun consumeLastRustError(): String? {
    val raw = git_last_error_message() ?: return null
    return try {
      val parsed = JSONObject("{\"value\":$raw}").opt("value")
      when (parsed) {
        null -> null
        JSONObject.NULL -> null
        else -> parsed.toString().takeIf { it.isNotBlank() }
      }
    } catch (_: Exception) {
      raw.takeIf { it.isNotBlank() }
    }
  }

  private fun parseJsonValue(payload: String): Any? {
    return convertJsonValue(JSONTokener(payload).nextValue())
  }

  private fun convertJsonValue(value: Any?): Any? {
    return when (value) {
      null, JSONObject.NULL -> null
      is JSONObject -> buildMap {
        val keys = value.keys()
        while (keys.hasNext()) {
          val key = keys.next()
          put(key, convertJsonValue(value.opt(key)))
        }
      }
      is JSONArray -> buildList {
        for (index in 0 until value.length()) {
          add(convertJsonValue(value.opt(index)))
        }
      }
      else -> value
    }
  }
}
