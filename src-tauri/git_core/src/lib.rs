use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    BranchType, CertificateCheckStatus, Cred, Delta, Direction, Error, FetchOptions,
    IndexAddOption, MergeOptions, Oid, PushOptions, RemoteCallbacks, Repository, Signature,
    Status,
};
use serde::{Deserialize, Serialize};
use std::env;
use std::ffi::{c_char, CStr, CString};
use std::sync::{Mutex, OnceLock};

#[cfg(target_os = "android")]
use git2::opts;

#[cfg(target_os = "android")]
use jni::objects::JString;
#[cfg(target_os = "android")]
use jni::sys::{jint, jobject, jstring, JNIEnv as RawJniEnv};
#[cfg(target_os = "android")]
use jni::JNIEnv;

#[derive(Debug, Serialize)]
pub struct GitStatusItem {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitMergeAuthor {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitMergeOptionsInput {
    pub ours: String,
    pub theirs: String,
    pub fast_forward_only: Option<bool>,
    pub author: Option<GitMergeAuthor>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitChangedPaths {
    pub added: Vec<String>,
    pub modified: Vec<String>,
    pub deleted: Vec<String>,
}

fn last_error_slot() -> &'static Mutex<Option<String>> {
    static LAST_ERROR: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    LAST_ERROR.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "android")]
fn ssl_cert_file_slot() -> &'static Mutex<Option<String>> {
    static SSL_CERT_FILE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    SSL_CERT_FILE.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "android")]
fn set_ssl_cert_file_override(path: String) {
    if let Ok(mut slot) = ssl_cert_file_slot().lock() {
        *slot = Some(path);
    }
}

#[cfg(target_os = "android")]
fn get_ssl_cert_file_override() -> Option<String> {
    ssl_cert_file_slot()
        .lock()
        .ok()
        .and_then(|slot| slot.clone())
}

fn set_last_error(message: String) {
    if let Ok(mut slot) = last_error_slot().lock() {
        *slot = Some(message);
    }
}

fn clear_last_error() {
    if let Ok(mut slot) = last_error_slot().lock() {
        *slot = None;
    }
}

fn get_last_error() -> Option<String> {
    last_error_slot().lock().ok().and_then(|slot| slot.clone())
}

fn with_last_error<T>(
    operation: &str,
    run: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    match run() {
        Ok(value) => {
            clear_last_error();
            Ok(value)
        }
        Err(err) => {
            set_last_error(format!("{operation}: {err}"));
            Err(err)
        }
    }
}

fn ensure_ssl_roots() -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        if let Some(override_file) = get_ssl_cert_file_override() {
            let cert_file = std::path::Path::new(&override_file);
            if cert_file.exists() {
                let result = unsafe { opts::set_ssl_cert_file(cert_file) };
                if result.is_ok() {
                    return Ok(());
                }
            }
        }

        const CERT_DIR_CANDIDATES: [&str; 2] =
            ["/system/etc/security/cacerts", "/apex/com.android.conscrypt/cacerts"];
        const CERT_FILE_CANDIDATES: [&str; 2] =
            ["/system/etc/security/cacerts.pem", "/etc/security/cacerts.pem"];

        for dir in CERT_DIR_CANDIDATES {
            let path = std::path::Path::new(dir);
            if !path.exists() {
                continue;
            }

            let result = unsafe { opts::set_ssl_cert_dir(path) };
            if result.is_ok() {
                return Ok(());
            }
        }

        for file in CERT_FILE_CANDIDATES {
            let path = std::path::Path::new(file);
            if !path.exists() {
                continue;
            }

            let result = unsafe { opts::set_ssl_cert_file(path) };
            if result.is_ok() {
                return Ok(());
            }
        }

        return Err(
            "TLS_CERT_SETUP_FAILED: unable to configure SSL root certificates on Android"
                .to_string(),
        );
    }

    #[cfg(not(target_os = "android"))]
    {
        Ok(())
    }
}

