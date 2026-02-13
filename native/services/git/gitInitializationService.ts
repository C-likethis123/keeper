import * as git from 'isomorphic-git';
import { Directory, File } from 'expo-file-system';
import { createExpoFileSystemAdapter } from './expoFileSystemAdapter';
import { NOTES_ROOT } from '@/services/notes/Notes';
import { deleteGitDirectory } from '@/utils/deleteGitDirectory';
// Ensure Buffer is available for isomorphic-git
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

export interface RepositoryStatus {
    hasUncommitted: boolean;
    isBehind: boolean;
    isAhead: boolean;
    currentBranch: string;
    lastCommit?: string;
}

export interface InitializationResult {
    success: boolean;
    wasCloned: boolean;
    status?: RepositoryStatus;
    error?: string;
}

export class GitInitializationService {
    static readonly instance = new GitInitializationService();

    private fs: ReturnType<typeof createExpoFileSystemAdapter>;
    private isInitializing = false;

    private constructor() {
        this.fs = createExpoFileSystemAdapter();
    }

    async initialize(): Promise<InitializationResult> {
        console.log('[GitInitializationService] Starting initialization...');
        
        if (this.isInitializing) {
            console.log('[GitInitializationService] Initialization already in progress');
            return {
                success: false,
                wasCloned: false,
                error: 'Initialization already in progress',
            };
        }

        this.isInitializing = true;

        try {
            const owner = process.env.EXPO_PUBLIC_GITHUB_OWNER;
            const repo = process.env.EXPO_PUBLIC_GITHUB_REPO;
            const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

            console.log('[GitInitializationService] Configuration check:');
            console.log(`  - Owner: ${owner ? '✓' : '✗'} ${owner || 'NOT SET'}`);
            console.log(`  - Repo: ${repo ? '✓' : '✗'} ${repo || 'NOT SET'}`);
            console.log(`  - Token: ${token ? '✓ (length: ' + token.length + ')' : '✗ NOT SET'}`);

            if (!owner || !repo) {
                const error = 'GitHub owner and repo not configured. Please set EXPO_PUBLIC_GITHUB_OWNER and EXPO_PUBLIC_GITHUB_REPO';
                console.error(`[GitInitializationService] ${error}`);
                return {
                    success: false,
                    wasCloned: false,
                    error,
                };
            }

            if (!token) {
                const error = 'GitHub token not configured. Please set EXPO_PUBLIC_GITHUB_TOKEN';
                console.error(`[GitInitializationService] ${error}`);
                return {
                    success: false,
                    wasCloned: false,
                    error,
                };
            }

            console.log('[GitInitializationService] Checking if local repository exists and is valid...');
            const repoValidation = await this.validateRepository();
            console.log(`[GitInitializationService] Repository validation: ${repoValidation.isValid ? 'VALID' : 'INVALID'}`);
            if (!repoValidation.isValid && repoValidation.reason) {
                console.log(`[GitInitializationService] Validation reason: ${repoValidation.reason}`);
            }

            // If repository is invalid, clean it up before cloning
            if (!repoValidation.isValid) {
                if (repoValidation.exists) {
                    console.log('[GitInitializationService] Invalid repository detected, cleaning up before fresh clone...');
                    const cleanupResult = await deleteGitDirectory();
                    if (!cleanupResult.success) {
                        console.warn(`[GitInitializationService] Failed to clean invalid repository: ${cleanupResult.error}`);
                        // Continue anyway - clone might still work
                    } else {
                        console.log('[GitInitializationService] Invalid repository cleaned up successfully');
                    }
                }
                
                console.log('[GitInitializationService] Starting fresh clone...');
                const cloned = await this.cloneRepository();
                if (!cloned) {
                    const error = 'Failed to clone repository. Check network connection and repository access permissions';
                    console.error(`[GitInitializationService] ${error}`);
                    return {
                        success: false,
                        wasCloned: false,
                        error,
                    };
                }

                console.log('[GitInitializationService] Clone completed, verifying repository was created...');
                // After cloning, verify the repository was actually created
                // Wait a moment for file system operations to complete
                await new Promise(resolve => setTimeout(resolve, 100));

                const verifyRepoValidation = await this.validateRepository();
                if (!verifyRepoValidation.isValid) {
                    const error = 'Repository clone appeared to succeed but repository is invalid';
                    console.error(`[GitInitializationService] ${error}`);
                    return {
                        success: false,
                        wasCloned: false,
                        error,
                    };
                }
                console.log('[GitInitializationService] Repository verified successfully after clone');
            } else {
                console.log('[GitInitializationService] Valid repository already exists, skipping clone');
            }

            console.log('[GitInitializationService] Checking repository status...');
            const status = await this.checkRepositoryStatus();

            const result = {
                success: true,
                wasCloned: !repoValidation.isValid,
                status,
            };
            
            console.log('[GitInitializationService] Initialization completed successfully:');
            console.log(`  - Was cloned: ${result.wasCloned ? 'YES' : 'NO'}`);
            console.log(`  - Current branch: ${status.currentBranch}`);
            console.log(`  - Has uncommitted: ${status.hasUncommitted}`);
            console.log(`  - Is behind: ${status.isBehind}`);
            console.log(`  - Is ahead: ${status.isAhead}`);
            
            return result;
        } catch (error) {
            console.error('[GitInitializationService] Initialization error:', error);

            let errorMessage = 'Unknown error during initialization';
            if (error instanceof Error) {
                errorMessage = error.message;

                if (error.message.includes('network') || error.message.includes('fetch')) {
                    errorMessage = 'Network error: Check your internet connection';
                } else if (error.message.includes('permission') || error.message.includes('401') || error.message.includes('403')) {
                    errorMessage = 'Authentication error: Check your GitHub token permissions';
                } else if (error.message.includes('ENOENT') || error.message.includes('not found')) {
                    errorMessage = 'File system error: Check app permissions';
                }
            }

            return {
                success: false,
                wasCloned: false,
                error: errorMessage,
            };
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Validates that the repository exists and is in a usable state.
     * Returns both whether it exists and whether it's valid.
     */
    private async validateRepository(): Promise<{ exists: boolean; isValid: boolean; reason?: string }> {
        try {
            const gitDirPath = `${NOTES_ROOT}.git`;
            const gitDir = new Directory(gitDirPath);
            const dirExists = gitDir.exists;
            console.log(`[GitInitializationService] Checking ${gitDirPath}: ${dirExists ? 'EXISTS' : 'NOT FOUND'}`);
            
            // If directory doesn't exist, repo doesn't exist
            if (!dirExists) {
                return { exists: false, isValid: false, reason: 'Directory does not exist' };
            }
            
            // Directory exists, verify it's a valid git repository
            const headFile = new File(`${gitDirPath}/HEAD`);
            const configFile = new File(`${gitDirPath}/config`);
            
            if (!headFile.exists) {
                return { exists: true, isValid: false, reason: 'HEAD file not found - repository is incomplete' };
            }
            
            if (!configFile.exists) {
                return { exists: true, isValid: false, reason: 'Config file not found - repository is incomplete' };
            }
            
            // Try to verify the repository is actually usable by checking if we can read basic info
            try {
                // Try to list branches - this will fail if the repository is corrupted
                await git.listBranches({
                    fs: this.fs,
                    dir: NOTES_ROOT,
                });
                
                console.log(`[GitInitializationService] Valid git repository found`);
                return { exists: true, isValid: true };
            } catch (gitError) {
                const errorMsg = gitError instanceof Error ? gitError.message : String(gitError);
                console.warn(`[GitInitializationService] Repository appears corrupted: ${errorMsg}`);
                
                // Check for specific error types that indicate corruption
                if (errorMsg.includes('CommitNotFetchedError') || 
                    errorMsg.includes('not available locally') ||
                    errorMsg.includes('NotFoundError')) {
                    return { exists: true, isValid: false, reason: `Repository corrupted: ${errorMsg}` };
                }
                
                return { exists: true, isValid: false, reason: `Repository validation failed: ${errorMsg}` };
            }
        } catch (error) {
            console.warn('[GitInitializationService] Error validating repository:', error);
            if (error instanceof Error && error.message.includes('permission')) {
                console.error('File system permission error. Ensure app has storage permissions');
            }
            return { exists: false, isValid: false, reason: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private async cloneRepository(): Promise<boolean> {
        try {
            const owner = process.env.EXPO_PUBLIC_GITHUB_OWNER;
            const repo = process.env.EXPO_PUBLIC_GITHUB_REPO;
            const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

            if (!owner || !repo) {
                throw new Error('GitHub owner and repo not configured');
            }

            if (!token) {
                throw new Error('GitHub token not configured');
            }

            // For git clone over HTTPS with GitHub, use token in URL
            // GitHub accepts: https://<token>@github.com/owner/repo.git
            // Or: https://x-access-token:<token>@github.com/owner/repo.git
            const url = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

            console.log('[GitInitializationService] Starting clone...');
            
            // Clone without checking out to avoid CommitNotFetchedError
            // We'll checkout manually after the clone completes
            await git.clone({
                fs: this.fs,
                dir: NOTES_ROOT,
                url,
                http: {
                    async request({ url: requestUrl, method, headers, body: requestBody }) {
                        try {
                            const response = await fetch(requestUrl, {
                                method,
                                headers: {
                                    ...headers,
                                    // Remove any existing Authorization header to use URL-based auth
                                },
                                body: requestBody ? (requestBody as unknown as BodyInit) : undefined,
                            });

                            if (!response.ok) {
                                const errorText = await response.text().catch(() => '');
                                console.warn(`[GitInitializationService] HTTP ${response.status} error:`, errorText);

                                if (response.status === 401 || response.status === 403) {
                                    throw new Error(`Authentication failed: Invalid or expired GitHub token (HTTP ${response.status}). Check token permissions and ensure it has 'repo' scope.`);
                                } else if (response.status === 404) {
                                    throw new Error(`Repository not found: ${owner}/${repo}`);
                                } else {
                                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                                }
                            }

                            // Create an async iterator for the response body
                            // isomorphic-git's StreamReader expects an iterable body
                            // CRITICAL: bodyIterator must NEVER be undefined
                            const responseBody = response.body;
                            let bodyIterator: AsyncIterableIterator<Uint8Array>;

                            if (responseBody && typeof (responseBody as any).getReader === 'function') {
                                // Response has a ReadableStream - create iterator from stream
                                try {
                                    const reader = (responseBody as ReadableStream<Uint8Array>).getReader();
                                    bodyIterator = (async function* () {
                                        try {
                                            while (true) {
                                                const { done, value } = await reader.read();
                                                if (done) break;
                                                // Ensure value is converted to Uint8Array
                                                yield value instanceof Uint8Array ? value : new Uint8Array(value);
                                            }
                                        } finally {
                                            reader.releaseLock();
                                        }
                                    })();
                                } catch (streamError) {
                                    // If stream reading fails, fall back to arrayBuffer
                                    console.warn('[GitInitializationService] Stream read failed, falling back to arrayBuffer:', streamError);
                                    const arrayBuffer = await response.arrayBuffer();
                                    const uint8Array = new Uint8Array(arrayBuffer);
                                    bodyIterator = (async function* () {
                                        yield uint8Array;
                                    })();
                                }
                            } else {
                                // React Native fetch might not have ReadableStream or response.body is null/undefined
                                // Fallback: read as arrayBuffer and create iterator from that
                                const arrayBuffer = await response.arrayBuffer();
                                const uint8Array = new Uint8Array(arrayBuffer);
                                bodyIterator = (async function* () {
                                    yield uint8Array;
                                })();
                            }

                            // Final safety check: ensure bodyIterator is defined
                            if (!bodyIterator) {
                                // Last resort: create empty iterator
                                bodyIterator = (async function* () {
                                    // Empty iterator
                                })();
                            }

                            return {
                                ok: response.ok,
                                status: response.status,
                                statusCode: response.status,
                                statusText: response.statusText,
                                statusMessage: response.statusText,
                                url: response.url,
                                headers: Object.fromEntries(response.headers.entries()),
                                body: bodyIterator,
                                async text() {
                                    return await response.text();
                                },
                                async arrayBuffer() {
                                    return await response.arrayBuffer();
                                },
                            };
                        } catch (fetchError) {
                            if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
                                throw new Error('Network error: Unable to connect to GitHub. Check your internet connection');
                            }
                            throw fetchError;
                        }
                    },
                },
                depth: 1,
                singleBranch: true,
                noCheckout: true, // Don't checkout during clone to avoid CommitNotFetchedError
                onProgress: (progress) => {
                    // Log progress for debugging
                    if (progress.phase === 'receiving' || progress.phase === 'resolving' || progress.phase === 'checking out') {
                        console.log(`[GitInitializationService] Clone progress: ${progress.phase} - ${progress.total ? `${progress.loaded}/${progress.total}` : progress.loaded}`);
                    }
                },
            });

            console.log('[GitInitializationService] Clone completed, checking out branch...');
            
            // Wait a moment for file system operations to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Now checkout the branch manually after clone completes
            try {
                // First, try to determine the default branch (usually 'main' or 'master')
                let branchToCheckout = 'main';
                try {
                    const remoteBranches = await git.listBranches({
                        fs: this.fs,
                        dir: NOTES_ROOT,
                        remote: 'origin',
                    });
                    
                    // Prefer 'main', fallback to 'master', or use first available
                    if (remoteBranches.includes('origin/main')) {
                        branchToCheckout = 'main';
                    } else if (remoteBranches.includes('origin/master')) {
                        branchToCheckout = 'master';
                    } else if (remoteBranches.length > 0) {
                        // Use first remote branch, removing 'origin/' prefix
                        branchToCheckout = remoteBranches[0].replace('origin/', '');
                    }
                    console.log(`[GitInitializationService] Checking out branch: ${branchToCheckout}`);
                } catch (branchError) {
                    console.warn('[GitInitializationService] Could not list branches, defaulting to main:', branchError);
                }
                
                // Checkout the branch
                await git.checkout({
                    fs: this.fs,
                    dir: NOTES_ROOT,
                    ref: branchToCheckout,
                });
                
                console.log(`[GitInitializationService] Successfully checked out branch: ${branchToCheckout}`);
            } catch (checkoutError) {
                console.error('[GitInitializationService] Error during checkout:', checkoutError);
                // If checkout fails, try to continue - repository might still be usable
                console.warn('[GitInitializationService] Checkout failed, but repository may still be usable');
            }

            console.log('[GitInitializationService] Clone and checkout completed, verifying repository...');

            // Verify that key files exist after clone
            const headFile = new File(`${NOTES_ROOT}.git/HEAD`);
            const configFile = new File(`${NOTES_ROOT}.git/config`);

            // Wait a bit for file system operations to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            if (!headFile.exists) {
                console.error('[GitInitializationService] HEAD file not found after clone - clone may have failed');
                return false;
            }

            if (!configFile.exists) {
                console.error('[GitInitializationService] Config file not found after clone - clone may have failed');
                return false;
            }

            console.log('[GitInitializationService] Repository verified successfully');
            return true;
        } catch (error) {
            // Log all clone errors for debugging
            console.error('[GitInitializationService] Clone error:', error);

            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                const errorCode = (error as any).code;

                // If clone fails due to repository corruption (CommitNotFetchedError, etc.),
                // clean up and suggest retry
                if (errorMessage.includes('commitnotfetched') || 
                    errorMessage.includes('not available locally') ||
                    errorMessage.includes('notfounderror')) {
                    console.error('[GitInitializationService] Clone failed due to repository corruption');
                    console.error('[GitInitializationService] Attempting to clean up corrupted repository...');
                    
                    const cleanupResult = await deleteGitDirectory();
                    if (cleanupResult.success) {
                        console.log('[GitInitializationService] Corrupted repository cleaned up. Please retry initialization.');
                    } else {
                        console.warn(`[GitInitializationService] Failed to clean corrupted repository: ${cleanupResult.error}`);
                    }
                    
                    return false;
                }

                // Log authentication errors with more detail
                if (errorMessage.includes('authentication failed') || errorMessage.includes('401') || errorMessage.includes('403')) {
                    console.error('[GitInitializationService] Authentication error details:');
                    console.error('  - Token present:', !!process.env.EXPO_PUBLIC_GITHUB_TOKEN);
                    console.error('  - Token length:', process.env.EXPO_PUBLIC_GITHUB_TOKEN?.length || 0);
                    console.error('  - Owner:', process.env.EXPO_PUBLIC_GITHUB_OWNER);
                    console.error('  - Repo:', process.env.EXPO_PUBLIC_GITHUB_REPO);
                    console.error('  - Error:', error.message);
                    return false;
                }

                // Network errors
                if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
                    console.error('[GitInitializationService] Network error:', error.message);
                    return false;
                }

                // File system permission errors
                if (errorMessage.includes('permission') || errorCode === 'EACCES' || errorCode === 'EPERM') {
                    console.error('[GitInitializationService] File system permission error. Ensure app has storage permissions');
                    return false;
                }

                // ENOENT errors during clone might be expected, but if clone throws an error,
                // it likely means something went wrong
                if (errorCode === 'ENOENT' || errorMessage.includes('enoent')) {
                    console.warn('[GitInitializationService] ENOENT error during clone - this may be expected, but clone failed');
                    return false;
                }
            }

            return false;
        }
    }

    private async checkRepositoryStatus(): Promise<RepositoryStatus> {
        try {
            // First check if HEAD exists - if not, repository isn't properly initialized
            try {
                const headFile = new File(`${NOTES_ROOT}.git/HEAD`);
                if (!headFile.exists) {
                    console.warn('[GitInitializationService] HEAD file not found - repository may not be fully cloned');
                    return {
                        hasUncommitted: false,
                        isBehind: false,
                        isAhead: false,
                        currentBranch: 'main',
                    };
                }
            } catch (headError) {
                console.warn('[GitInitializationService] Could not check HEAD file:', headError);
                return {
                    hasUncommitted: false,
                    isBehind: false,
                    isAhead: false,
                    currentBranch: 'main',
                };
            }

            // Try to get current branch first - this will fail if HEAD doesn't exist
            let currentBranch = 'main';
            let lastCommit: string | undefined;

            try {
                const branches = await git.listBranches({
                    fs: this.fs,
                    dir: NOTES_ROOT,
                });
                currentBranch = branches.find((b) => !b.startsWith('origin/')) || 'main';
            } catch (branchError) {
                console.warn('[GitInitializationService] Could not list branches:', branchError);
            }

            // Try to get status matrix - this requires a valid repository
            let hasUncommitted = false;
            try {
                const statusMatrix = await git.statusMatrix({
                    fs: this.fs,
                    dir: NOTES_ROOT,
                });

                hasUncommitted = statusMatrix.some(
                    ([, headStatus, workdirStatus, stageStatus]) => {
                        return headStatus !== workdirStatus || headStatus !== stageStatus;
                    },
                );
            } catch (statusError) {
                // If status check fails, assume no uncommitted changes
                console.warn('[GitInitializationService] Could not get status matrix:', statusError);
            }

            // Try to get last commit
            try {
                const log = await git.log({
                    fs: this.fs,
                    dir: NOTES_ROOT,
                    depth: 1,
                });
                lastCommit = log.length > 0 ? log[0].oid : undefined;
            } catch (logError) {
                console.warn('[GitInitializationService] Could not get commit log:', logError);
            }

            // Try to get remote status (this might also fail if repository isn't fully initialized)
            let remoteStatus = { isBehind: false, isAhead: false };
            try {
                remoteStatus = await this.fetchRemoteStatus();
            } catch (remoteError) {
                console.warn('[GitInitializationService] Could not get remote status:', remoteError);
            }

            return {
                hasUncommitted,
                isBehind: remoteStatus.isBehind,
                isAhead: remoteStatus.isAhead,
                currentBranch,
                lastCommit,
            };
        } catch (error) {
            // If error is NotFoundError for HEAD, repository isn't initialized
            if (error instanceof Error && (error.message.includes('HEAD') || error.message.includes('NotFoundError'))) {
                console.warn('[GitInitializationService] Repository not fully initialized - HEAD not found');
                return {
                    hasUncommitted: false,
                    isBehind: false,
                    isAhead: false,
                    currentBranch: 'main',
                };
            }

            console.error('[GitInitializationService] Status check error:', error);
            return {
                hasUncommitted: false,
                isBehind: false,
                isAhead: false,
                currentBranch: 'main',
            };
        }
    }

    private async fetchRemoteStatus(): Promise<{ isBehind: boolean; isAhead: boolean }> {
        try {
            const owner = process.env.EXPO_PUBLIC_GITHUB_OWNER;
            const repo = process.env.EXPO_PUBLIC_GITHUB_REPO;
            const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

            if (!owner || !repo || !token) {
                return { isBehind: false, isAhead: false };
            }

            await git.fetch({
                fs: this.fs,
                dir: NOTES_ROOT,
                http: {
                    async request({ url: requestUrl, method, headers, body: requestBody }) {
                        const response = await fetch(requestUrl, {
                            method,
                            headers: {
                                ...headers,
                                Authorization: `Bearer ${token}`,
                            },
                            body: requestBody ? (requestBody as unknown as BodyInit) : undefined,
                        });

                        // Create an async iterator for the response body
                        // CRITICAL: bodyIterator must NEVER be undefined
                        const responseBody = response.body;
                        let bodyIterator: AsyncIterableIterator<Uint8Array>;

                        if (responseBody && typeof (responseBody as any).getReader === 'function') {
                            // Response has a ReadableStream - create iterator from stream
                            try {
                                const reader = (responseBody as ReadableStream<Uint8Array>).getReader();
                                bodyIterator = (async function* () {
                                    try {
                                        while (true) {
                                            const { done, value } = await reader.read();
                                            if (done) break;
                                            // Ensure value is converted to Uint8Array
                                            yield value instanceof Uint8Array ? value : new Uint8Array(value);
                                        }
                                    } finally {
                                        reader.releaseLock();
                                    }
                                })();
                            } catch (streamError) {
                                // If stream reading fails, fall back to arrayBuffer
                                console.warn('[GitInitializationService] Stream read failed, falling back to arrayBuffer:', streamError);
                                const arrayBuffer = await response.arrayBuffer();
                                const uint8Array = new Uint8Array(arrayBuffer);
                                bodyIterator = (async function* () {
                                    yield uint8Array;
                                })();
                            }
                        } else {
                            // React Native fetch might not have ReadableStream or response.body is null/undefined
                            // Fallback: read as arrayBuffer and create iterator from that
                            const arrayBuffer = await response.arrayBuffer();
                            const uint8Array = new Uint8Array(arrayBuffer);
                            bodyIterator = (async function* () {
                                yield uint8Array;
                            })();
                        }

                        // Final safety check: ensure bodyIterator is defined
                        if (!bodyIterator) {
                            // Last resort: create empty iterator
                            bodyIterator = (async function* () {
                                // Empty iterator
                            })();
                        }

                        return {
                            ok: response.ok,
                            status: response.status,
                            statusCode: response.status,
                            statusText: response.statusText,
                            statusMessage: response.statusText,
                            url: response.url,
                            headers: Object.fromEntries(response.headers.entries()),
                            body: bodyIterator,
                            async text() {
                                return await response.text();
                            },
                            async arrayBuffer() {
                                return await response.arrayBuffer();
                            },
                        };
                    },
                },
                remote: 'origin',
            });

            const localBranches = await git.listBranches({
                fs: this.fs,
                dir: NOTES_ROOT,
            });

            const remoteBranches = await git.listBranches({
                fs: this.fs,
                dir: NOTES_ROOT,
                remote: 'origin',
            });

            const currentBranch = localBranches.find((b) => !b.startsWith('origin/')) || 'main';
            const remoteBranch = `origin/${currentBranch}`;

            if (!remoteBranches.includes(remoteBranch)) {
                return { isBehind: false, isAhead: false };
            }

            const localLog = await git.log({
                fs: this.fs,
                dir: NOTES_ROOT,
                ref: currentBranch,
                depth: 1,
            });

            const remoteLog = await git.log({
                fs: this.fs,
                dir: NOTES_ROOT,
                ref: remoteBranch,
                depth: 1,
            });

            if (localLog.length === 0 || remoteLog.length === 0) {
                return { isBehind: false, isAhead: false };
            }

            const localCommit = localLog[0].oid;
            const remoteCommit = remoteLog[0].oid;

            // Check if commits are the same
            if (localCommit === remoteCommit) {
                return { isBehind: false, isAhead: false };
            }

            // Check if local is behind by seeing if remote commit is in local history
            let isBehind = false;
            let isAhead = false;

            try {
                // Check if remote commit is reachable from local (local is behind)
                const localHistory = await git.log({
                    fs: this.fs,
                    dir: NOTES_ROOT,
                    ref: currentBranch,
                });
                isBehind = !localHistory.some((commit) => commit.oid === remoteCommit);

                // Check if local commit is reachable from remote (local is ahead)
                const remoteHistory = await git.log({
                    fs: this.fs,
                    dir: NOTES_ROOT,
                    ref: remoteBranch,
                });
                isAhead = !remoteHistory.some((commit) => commit.oid === localCommit);
            } catch (error) {
                // If we can't determine, assume they're in sync
                console.warn('[GitInitializationService] Could not determine branch sync status:', error);
                return { isBehind: false, isAhead: false };
            }

            return { isBehind, isAhead };
        } catch (error) {
            console.warn('[GitInitializationService] Remote status check error:', error);
            return { isBehind: false, isAhead: false };
        }
    }
}

