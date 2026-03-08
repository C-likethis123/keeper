import Foundation
import React

@objc(KeeperGitBridge)
class KeeperGitBridge: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  // Symbols are exported by libgit_core.
  @_silgen_name("clone_git")
  private func clone_git(_ url: UnsafePointer<CChar>, _ path: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_fetch")
  private func git_fetch(_ repoPath: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_checkout_ex")
  private func git_checkout_ex(_ repoPath: UnsafePointer<CChar>, _ reference: UnsafePointer<CChar>, _ force: Int32, _ noUpdateHead: Int32) -> Int32

  @_silgen_name("git_current_branch_json")
  private func git_current_branch_json(_ repoPath: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_list_branches_json")
  private func git_list_branches_json(_ repoPath: UnsafePointer<CChar>, _ remote: UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_merge_json")
  private func git_merge_json(_ repoPath: UnsafePointer<CChar>, _ optionsJson: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_commit")
  private func git_commit(_ repoPath: UnsafePointer<CChar>, _ message: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_push")
  private func git_push(_ repoPath: UnsafePointer<CChar>) -> Int32

  @_silgen_name("git_status_json")
  private func git_status_json(_ repoPath: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_head_oid_json")
  private func git_head_oid_json(_ repoPath: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_changed_markdown_paths_json")
  private func git_changed_markdown_paths_json(_ repoPath: UnsafePointer<CChar>, _ fromOid: UnsafePointer<CChar>, _ toOid: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_last_error_message")
  private func git_last_error_message() -> UnsafeMutablePointer<CChar>?

  @_silgen_name("git_string_free")
  private func git_string_free(_ ptr: UnsafeMutablePointer<CChar>?)

  @objc func clone(_ url: String, path: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let code = url.withCString { urlPtr in
      path.withCString { pathPtr in
        clone_git(urlPtr, pathPtr)
      }
    }
    settle(code: code, op: "clone", resolve: resolve, reject: reject)
  }

  @objc func fetch(_ repoPath: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let code = repoPath.withCString { git_fetch($0) }
    settle(code: code, op: "fetch", resolve: resolve, reject: reject)
  }

  @objc func checkout(_ repoPath: String, reference: String, options: [String: Any]?, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let force = (options?["force"] as? Bool) == true ? Int32(1) : Int32(0)
    let noUpdateHead = (options?["noUpdateHead"] as? Bool) == true ? Int32(1) : Int32(0)
    let code = repoPath.withCString { repoPtr in
      reference.withCString { refPtr in
        git_checkout_ex(repoPtr, refPtr, force, noUpdateHead)
      }
    }
    settle(code: code, op: "checkout", resolve: resolve, reject: reject)
  }

  @objc func currentBranch(_ repoPath: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let payloadPtr = repoPath.withCString { git_current_branch_json($0) }
    decodeJsonPayload(payloadPtr: payloadPtr, op: "current_branch", resolve: resolve, reject: reject)
  }

  @objc func listBranches(_ repoPath: String, remote: String?, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let payloadPtr: UnsafeMutablePointer<CChar>? = repoPath.withCString { repoPtr in
      if let remote = remote {
        return remote.withCString { remotePtr in
          git_list_branches_json(repoPtr, remotePtr)
        }
      }
      return git_list_branches_json(repoPtr, nil)
    }

    decodeJsonPayload(payloadPtr: payloadPtr, op: "list_branches", resolve: resolve, reject: reject)
  }

  @objc func merge(_ repoPath: String, options: [String: Any], resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard let ours = options["ours"] as? String,
          let theirs = options["theirs"] as? String
    else {
      reject("E_GIT_MERGE", "Rust git merge requires 'ours' and 'theirs'", nil)
      return
    }

    var payload: [String: Any] = [
      "ours": ours,
      "theirs": theirs,
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
        "email": author["email"] as Any,
      ]
    }

    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload),
          let json = String(data: data, encoding: .utf8)
    else {
      reject("E_GIT_MERGE", "Rust git merge received invalid options payload", nil)
      return
    }

    let code = repoPath.withCString { repoPtr in
      json.withCString { jsonPtr in
        git_merge_json(repoPtr, jsonPtr)
      }
    }
    settle(code: code, op: "merge", resolve: resolve, reject: reject)
  }

  @objc func commit(_ repoPath: String, message: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let code = repoPath.withCString { repoPtr in
      message.withCString { msgPtr in
        git_commit(repoPtr, msgPtr)
      }
    }
    settle(code: code, op: "commit", resolve: resolve, reject: reject)
  }

  @objc func push(_ repoPath: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let code = repoPath.withCString { git_push($0) }
    settle(code: code, op: "push", resolve: resolve, reject: reject)
  }

  @objc func status(_ repoPath: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let payloadPtr = repoPath.withCString { git_status_json($0) }
    decodeJsonPayload(payloadPtr: payloadPtr, op: "status", resolve: resolve, reject: reject)
  }

  @objc func resolveHeadOid(_ repoPath: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let payloadPtr = repoPath.withCString { git_head_oid_json($0) }
    decodeJsonPayload(payloadPtr: payloadPtr, op: "head_oid", resolve: resolve, reject: reject)
  }

  @objc func changedMarkdownPaths(_ repoPath: String, fromOid: String, toOid: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let payloadPtr = repoPath.withCString { repoPtr in
      fromOid.withCString { fromOidPtr in
        toOid.withCString { toOidPtr in
          git_changed_markdown_paths_json(repoPtr, fromOidPtr, toOidPtr)
        }
      }
    }
    decodeJsonPayload(payloadPtr: payloadPtr, op: "changed_markdown_paths", resolve: resolve, reject: reject)
  }

  private func decodeJsonPayload(payloadPtr: UnsafeMutablePointer<CChar>?, op: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    guard let payloadPtr else {
      reject("E_GIT_\(op.uppercased())", "Rust git \(op) failed", nil)
      return
    }

    let payload = String(cString: payloadPtr)
    git_string_free(payloadPtr)

    guard let data = payload.data(using: .utf8),
          let decoded = try? JSONSerialization.jsonObject(with: data)
    else {
      reject("E_GIT_\(op.uppercased())", "Rust git \(op) returned invalid JSON", nil)
      return
    }

    resolve(decoded)
  }

  private func settle(code: Int32, op: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    if code == 0 {
      resolve(nil)
    } else {
      let detail = consumeLastRustError().map { ": \($0)" } ?? ""
      reject("E_GIT_\(op.uppercased())", "Rust git \(op) failed with code=\(code)\(detail)", nil)
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