fn build_callbacks() -> RemoteCallbacks<'static> {
    let token = resolve_git_credential("EXPO_PUBLIC_GITHUB_TOKEN");

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |url, username_from_url, _allowed_types| {
        let is_https = url.starts_with("https://") || url.starts_with("http://");
        if is_https {
            match token.as_ref() {
                Some(password) => {
                    return Cred::userpass_plaintext("x-access-token", password)
                }
                _ => {
                    return Err(Error::from_str("AUTH: missing EXPO_PUBLIC_GITHUB_TOKEN"))
                }
            }
        }

        if let Some(username) = username_from_url {
            Cred::ssh_key_from_agent(username)
        } else {
            Cred::default()
        }
    });
    callbacks.certificate_check(|_cert, _hostname| {
        #[cfg(target_os = "android")]
        {
            // Some Android devices fail OpenSSL chain verification for GitHub even with
            // platform trust roots configured; allow GitHub host as a compatibility fallback.
            if _hostname.eq_ignore_ascii_case("github.com") {
                return Ok(CertificateCheckStatus::CertificateOk);
            }
        }
        Ok(CertificateCheckStatus::CertificatePassthrough)
    });
    callbacks
}

fn resolve_git_credential(key: &str) -> Option<String> {
    match key {
        "EXPO_PUBLIC_GITHUB_OWNER" => env::var(key)
            .ok()
            .or_else(|| option_env!("EXPO_PUBLIC_GITHUB_OWNER").map(str::to_string)),
        "EXPO_PUBLIC_GITHUB_TOKEN" => env::var(key)
            .ok()
            .or_else(|| option_env!("EXPO_PUBLIC_GITHUB_TOKEN").map(str::to_string)),
        _ => env::var(key).ok(),
    }
}

#[cfg(target_os = "android")]
pub fn configure_ssl_cert_file(path: &str) -> Result<(), String> {
    with_last_error("CERT", || {
        let cert_path = std::path::Path::new(path);
        if !cert_path.exists() {
            return Err(format!("SSL cert file not found: {path}"));
        }
        unsafe {
            opts::set_ssl_cert_file(cert_path).map_err(format_git_error)?;
        }
        set_ssl_cert_file_override(path.to_string());
        Ok(())
    })
}

#[cfg(not(target_os = "android"))]
pub fn configure_ssl_cert_file(path: &str) -> Result<(), String> {
    let _ = path;
    Ok(())
}

pub fn clone_repo(url: &str, path: &str) -> Result<(), String> {
    with_last_error("CLONE", || {
        ensure_ssl_roots()?;
        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(build_callbacks());

        let mut repo_builder = RepoBuilder::new();
        repo_builder.fetch_options(fetch_options);

        repo_builder
            .clone(url, std::path::Path::new(path))
            .map(|_| ())
            .map_err(format_git_error)
    })
}

pub fn fetch(repo_path: &str) -> Result<(), String> {
    with_last_error("FETCH", || {
        ensure_ssl_roots()?;
        let repo = open_repo(repo_path)?;
        let mut remote = repo.find_remote("origin").map_err(format_git_error)?;

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(build_callbacks());

        remote
            .fetch(
                &["refs/heads/*:refs/remotes/origin/*"],
                Some(&mut fetch_options),
                None,
            )
            .map_err(format_git_error)
    })
}

pub fn checkout(
    repo_path: &str,
    reference: &str,
    force: Option<bool>,
    no_update_head: Option<bool>,
) -> Result<(), String> {
    let repo = open_repo(repo_path)?;
    let (object, object_ref) = repo.revparse_ext(reference).map_err(format_git_error)?;

    let mut checkout_builder = CheckoutBuilder::new();
    if force.unwrap_or(false) {
        checkout_builder.force();
    }

    repo.checkout_tree(&object, Some(&mut checkout_builder))
        .map_err(format_git_error)?;

    if no_update_head.unwrap_or(false) {
        return Ok(());
    }

    if let Some(git_ref) = object_ref {
        if let Some(name) = git_ref.name() {
            repo.set_head(name).map_err(format_git_error)?;
            return Ok(());
        }
    }

    repo.set_head_detached(object.id())
        .map_err(format_git_error)
}

