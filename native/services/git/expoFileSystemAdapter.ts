import { File, Directory } from 'expo-file-system';

export function createExpoFileSystemAdapter() {
    return {
        promises: {
            async readFile(filePath: string, options?: { encoding?: BufferEncoding }): Promise<Uint8Array | string> {
                const file = new File(filePath);
                if (!file.exists) {
                    const error = new Error(`File not found: ${filePath}`);
                    (error as any).code = 'ENOENT';
                    throw error;
                }

                const content = await file.text();

                if (options?.encoding === 'utf8' || options?.encoding === 'utf-8') {
                    return content;
                }

                // Convert string to Uint8Array for binary mode
                const encoder = new TextEncoder();
                return encoder.encode(content);
            },

            async writeFile(filePath: string, data: Uint8Array | string, options?: { encoding?: BufferEncoding }): Promise<void> {
                try {
                    let content: string;

                    if (data instanceof Uint8Array) {
                        const decoder = new TextDecoder('utf-8');
                        content = decoder.decode(data);
                    } else {
                        content = data;
                    }

                    // Ensure parent directory exists before writing
                    // Extract parent directory path (remove file:// prefix if present, then get dirname)
                    let normalizedPath = filePath;
                    if (normalizedPath.startsWith('file://')) {
                        normalizedPath = normalizedPath.substring(7);
                    }
                    
                    // Find last slash to get parent directory
                    const lastSlashIndex = normalizedPath.lastIndexOf('/');
                    if (lastSlashIndex > 0) {
                        const parentDirPath = normalizedPath.substring(0, lastSlashIndex);
                        const parentDir = new Directory(parentDirPath);
                        if (!parentDir.exists) {
                            // Create parent directory with all intermediate directories
                            await Promise.resolve(parentDir.create({ intermediates: true }));
                        }
                    }

                    const file = new File(filePath);
                    // Ensure write is awaited (it should already be async)
                    await file.write(content);
                } catch (error) {
                    console.error('Error writing file:', filePath, error);
                    throw error;
                }
            },

            async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
                const dir = new Directory(dirPath);
                if (!dir.exists) {
                    // Ensure create is awaited if it's async, or wrapped in Promise.resolve if sync
                    await Promise.resolve(dir.create({ intermediates: options?.recursive ?? false }));
                }
            },

            async rmdir(dirPath: string): Promise<void> {
                const dir = new Directory(dirPath);
                if (!dir.exists) {
                    const error = new Error(`Directory not found: ${dirPath}`);
                    (error as any).code = 'ENOENT';
                    throw error;
                }
                // Ensure delete is awaited if it's async, or wrapped in Promise.resolve if sync
                await Promise.resolve(dir.delete());
            },

            async readdir(dirPath: string): Promise<string[]> {
                const dir = new Directory(dirPath);
                if (!dir.exists) {
                    const error = new Error(`Directory not found: ${dirPath}`);
                    (error as any).code = 'ENOENT';
                    throw error;
                }
                // list() may be sync, but since this is an async function, we can return directly
                const entries = dir.list();
                // Return empty array for empty directories (not an error)
                return entries.map((entry) => entry.name);
            },

            async stat(filePath: string): Promise<{ isFile(): boolean; isDirectory(): boolean; size: number; mtime: Date; ctime: Date }> {
                try {
                    const file = new File(filePath);
                    const dir = new Directory(filePath);

                    if (!file.exists && !dir.exists) {
                        const error = new Error(`File not found: ${filePath}`);
                        (error as any).code = 'ENOENT';
                        throw error;
                    }

                    const isFile = file.exists;
                    const isDir = dir.exists;

                    return {
                        isFile: () => isFile,
                        isDirectory: () => isDir,
                        size: isFile ? file.size : 0,
                        mtime: isFile && file.modificationTime ? new Date(file.modificationTime * 1000) : new Date(),
                        ctime: isFile && file.modificationTime ? new Date(file.modificationTime * 1000) : new Date(),
                    };
                } catch (error) {
                    // Re-throw with ENOENT code for isomorphic-git compatibility
                    if (error instanceof Error && !(error as any).code) {
                        (error as any).code = 'ENOENT';
                    }
                    throw error;
                }
            },

            async lstat(filePath: string): Promise<{ isFile(): boolean; isDirectory(): boolean; size: number; mtime: Date; ctime: Date }> {
                // expo-file-system doesn't distinguish between stat and lstat
                return this.stat(filePath);
            },

            async unlink(filePath: string): Promise<void> {
                const file = new File(filePath);
                if (!file.exists) {
                    const error = new Error(`File not found: ${filePath}`);
                    (error as any).code = 'ENOENT';
                    throw error;
                }
                // Ensure delete is awaited if it's async, or wrapped in Promise.resolve if sync
                await Promise.resolve(file.delete());
            },

            async rm(filePath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
                const file = new File(filePath);
                const dir = new Directory(filePath);

                if (dir.exists) {
                    if (options?.recursive) {
                        await Promise.resolve(dir.delete());
                    } else {
                        const error = new Error(`Cannot remove directory without recursive option: ${filePath}`);
                        (error as any).code = 'EISDIR';
                        throw error;
                    }
                } else if (file.exists) {
                    await Promise.resolve(file.delete());
                } else if (!options?.force) {
                    const error = new Error(`File not found: ${filePath}`);
                    (error as any).code = 'ENOENT';
                    throw error;
                }
                // If force is true and file doesn't exist, silently succeed
            },

            async readlink(filePath: string): Promise<string> {
                // TODO: expo-file-system doesn't support symlinks - no modern equivalent available
                throw new Error('Symlinks are not supported in expo-file-system');
            },

            async symlink(target: string, filePath: string): Promise<void> {
                // TODO: expo-file-system doesn't support symlinks - no modern equivalent available
                throw new Error('Symlinks are not supported in expo-file-system');
            },
        },
    };
}

