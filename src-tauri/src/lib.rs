use git_core::{GitChangedPaths, GitMergeAuthor, GitMergeOptionsInput, GitStatusItem};
mod storage;

#[tauri::command]
fn git_clone_repo(url: String, path: String) -> Result<(), String> {
    git_core::clone_repo(&url, &path)
}

#[tauri::command]
fn git_fetch_repo(repo_path: String) -> Result<(), String> {
    git_core::fetch(&repo_path)
}

#[tauri::command]
fn git_checkout_repo(
    repo_path: String,
    reference: String,
    force: Option<bool>,
    no_update_head: Option<bool>,
) -> Result<(), String> {
    git_core::checkout(&repo_path, &reference, force, no_update_head)
}

#[tauri::command]
fn git_current_branch_repo(repo_path: String) -> Result<Option<String>, String> {
    git_core::current_branch(&repo_path)
}

#[tauri::command]
fn git_list_branches_repo(
    repo_path: String,
    remote: Option<String>,
) -> Result<Vec<String>, String> {
    git_core::list_branches(&repo_path, remote.as_deref())
}

#[tauri::command]
fn git_merge_repo(
    repo_path: String,
    ours: String,
    theirs: String,
    fast_forward_only: Option<bool>,
    author_name: Option<String>,
    author_email: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    let author = match (author_name, author_email) {
        (Some(name), Some(email)) => Some(GitMergeAuthor { name, email }),
        _ => None,
    };

    git_core::merge(
        &repo_path,
        GitMergeOptionsInput {
            ours,
            theirs,
            fast_forward_only,
            author,
            message,
        },
    )
}

#[tauri::command]
fn git_commit_repo(repo_path: String, message: String) -> Result<(), String> {
    git_core::commit(&repo_path, &message)
}

#[tauri::command]
fn git_push_repo(repo_path: String) -> Result<(), String> {
    git_core::push(&repo_path)
}

#[tauri::command]
fn git_status_repo(repo_path: String) -> Result<Vec<GitStatusItem>, String> {
    git_core::status(&repo_path)
}

#[tauri::command]
fn git_head_oid_repo(repo_path: String) -> Result<String, String> {
    git_core::head_oid(&repo_path)
}

#[tauri::command]
fn git_changed_markdown_paths_repo(
    repo_path: String,
    from_oid: String,
    to_oid: String,
) -> Result<GitChangedPaths, String> {
    git_core::changed_markdown_paths(&repo_path, &from_oid, &to_oid)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            git_clone_repo,
            git_fetch_repo,
            git_checkout_repo,
            git_current_branch_repo,
            git_list_branches_repo,
            git_merge_repo,
            git_commit_repo,
            git_push_repo,
            git_status_repo,
            git_head_oid_repo,
            git_changed_markdown_paths_repo,
            storage::storage_initialize,
            storage::read_note,
            storage::write_note,
            storage::delete_note,
            storage::list_note_files,
            storage::stat_note,
            storage::index_upsert,
            storage::index_delete,
            storage::index_list,
            storage::index_rebuild_from_disk,
            storage::notes_root_path_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