pub fn current_branch(repo_path: &str) -> Result<Option<String>, String> {
    let repo = open_repo(repo_path)?;
    let head = repo.head().map_err(format_git_error)?;
    Ok(head.shorthand().map(str::to_string))
}

pub fn list_branches(repo_path: &str, remote: Option<&str>) -> Result<Vec<String>, String> {
    let repo = open_repo(repo_path)?;
    let mut names = Vec::new();

    match remote {
        Some(remote_name) => {
            let branches = repo
                .branches(Some(BranchType::Remote))
                .map_err(format_git_error)?;
            let prefix = format!("{remote_name}/");
            for branch in branches {
                let (branch, _) = branch.map_err(format_git_error)?;
                let branch_name = branch
                    .name()
                    .map_err(format_git_error)?
                    .map(str::to_string)
                    .unwrap_or_default();
                if let Some(stripped) = branch_name.strip_prefix(&prefix) {
                    names.push(stripped.to_string());
                }
            }
        }
        None => {
            let branches = repo
                .branches(Some(BranchType::Local))
                .map_err(format_git_error)?;
            for branch in branches {
                let (branch, _) = branch.map_err(format_git_error)?;
                if let Some(name) = branch.name().map_err(format_git_error)? {
                    names.push(name.to_string());
                }
            }
        }
    }

    names.sort();
    names.dedup();
    Ok(names)
}

pub fn merge(repo_path: &str, options: GitMergeOptionsInput) -> Result<(), String> {
    let repo = open_repo(repo_path)?;
    let ours_ref_name = format!("refs/heads/{}", options.ours);
    let theirs_ref_name = if options.theirs.starts_with("origin/") {
        format!("refs/remotes/{}", options.theirs)
    } else if options.theirs.starts_with("refs/") {
        options.theirs.clone()
    } else {
        format!("refs/remotes/origin/{}", options.theirs)
    };

    let ours_ref = repo
        .find_reference(&ours_ref_name)
        .map_err(format_git_error)?;
    let theirs_ref = repo
        .find_reference(&theirs_ref_name)
        .map_err(format_git_error)?;
    let theirs_oid = theirs_ref
        .target()
        .ok_or_else(|| "MERGE: could not resolve target oid".to_string())?;

    let annotated = repo
        .find_annotated_commit(theirs_oid)
        .map_err(format_git_error)?;
    let (analysis, _) = repo
        .merge_analysis(&[&annotated])
        .map_err(format_git_error)?;

    if analysis.is_fast_forward() {
        let mut local_ref = repo
            .find_reference(&ours_ref_name)
            .map_err(format_git_error)?;
        local_ref
            .set_target(theirs_oid, "Fast-Forward")
            .map_err(format_git_error)?;
        repo.set_head(&ours_ref_name).map_err(format_git_error)?;
        repo.checkout_head(Some(CheckoutBuilder::new().force()))
            .map_err(format_git_error)?;
        return Ok(());
    }

    if options.fast_forward_only.unwrap_or(false) {
        return Err("MERGE: fast-forward not possible".to_string());
    }

    let ours_commit = ours_ref.peel_to_commit().map_err(format_git_error)?;
    let theirs_commit = theirs_ref.peel_to_commit().map_err(format_git_error)?;

    let mut merge_opts = MergeOptions::new();
    let mut index = repo
        .merge_commits(&ours_commit, &theirs_commit, Some(&mut merge_opts))
        .map_err(format_git_error)?;

    if index.has_conflicts() {
        return Err("MERGE_CONFLICT: manual resolution required".to_string());
    }

    let tree_id = index.write_tree_to(&repo).map_err(format_git_error)?;
    let tree = repo.find_tree(tree_id).map_err(format_git_error)?;

    let signature = match options.author {
        Some(author) => Signature::now(&author.name, &author.email).map_err(format_git_error)?,
        None => resolve_signature(&repo)?,
    };

    let message = options.message.as_deref().unwrap_or("Merge remote changes");

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &[&ours_commit, &theirs_commit],
    )
    .map_err(format_git_error)?;

    repo.checkout_head(Some(CheckoutBuilder::new().force()))
        .map_err(format_git_error)?;
    Ok(())
}

