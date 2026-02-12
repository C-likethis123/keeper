import * as git from 'isomorphic-git';
import { Directory } from 'expo-file-system';
import { createExpoFileSystemAdapter } from './expoFileSystemAdapter';
import { NOTES_ROOT } from '@/services/notes/Notes';

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
    if (this.isInitializing) {
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

      if (!owner || !repo) {
        return {
          success: false,
          wasCloned: false,
          error: 'GitHub owner and repo not configured. Please set EXPO_PUBLIC_GITHUB_OWNER and EXPO_PUBLIC_GITHUB_REPO',
        };
      }

      if (!token) {
        return {
          success: false,
          wasCloned: false,
          error: 'GitHub token not configured. Please set EXPO_PUBLIC_GITHUB_TOKEN',
        };
      }

      const repoExists = await this.checkLocalRepoExists();

      if (!repoExists) {
        const cloned = await this.cloneRepository();
        if (!cloned) {
          return {
            success: false,
            wasCloned: false,
            error: 'Failed to clone repository. Check network connection and repository access permissions',
          };
        }
      }

      const status = await this.checkRepositoryStatus();

      return {
        success: true,
        wasCloned: !repoExists,
        status,
      };
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

  private async checkLocalRepoExists(): Promise<boolean> {
    try {
      const gitDir = new Directory(`${NOTES_ROOT}.git`);
      return gitDir.exists;
    } catch (error) {
      console.warn('[GitInitializationService] Error checking repo existence:', error);
      if (error instanceof Error && error.message.includes('permission')) {
        console.error('File system permission error. Ensure app has storage permissions');
      }
      return false;
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

      const url = `https://github.com/${owner}/${repo}.git`;

      await git.clone({
        fs: this.fs,
        dir: NOTES_ROOT,
        url,
        http: {
          async request({ url: requestUrl, method, headers, body }) {
            try {
              const response = await fetch(requestUrl, {
                method,
                headers: {
                  ...headers,
                  Authorization: `Bearer ${token}`,
                },
                body: body ? (body as unknown as BodyInit) : undefined,
              });

              if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                  throw new Error('Authentication failed: Invalid or expired GitHub token');
                } else if (response.status === 404) {
                  throw new Error(`Repository not found: ${owner}/${repo}`);
                } else {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
              }

              return {
                ok: response.ok,
                status: response.status,
                statusCode: response.status,
                statusText: response.statusText,
                statusMessage: response.statusText,
                url: response.url,
                headers: Object.fromEntries(response.headers.entries()),
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
        onProgress: (progress) => {
          // Suppress expected file not found errors during clone
          if (progress.phase === 'indexing' || progress.phase === 'analyzing') {
            // These phases may check for files that don't exist yet
            return;
          }
        },
      });

      return true;
    } catch (error) {
      // Ignore expected "file not found" errors during clone initialization
      // isomorphic-git checks for files that don't exist yet, which is normal
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('file not found') &&
          (errorMessage.includes('.git/config') || errorMessage.includes('.git/'))
        ) {
          // This is expected during initial clone - isomorphic-git checks for existing repo
          console.log('[GitInitializationService] Expected file check during clone, continuing...');
          return true;
        }
        
        if (errorMessage.includes('enoent') || errorMessage.includes('permission')) {
          console.error('File system permission error. Ensure app has storage permissions');
        } else {
          console.error('[GitInitializationService] Clone error:', error);
        }
      } else {
        console.error('[GitInitializationService] Clone error:', error);
      }
      
      return false;
    }
  }

  private async checkRepositoryStatus(): Promise<RepositoryStatus> {
    try {
      const statusMatrix = await git.statusMatrix({
        fs: this.fs,
        dir: NOTES_ROOT,
      });

      const hasUncommitted = statusMatrix.some(
        ([, headStatus, workdirStatus, stageStatus]) => {
          return headStatus !== workdirStatus || headStatus !== stageStatus;
        },
      );

      const branches = await git.listBranches({
        fs: this.fs,
        dir: NOTES_ROOT,
      });

      const currentBranch = branches.find((b) => !b.startsWith('origin/')) || 'main';

      const log = await git.log({
        fs: this.fs,
        dir: NOTES_ROOT,
        depth: 1,
      });

      const lastCommit = log.length > 0 ? log[0].oid : undefined;

      const remoteStatus = await this.fetchRemoteStatus();

      return {
        hasUncommitted,
        isBehind: remoteStatus.isBehind,
        isAhead: remoteStatus.isAhead,
        currentBranch,
        lastCommit,
      };
    } catch (error) {
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
          async request({ url: requestUrl, method, headers, body }) {
            const response = await fetch(requestUrl, {
              method,
              headers: {
                ...headers,
                Authorization: `Bearer ${token}`,
              },
              body: body ? (body as unknown as BodyInit) : undefined,
            });

            return {
              ok: response.ok,
              status: response.status,
              statusCode: response.status,
              statusText: response.statusText,
              statusMessage: response.statusText,
              url: response.url,
              headers: Object.fromEntries(response.headers.entries()),
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

