mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port: u16 = portpicker::pick_unused_port().expect("failed to find unused port");

    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(port).build())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let url = if cfg!(debug_assertions) {
                tauri::WebviewUrl::App("index.html".into())
            } else {
                tauri::WebviewUrl::External(
                    format!("http://localhost:{}", port)
                        .parse()
                        .expect("valid localhost URL"),
                )
            };

            tauri::WebviewWindowBuilder::new(app, "main", url)
                .title("Keeper")
                .inner_size(800.0, 600.0)
                .resizable(true)
                .build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage::storage_initialize,
            storage::storage_reset_all_data,
            storage::storage_read_file_bytes,
            storage::storage_write_file_bytes,
            storage::storage_list_files_recursive,
            storage::storage_delete_directory,
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
            storage::read_attachment,
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
