use git_core::{GitChangedPaths, GitConflictFile, GitMergeAuthor, GitMergeOptionsInput, GitStatusItem};
mod storage;

#[tauri::command]
fn git_clone_repo(url: String, path: String) -> Result<(), String> {
    let result = git_core::clone_repo(&url, &path);
    if let Err(ref e) = result {
        eprintln!("[git_clone_repo] FAILED: {e}");
    }
    result
}

#[tauri::command]
fn git_head_oid_repo(repo_path: String) -> Result<String, String> {
    let result = git_core::head_oid(&repo_path);
    if let Err(ref e) = result {
        eprintln!("[git_head_oid_repo] FAILED: {e}");
    }
    result
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
fn git_changed_markdown_paths_repo(
    repo_path: String,
    from_oid: String,
    to_oid: String,
) -> Result<GitChangedPaths, String> {
    git_core::changed_markdown_paths(&repo_path, &from_oid, &to_oid)
}

#[tauri::command]
fn git_changed_paths_repo(
    repo_path: String,
    from_oid: String,
    to_oid: String,
) -> Result<GitChangedPaths, String> {
    git_core::changed_paths(&repo_path, &from_oid, &to_oid)
}

#[tauri::command]
fn git_conflicted_files_repo(repo_path: String) -> Result<Vec<GitConflictFile>, String> {
    let result = git_core::get_conflicted_files(&repo_path);
    if let Err(ref e) = result {
        eprintln!("[git_conflicted_files_repo] FAILED: {e}");
    }
    result
}

#[tauri::command]
fn git_resolve_conflict_repo(
    repo_path: String,
    path: String,
    strategy: String,
    manual_content: Option<String>,
) -> Result<(), String> {
    let result = git_core::resolve_conflict(&repo_path, &path, &strategy, manual_content.as_deref());
    if let Err(ref e) = result {
        eprintln!("[git_resolve_conflict_repo] FAILED: {e}");
    }
    result
}

#[tauri::command]
fn git_has_unresolved_conflicts_repo(repo_path: String) -> Result<bool, String> {
    let result = git_core::has_unresolved_conflicts(&repo_path);
    if let Err(ref e) = result {
        eprintln!("[git_has_unresolved_conflicts_repo] FAILED: {e}");
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            git_changed_paths_repo,
            git_conflicted_files_repo,
            git_resolve_conflict_repo,
            git_has_unresolved_conflicts_repo,
            storage::storage_initialize,
            storage::storage_reset_all_data,
            storage::read_note,
            storage::write_note,
            storage::delete_note,
            storage::list_note_files,
            storage::stat_note,
            storage::index_upsert,
            storage::index_delete,
            storage::index_list,
            storage::index_rebuild_from_disk,
            storage::notes_root_path_command,
            storage::copy_attachment,
            storage::delete_attachment,
            storage::copy_image,
            storage::wiki_links_upsert,
            storage::wiki_links_delete_for_note,
            storage::wiki_links_get_backlinks,
            storage::wiki_links_get_outgoing,
            storage::wiki_links_get_orphaned_notes,
            storage::wiki_links_get_recently_edited,
            storage::clusters_get_active,
            storage::clusters_get_accepted,
            storage::clusters_get_members,
            storage::clusters_dismiss,
            storage::clusters_accept,
            storage::clusters_rename,
            storage::clusters_import,
            storage::clusters_add_note,
            storage::clusters_remove_note,
            storage::clusters_delete,
            storage::clusters_record_feedback,
            storage::clusters_get_all_feedback,
            storage::clusters_export_feedback_file,
            storage::clusters_get_standalone_accepted,
            storage::super_clusters_get_active,
            storage::super_clusters_get_accepted,
            storage::super_clusters_accept,
            storage::super_clusters_dismiss,
            storage::super_clusters_rename,
            storage::super_clusters_get_sub_clusters
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