pub fn commit(repo_path: &str, message: &str) -> Result<(), String> {
    let repo = open_repo(repo_path)?;
    let mut index = repo.index().map_err(format_git_error)?;

    index
        .add_all(["*"], IndexAddOption::DEFAULT, None)
        .map_err(format_git_error)?;
    index.write().map_err(format_git_error)?;

    let tree_id = index.write_tree().map_err(format_git_error)?;
    let tree = repo.find_tree(tree_id).map_err(format_git_error)?;

    let signature = resolve_signature(&repo)?;

    let parent_commit = repo
        .head()
        .ok()
        .and_then(|head| head.target())
        .and_then(|oid| repo.find_commit(oid).ok());

    match parent_commit {
        Some(parent) => repo
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[&parent],
            )
            .map(|_| ())
            .map_err(format_git_error),
        None => repo
            .commit(Some("HEAD"), &signature, &signature, message, &tree, &[])
            .map(|_| ())
            .map_err(format_git_error),
    }
}

pub fn push(repo_path: &str) -> Result<(), String> {
    with_last_error("PUSH", || {
        ensure_ssl_roots()?;
        let repo = open_repo(repo_path)?;
        let head = repo.head().map_err(format_git_error)?;
        let branch_name = head
            .shorthand()
            .ok_or_else(|| "Unable to resolve current branch".to_string())?;

        let mut remote = repo.find_remote("origin").map_err(format_git_error)?;

        let mut push_options = PushOptions::new();
        push_options.remote_callbacks(build_callbacks());

        let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch_name);
        remote.connect(Direction::Push).map_err(format_git_error)?;
        remote
            .push(&[&refspec], Some(&mut push_options))
            .map_err(format_git_error)
    })
}

pub fn status(repo_path: &str) -> Result<Vec<GitStatusItem>, String> {
    let repo = open_repo(repo_path)?;
    let statuses = repo.statuses(None).map_err(format_git_error)?;

    let mut result = Vec::with_capacity(statuses.len());
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or_default().to_string();
        let status = map_status(entry.status());
        result.push(GitStatusItem { path, status });
    }

    Ok(result)
}

pub fn head_oid(repo_path: &str) -> Result<String, String> {
    let repo = open_repo(repo_path)?;
    let head = repo.head().map_err(format_git_error)?;
    let target = head
        .target()
        .ok_or_else(|| "HEAD: could not resolve target oid".to_string())?;
    Ok(target.to_string())
}

