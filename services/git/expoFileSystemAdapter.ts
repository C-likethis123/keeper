import { File, Directory } from 'expo-file-system';
const MODE_FILE = 0o644;

function normalizePath(path: string): string {
    let pathPart = path.replace(/^file:\/\/?\/?/, '') || '/';
    if (!pathPart.startsWith('/')) pathPart = '/' + pathPart;
    const decoded = pathPart.includes('%') ? decodeURI(pathPart) : pathPart;
    return 'file://' + encodeURI(decoded);
}

function errWithCode(message: string, code: string): Error {
    const e = new Error(message);
    (e as Error & { code: string }).code = code;
    return e;
}

export function createExpoFileSystemAdapter() {
    return {
        promises: {
            async readFile(filePath: string, options?: { encoding?: BufferEncoding }): Promise<Uint8Array | string> {
                const path = normalizePath(filePath);
                const file = new File(path);
                if (!file.exists) throw errWithCode(`File not found: ${filePath}`, 'ENOENT');

                if (options?.encoding === 'utf8' || options?.encoding === 'utf-8') {
                    return await file.text();
                }
                return await file.bytes();
            },

            async writeFile(filePath: string, data: Uint8Array | string, options?: { encoding?: BufferEncoding }): Promise<void> {
                const path = normalizePath(filePath);
                const lastSlash = path.lastIndexOf('/');
                if (lastSlash > 0) {
                    const parentDir = new Directory(path.slice(0, lastSlash));
                    if (!parentDir.exists) {
                        await Promise.resolve(parentDir.create({ intermediates: true }));
                    }
                }
                const file = new File(path);
                if (!file.exists) await Promise.resolve(file.create());
                const content: string | Uint8Array = typeof data === 'string' ? data : data instanceof Uint8Array ? data : new Uint8Array((data as ArrayBufferView).buffer, (data as ArrayBufferView).byteOffset, (data as ArrayBufferView).byteLength);
                await Promise.resolve(file.write(content));
            },

            async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
                const path = normalizePath(dirPath);
                const dir = new Directory(path);
                if (dir.exists) throw errWithCode(`Directory exists: ${dirPath}`, 'EEXIST');
                await Promise.resolve(dir.create({ intermediates: options?.recursive ?? false }));
            },

            async rmdir(dirPath: string): Promise<void> {
                const path = normalizePath(dirPath);
                const dir = new Directory(path);
                if (!dir.exists) throw errWithCode(`Directory not found: ${dirPath}`, 'ENOENT');
                await Promise.resolve(dir.delete());
            },

            async readdir(dirPath: string): Promise<string[]> {
                const path = normalizePath(dirPath);
                const dir = new Directory(path);
                const file = new File(path);
                if (file.exists) throw errWithCode(`Not a directory: ${dirPath}`, 'ENOTDIR');
                if (!dir.exists) throw errWithCode(`Directory not found: ${dirPath}`, 'ENOENT');
                return dir.list().map((entry) => entry.name);
            },

            async stat(filePath: string) {
                const path = normalizePath(filePath);
                const file = new File(path);
                const dir = new Directory(path);
                if (!file.exists && !dir.exists) throw errWithCode(`File not found: ${filePath}`, 'ENOENT');

                const isFile = file.exists;
                const mtimeMs = isFile && file.modificationTime != null ? file.modificationTime : 0;
                const ctimeMs = mtimeMs;

                return {
                    type: isFile ? 'file' : 'dir',
                    mode: MODE_FILE,
                    size: isFile ? file.size : 0,
                    ino: 1,
                    mtimeMs,
                    ctimeMs,
                    uid: 1,
                    gid: 1,
                    dev: 1,
                    isFile: () => isFile,
                    isDirectory: () => dir.exists,
                    isSymbolicLink: () => false,
                };
            },

            async lstat(filePath: string) {
                return this.stat(filePath);
            },

            async rename(oldPath: string, newPath: string): Promise<void> {
                const src = normalizePath(oldPath);
                const dest = normalizePath(newPath);
                const source = new File(src);
                if (!source.exists) throw errWithCode(`File not found: ${oldPath}`, 'ENOENT');
                source.move(new File(dest));
            },

            async unlink(filePath: string): Promise<void> {
                const path = normalizePath(filePath);
                const file = new File(path);
                if (!file.exists) throw errWithCode(`File not found: ${filePath}`, 'ENOENT');
                await Promise.resolve(file.delete());
            },

            async rm(filePath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
                const path = normalizePath(filePath);
                const file = new File(path);
                const dir = new Directory(path);
                if (dir.exists) {
                    if (options?.recursive) {
                        await Promise.resolve(dir.delete());
                    } else {
                        throw errWithCode(`Cannot remove directory without recursive option: ${filePath}`, 'EISDIR');
                    }
                } else if (file.exists) {
                    await Promise.resolve(file.delete());
                } else if (!options?.force) {
                    throw errWithCode(`File not found: ${filePath}`, 'ENOENT');
                }
            },

            async readlink(_filePath: string): Promise<string> {
                throw new Error('Symlinks are not supported in expo-file-system');
            },

            async symlink(_target: string, _filePath: string): Promise<void> {
                throw new Error('Symlinks are not supported in expo-file-system');
            },
        },
    };
}

