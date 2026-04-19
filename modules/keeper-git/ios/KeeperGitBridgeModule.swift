import ExpoModulesCore
import Foundation

public final class KeeperGitBridgeModule: Module {
  @_silgen_name("clone_git")
  private func clone_git(_ url: UnsafePointer<CChar>, _ path: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_fetch")
  private func git_fetch(_ repoPath: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_checkout_ex")
  private func git_checkout_ex(
    _ repoPath: UnsafePointer<CChar>,
    _ reference: UnsafePointer<CChar>,
    _ force: Int32,
    _ noUpdateHead: Int32
  ) -> Int32

  @_silgen_name("git_current_branch_json")
  private func git_current_branch_json(_ repoPath: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_list_branches_json")
  private func git_list_branches_json(
    _ repoPath: UnsafePointer<CChar>,
    _ remote: UnsafePointer<CChar>?
  ) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_merge_json")
  private func git_merge_json(
    _ repoPath: UnsafePointer<CChar>,
    _ optionsJson: UnsafePointer<CChar>
  ) -> Int32

  @_silgen_name("git_commit")
  private func git_commit(_ repoPath: UnsafePointer<CChar>, _ message: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_push")
  private func git_push(_ repoPath: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_status_json")
  private func git_status_json(_ repoPath: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_head_oid_json")
  private func git_head_oid_json(_ repoPath: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?


  @_silgen_name("git_changed_markdown_paths_json")
  private func git_changed_markdown_paths_json(
    _ repoPath: UnsafePointer<CChar>,
    _ fromOid: UnsafePointer<CChar>,
    _ toOid: UnsafePointer<CChar>
  ) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_changed_paths_json")
  private func git_changed_paths_json(
    _ repoPath: UnsafePointer<CChar>,
    _ fromOid: UnsafePointer<CChar>,
    _ toOid: UnsafePointer<CChar>
  ) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_last_error_message")
  private func git_last_error_message() -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_string_free")
  private func git_string_free(_ ptr: UnsafeMutablePointer<CChar>?)

  public func definition() -> ModuleDefinition {
    Name("KeeperGitBridge")

    AsyncFunction("clone") { (url: String, path: String, promise: Promise) in
      let code = url.withCString { urlPtr in
        path.withCString { pathPtr in
          clone_git(urlPtr, pathPtr)
        }
      }
      settle(code: code, op: "clone", promise: promise)
    }

    AsyncFunction("fetch") { (repoPath: String, promise: Promise) in
      let code = repoPath.withCString { git_fetch($0) }
      settle(code: code, op: "fetch", promise: promise)
    }

    AsyncFunction("checkout") { (repoPath: String, reference: String, options: [String: Any]?, promise: Promise) in
      let force = (options?["force"] as? Bool) == true ? Int32(1) : Int32(0)
      let noUpdateHead = (options?["noUpdateHead"] as? Bool) == true ? Int32(1) : Int32(0)
      let code = repoPath.withCString { repoPtr in
        reference.withCString { refPtr in
          git_checkout_ex(repoPtr, refPtr, force, noUpdateHead)
        }
      }
      settle(code: code, op: "checkout", promise: promise)
    }

    AsyncFunction("currentBranch") { (repoPath: String, promise: Promise) in
      let payloadPtr = repoPath.withCString { git_current_branch_json($0) }
      decodeJsonPayload(payloadPtr: payloadPtr, op: "current_branch", promise: promise)
    }

    AsyncFunction("listBranches") { (repoPath: String, remote: String?, promise: Promise) in
      let payloadPtr: UnsafeMutablePointer<CChar>? = repoPath.withCString { repoPtr in
        if let remote = remote {
          return remote.withCString { remotePtr in
            git_list_branches_json(repoPtr, remotePtr)
          }
        }
        return git_list_branches_json(repoPtr, nil)
      }
      decodeJsonPayload(payloadPtr: payloadPtr, op: "list_branches", promise: promise)
    }

    AsyncFunction("merge") { (repoPath: String, options: [String: Any], promise: Promise) in
      guard let ours = options["ours"] as? String,
            let theirs = options["theirs"] as? String else {
        promise.reject("E_GIT_MERGE", "Rust git merge requires 'ours' and 'theirs'")
        return
      }

      var payload: [String: Any] = [
        "ours": ours,
        "theirs": theirs
      ]
      if let fastForwardOnly = options["fastForwardOnly"] as? Bool {
        payload["fast_forward_only"] = fastForwardOnly
      }
      if let message = options["message"] as? String {
        payload["message"] = message
      }
      if let author = options["author"] as? [String: Any] {
        payload["author"] = [
          "name": author["name"] as Any,
          "email": author["email"] as Any
        ]
      }

      guard JSONSerialization.isValidJSONObject(payload),
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: data, encoding: .utf8) else {
        promise.reject("E_GIT_MERGE", "Rust git merge received invalid options payload")
        return
      }

      let code = repoPath.withCString { repoPtr in
        json.withCString { jsonPtr in
          git_merge_json(repoPtr, jsonPtr)
        }
      }
      settle(code: code, op: "merge", promise: promise)
    }

    AsyncFunction("commit") { (repoPath: String, message: String, promise: Promise) in
      let code = repoPath.withCString { repoPtr in
        message.withCString { msgPtr in
          git_commit(repoPtr, msgPtr)
        }
      }
      settle(code: code, op: "commit", promise: promise)
    }

    AsyncFunction("push") { (repoPath: String, promise: Promise) in
      let code = repoPath.withCString { git_push($0) }
      settle(code: code, op: "push", promise: promise)
    }

    AsyncFunction("status") { (repoPath: String, promise: Promise) in
      let payloadPtr = repoPath.withCString { git_status_json($0) }
      decodeJsonPayload(payloadPtr: payloadPtr, op: "status", promise: promise)
    }

    AsyncFunction("resolveHeadOid") { (repoPath: String, promise: Promise) in
      let payloadPtr = repoPath.withCString { git_head_oid_json($0) }
      decodeJsonPayload(payloadPtr: payloadPtr, op: "head_oid", promise: promise)
    }


    AsyncFunction("changedMarkdownPaths") { (repoPath: String, fromOid: String, toOid: String, promise: Promise) in
      let payloadPtr = repoPath.withCString { repoPtr in
        fromOid.withCString { fromOidPtr in
          toOid.withCString { toOidPtr in
            git_changed_markdown_paths_json(repoPtr, fromOidPtr, toOidPtr)
          }
        }
      }
      decodeJsonPayload(payloadPtr: payloadPtr, op: "changed_markdown_paths", promise: promise)
    }

    AsyncFunction("changedPaths") { (repoPath: String, fromOid: String, toOid: String, promise: Promise) in
      let payloadPtr = repoPath.withCString { repoPtr in
        fromOid.withCString { fromOidPtr in
          toOid.withCString { toOidPtr in
            git_changed_paths_json(repoPtr, fromOidPtr, toOidPtr)
          }
        }
      }
      decodeJsonPayload(payloadPtr: payloadPtr, op: "changed_paths", promise: promise)
    }
  }

  private func decodeJsonPayload(payloadPtr: UnsafeMutablePointer<CChar>?, op: String, promise: Promise) {
    guard let payloadPtr else {
      promise.reject("E_GIT_\(op.uppercased())", "Rust git \(op) failed")
      return
    }

    let payload = String(cString: payloadPtr)
    git_string_free(payloadPtr)

    guard let data = payload.data(using: .utf8),
          let decoded = try? JSONSerialization.jsonObject(with: data) else {
      promise.reject("E_GIT_\(op.uppercased())", "Rust git \(op) returned invalid JSON")
      return
    }

    promise.resolve(decoded)
  }

  private func settle(code: Int32, op: String, promise: Promise) {
    if code == 0 {
      promise.resolve(nil)
    } else {
      let detail = consumeLastRustError().map { ": \($0)" } ?? ""
      promise.reject("E_GIT_\(op.uppercased())", "Rust git \(op) failed with code=\(code)\(detail)")
    }
  }

  private func consumeLastRustError() -> String? {
    guard let errorPtr = git_last_error_message() else {
      return nil
    }
    let message = String(cString: errorPtr)
    git_string_free(errorPtr)
    return message.isEmpty ? nil : message
  }
}