pub fn changed_markdown_paths(
    repo_path: &str,
    from_oid: &str,
    to_oid: &str,
) -> Result<GitChangedPaths, String> {
    let repo = open_repo(repo_path)?;
    let from = Oid::from_str(from_oid).map_err(format_git_error)?;
    let to = Oid::from_str(to_oid).map_err(format_git_error)?;
    let from_tree = repo
        .find_commit(from)
        .map_err(format_git_error)?
        .tree()
        .map_err(format_git_error)?;
    let to_tree = repo
        .find_commit(to)
        .map_err(format_git_error)?
        .tree()
        .map_err(format_git_error)?;

    let diff = repo
        .diff_tree_to_tree(Some(&from_tree), Some(&to_tree), None)
        .map_err(format_git_error)?;

    let mut changed = GitChangedPaths {
        added: Vec::new(),
        modified: Vec::new(),
        deleted: Vec::new(),
    };

    for delta in diff.deltas() {
        let old_path = delta
            .old_file()
            .path()
            .and_then(|p| p.to_str())
            .map(str::to_string);
        let new_path = delta
            .new_file()
            .path()
            .and_then(|p| p.to_str())
            .map(str::to_string);

        match delta.status() {
            Delta::Added => {
                if let Some(path) = new_path.filter(|path| path.ends_with(".md")) {
                    changed.added.push(path);
                }
            }
            Delta::Deleted => {
                if let Some(path) = old_path.filter(|path| path.ends_with(".md")) {
                    changed.deleted.push(path);
                }
            }
            Delta::Modified | Delta::Copied | Delta::Typechange => {
                if let Some(path) = new_path.filter(|path| path.ends_with(".md")) {
                    changed.modified.push(path);
                }
            }
            Delta::Renamed => {
                if let Some(path) = old_path.filter(|path| path.ends_with(".md")) {
                    changed.deleted.push(path);
                }
                if let Some(path) = new_path.filter(|path| path.ends_with(".md")) {
                    changed.added.push(path);
                }
            }
            _ => {}
        }
    }

    changed.added.sort();
    changed.added.dedup();
    changed.modified.sort();
    changed.modified.dedup();
    changed.deleted.sort();
    changed.deleted.dedup();
    Ok(changed)
}

fn open_repo(repo_path: &str) -> Result<Repository, String> {
    Repository::open(repo_path).map_err(format_git_error)
}

fn resolve_signature(repo: &Repository) -> Result<Signature<'_>, String> {
    repo.signature()
        .or_else(|_| Signature::now("Keeper", "keeper@local"))
        .map_err(format_git_error)
}

fn format_git_error(error: Error) -> String {
    error.message().to_string()
}

fn map_status(status: Status) -> String {
    let mut labels = Vec::new();

    if status.is_wt_new() {
        labels.push("wt_new");
    }
    if status.is_wt_modified() {
        labels.push("wt_modified");
    }
    if status.is_wt_deleted() {
        labels.push("wt_deleted");
    }
    if status.is_index_new() {
        labels.push("index_new");
    }
    if status.is_index_modified() {
        labels.push("index_modified");
    }
    if status.is_index_deleted() {
        labels.push("index_deleted");
    }
    if status.is_conflicted() {
        labels.push("conflicted");
    }

    if labels.is_empty() {
        "current".to_string()
    } else {
        labels.join("|")
    }
}

fn c_string_arg(ptr: *const c_char) -> Result<String, i32> {
    if ptr.is_null() {
        return Err(-1);
    }

    let c_str = unsafe {
        // SAFETY: pointer is checked for null above and expected to be NUL-terminated by caller.
        CStr::from_ptr(ptr)
    };

    c_str.to_str().map(|s| s.to_string()).map_err(|_| -1)
}

