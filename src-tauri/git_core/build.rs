use std::collections::HashMap;
use std::env;
use std::path::Path;

const KEYS: [&str; 2] = ["EXPO_PUBLIC_GITHUB_OWNER", "EXPO_PUBLIC_GITHUB_TOKEN"];

fn main() {
    println!("cargo:rerun-if-env-changed=EXPO_PUBLIC_GITHUB_OWNER");
    println!("cargo:rerun-if-env-changed=EXPO_PUBLIC_GITHUB_TOKEN");
    println!("cargo:rerun-if-changed=.env");
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-changed=../../.env");

    let mut values = HashMap::<String, String>::new();

    for key in KEYS {
        if let Ok(value) = env::var(key) {
            if !value.is_empty() {
                values.insert(key.to_string(), value);
            }
        }
    }

    for path in [".env", "../.env", "../../.env"] {
        let path = Path::new(path);
        if !path.exists() {
            continue;
        }
        if let Ok(iter) = dotenvy::from_path_iter(path) {
            for item in iter.flatten() {
                let key = item.0;
                let value = item.1;
                if KEYS.contains(&key.as_str()) && !value.is_empty() && !values.contains_key(&key)
                {
                    values.insert(key, value);
                }
            }
        }
    }

    for key in KEYS {
        if let Some(value) = values.get(key) {
            println!("cargo:rustc-env={key}={value}");
        }
    }
}