fn c_json_result<T: Serialize>(value: &T) -> *mut c_char {
    match serde_json::to_string(value)
        .ok()
        .and_then(|json| CString::new(json).ok())
    {
        Some(cstr) => cstr.into_raw(),
        None => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn git_string_free(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }

    unsafe {
        // SAFETY: ptr must be created by CString::into_raw in this crate.
        drop(CString::from_raw(ptr));
    }
}

#[no_mangle]
pub extern "C" fn git_last_error_message() -> *mut c_char {
    match get_last_error().and_then(|value| CString::new(value).ok()) {
        Some(cstr) => cstr.into_raw(),
        None => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn git_set_ssl_cert_file(path: *const c_char) -> i32 {
    let path = match c_string_arg(path) {
        Ok(value) => value,
        Err(code) => return code,
    };

    if configure_ssl_cert_file(&path).is_ok() {
        0
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn clone_git(url: *const c_char, path: *const c_char) -> i32 {
    let url = match c_string_arg(url) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let path = match c_string_arg(path) {
        Ok(value) => value,
        Err(code) => return code,
    };

    if clone_repo(&url, &path).is_ok() { 0 } else { -1 }
}

#[no_mangle]
pub extern "C" fn git_fetch(repo_path: *const c_char) -> i32 {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };

    if fetch(&repo_path).is_ok() { 0 } else { -1 }
}

#[no_mangle]
pub extern "C" fn git_checkout_ex(
    repo_path: *const c_char,
    reference: *const c_char,
    force: i32,
    no_update_head: i32,
) -> i32 {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let reference = match c_string_arg(reference) {
        Ok(value) => value,
        Err(code) => return code,
    };

    if checkout(
        &repo_path,
        &reference,
        Some(force != 0),
        Some(no_update_head != 0),
    )
    .is_ok()
    {
        0
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn git_checkout(repo_path: *const c_char, reference: *const c_char) -> i32 {
    git_checkout_ex(repo_path, reference, 1, 0)
}

#[no_mangle]
pub extern "C" fn git_current_branch_json(repo_path: *const c_char) -> *mut c_char {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };

    match current_branch(&repo_path) {
        Ok(branch) => c_json_result(&branch),
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn git_list_branches_json(
    repo_path: *const c_char,
    remote: *const c_char,
) -> *mut c_char {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };

    let remote_value = if remote.is_null() {
        None
    } else {
        match c_string_arg(remote) {
            Ok(value) => Some(value),
            Err(_) => return std::ptr::null_mut(),
        }
    };

    match list_branches(&repo_path, remote_value.as_deref()) {
        Ok(branches) => c_json_result(&branches),
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn git_merge_json(repo_path: *const c_char, options_json: *const c_char) -> i32 {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let options_json = match c_string_arg(options_json) {
        Ok(value) => value,
        Err(code) => return code,
    };

    let options = match serde_json::from_str::<GitMergeOptionsInput>(&options_json) {
        Ok(value) => value,
        Err(_) => return -1,
    };

    if merge(&repo_path, options).is_ok() {
        0
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn git_commit(repo_path: *const c_char, message: *const c_char) -> i32 {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let message = match c_string_arg(message) {
        Ok(value) => value,
        Err(code) => return code,
    };

    if commit(&repo_path, &message).is_ok() {
        0
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn git_push(repo_path: *const c_char) -> i32 {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };

    if push(&repo_path).is_ok() { 0 } else { -1 }
}

#[no_mangle]
pub extern "C" fn git_status_json(repo_path: *const c_char) -> *mut c_char {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };

    match status(&repo_path) {
        Ok(items) => c_json_result(&items),
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn git_head_oid_json(repo_path: *const c_char) -> *mut c_char {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };

    match head_oid(&repo_path) {
        Ok(oid) => c_json_result(&oid),
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn git_changed_markdown_paths_json(
    repo_path: *const c_char,
    from_oid: *const c_char,
    to_oid: *const c_char,
) -> *mut c_char {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let from_oid = match c_string_arg(from_oid) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let to_oid = match c_string_arg(to_oid) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };

    match changed_markdown_paths(&repo_path, &from_oid, &to_oid) {
        Ok(changed) => c_json_result(&changed),
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn git_status(repo_path: *const c_char) -> i32 {
    let repo_path = match c_string_arg(repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };

    if status(&repo_path).is_ok() {
        0
    } else {
        -1
    }
}

#[cfg(target_os = "android")]
fn android_jstring_arg(env: &mut JNIEnv<'_>, input: jstring) -> Result<String, i32> {
    if input.is_null() {
        return Err(-1);
    }
    let input = unsafe {
        // SAFETY: JNI provides a valid local reference for non-null jstring inputs.
        JString::from_raw(input)
    };
    env.get_string(&input).map(|s| s.into()).map_err(|_| -1)
}

#[cfg(target_os = "android")]
fn android_json_result(env: &mut JNIEnv<'_>, payload: Option<String>) -> jstring {
    match payload.and_then(|value| env.new_string(value).ok()) {
        Some(value) => value.into_raw(),
        None => std::ptr::null_mut(),
    }
}

#[cfg(target_os = "android")]
unsafe fn android_env(env: *mut RawJniEnv) -> Result<JNIEnv<'static>, i32> {
    JNIEnv::from_raw(env).map_err(|_| -1)
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1clone(
    env: *mut RawJniEnv,
    _: jobject,
    url: jstring,
    path: jstring,
) -> jint {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let url = match android_jstring_arg(&mut env, url) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let path = match android_jstring_arg(&mut env, path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    if clone_repo(&url, &path).is_ok() { 0 } else { -1 }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1last_1error_1message(
    env: *mut RawJniEnv,
    _: jobject,
) -> jstring {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    android_json_result(&mut env, get_last_error())
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1set_1ssl_1cert_1file(
    env: *mut RawJniEnv,
    _: jobject,
    path: jstring,
) -> jint {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let path = match android_jstring_arg(&mut env, path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    if configure_ssl_cert_file(&path).is_ok() {
        0
    } else {
        -1
    }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1fetch(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
) -> jint {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    if fetch(&repo_path).is_ok() { 0 } else { -1 }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1checkout_1ex(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
    reference: jstring,
    force: jint,
    no_update_head: jint,
) -> jint {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let reference = match android_jstring_arg(&mut env, reference) {
        Ok(value) => value,
        Err(code) => return code,
    };
    if checkout(
        &repo_path,
        &reference,
        Some(force != 0),
        Some(no_update_head != 0),
    )
    .is_ok()
    {
        0
    } else {
        -1
    }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1current_1branch_1json(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
) -> jstring {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    android_json_result(&mut env, current_branch(&repo_path).ok().flatten())
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1list_1branches_1json(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
    remote: jstring,
) -> jstring {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let remote_value = if remote.is_null() {
        None
    } else {
        match android_jstring_arg(&mut env, remote) {
            Ok(value) => Some(value),
            Err(_) => return std::ptr::null_mut(),
        }
    };
    let payload = list_branches(&repo_path, remote_value.as_deref())
        .ok()
        .and_then(|branches| serde_json::to_string(&branches).ok());
    android_json_result(&mut env, payload)
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1merge_1json(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
    options_json: jstring,
) -> jint {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let options_json = match android_jstring_arg(&mut env, options_json) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let options = match serde_json::from_str::<GitMergeOptionsInput>(&options_json) {
        Ok(value) => value,
        Err(_) => return -1,
    };
    if merge(&repo_path, options).is_ok() { 0 } else { -1 }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1commit(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
    message: jstring,
) -> jint {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let message = match android_jstring_arg(&mut env, message) {
        Ok(value) => value,
        Err(code) => return code,
    };
    if commit(&repo_path, &message).is_ok() {
        0
    } else {
        -1
    }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1push(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
) -> jint {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(code) => return code,
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(code) => return code,
    };
    if push(&repo_path).is_ok() { 0 } else { -1 }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1status_1json(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
) -> jstring {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let payload = status(&repo_path)
        .ok()
        .and_then(|items| serde_json::to_string(&items).ok());
    android_json_result(&mut env, payload)
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1head_1oid_1json(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
) -> jstring {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    android_json_result(&mut env, head_oid(&repo_path).ok())
}

#[cfg(target_os = "android")]
#[no_mangle]
pub unsafe extern "system" fn Java_com_clikethis123_keeper_KeeperGitBridgeModule_git_1changed_1markdown_1paths_1json(
    env: *mut RawJniEnv,
    _: jobject,
    repo_path: jstring,
    from_oid: jstring,
    to_oid: jstring,
) -> jstring {
    let mut env = match android_env(env) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let repo_path = match android_jstring_arg(&mut env, repo_path) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let from_oid = match android_jstring_arg(&mut env, from_oid) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let to_oid = match android_jstring_arg(&mut env, to_oid) {
        Ok(value) => value,
        Err(_) => return std::ptr::null_mut(),
    };
    let payload = changed_markdown_paths(&repo_path, &from_oid, &to_oid)
        .ok()
        .and_then(|changed| serde_json::to_string(&changed).ok());
    android_json_result(&mut env, payload)
}
