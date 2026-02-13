import { Octokit } from '@octokit/rest';
import { File } from 'expo-file-system';
import { NOTES_ROOT } from '@/services/notes/Notes';

export type GitChangeOperation = 'add' | 'modify' | 'delete';

export interface GitChange {
  filePath: string;
  operation: GitChangeOperation;
}

export interface CommitResponse {
  success: boolean;
  commitHash?: string;
  error?: string;
}

export interface GetFileResponse {
  success: boolean;
  content?: string;
  error?: string;
}

let octokitInstance: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokitInstance) {
    const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
    if (!token) {
      throw new Error('EXPO_PUBLIC_GITHUB_TOKEN is not set');
    }
    octokitInstance = new Octokit({
      auth: token,
    });
  }
  return octokitInstance;
}

function getGitHubConfig() {
  const owner = process.env.EXPO_PUBLIC_GITHUB_OWNER;
  const repo = process.env.EXPO_PUBLIC_GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error('EXPO_PUBLIC_GITHUB_OWNER and EXPO_PUBLIC_GITHUB_REPO must be set');
  }

  return { owner, repo };
}

async function readLocalFileContent(filePath: string): Promise<string | null> {
  try {
    const localFilePath = `${NOTES_ROOT}${filePath}`;
    const file = new File(localFilePath);
    if (file.exists) {
      return await file.text();
    }
  } catch (error) {
    // File doesn't exist or can't be read
    return null;
  }
  return null;
}

async function getFileSha(filePath: string): Promise<string | null> {
  try {
    const { owner, repo } = getGitHubConfig();
    const octokit = getOctokit();
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    if (Array.isArray(response.data)) {
      return null;
    }

    if ('sha' in response.data) {
      return response.data.sha;
    }
  } catch (error: any) {
    if (error?.status === 404) {
      // File doesn't exist, which is fine for new files
      return null;
    }
    throw error;
  }
  return null;
}

export async function commitChanges(
  changes: GitChange[],
  message?: string,
): Promise<CommitResponse> {
  if (changes.length === 0) {
    return { success: true };
  }

  try {
    const { owner, repo } = getGitHubConfig();
    const octokit = getOctokit();
    const commitMessage = message || `Update ${changes.length} file(s)`;

    let lastCommitHash: string | undefined;

    // Process changes sequentially
    // Note: Each operation creates a separate commit. To batch into a single commit,
    // we would need to use the Git Data API which is more complex.
    for (const change of changes) {
      const { filePath, operation } = change;

      try {
        if (operation === 'delete') {
          const sha = await getFileSha(filePath);
          if (!sha) {
            console.warn(`[GitApi] File ${filePath} does not exist, skipping delete`);
            continue;
          }

          const response = await octokit.rest.repos.deleteFile({
            owner,
            repo,
            path: filePath,
            message: commitMessage,
            sha,
          });

          lastCommitHash = response.data.commit.sha;
        } else if (operation === 'add' || operation === 'modify') {
          const content = await readLocalFileContent(filePath);
          if (content === null) {
            console.warn(`[GitApi] Could not read local file ${filePath}, skipping ${operation}`);
            continue;
          }

          // Encode content to base64
          const encodedContent = typeof Buffer !== 'undefined'
            ? Buffer.from(content, 'utf-8').toString('base64')
            : btoa(unescape(encodeURIComponent(content)));

          // Get SHA if file exists (for updates)
          const sha = await getFileSha(filePath);

          const response = await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: commitMessage,
            content: encodedContent,
            ...(sha ? { sha } : {}), // Include SHA only if file exists (for updates)
          });

          lastCommitHash = response.data.commit.sha;
        }
      } catch (error: any) {
        console.warn(`[GitApi] Failed to ${operation} file ${filePath}:`, error?.message ?? error);
        // Continue with other changes even if one fails
      }
    }

    return {
      success: true,
      commitHash: lastCommitHash,
    };
  } catch (error: any) {
    console.warn('[GitApi] Failed to commit changes:', error?.message ?? error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getFile(filePath: string): Promise<GetFileResponse> {
  try {
    const localFilePath = `${NOTES_ROOT}${filePath}`;
    
    try {
      const file = new File(localFilePath);
      if (file.exists) {
        const content = await file.text();
        return {
          success: true,
          content,
        };
      }
    } catch (localError) {
      if (localError instanceof Error && !localError.message.includes('not found') && !localError.message.includes('ENOENT')) {
        console.warn('[GitApi] Error reading local file, falling back to GitHub API:', localError.message);
      }
    }

    const { owner, repo } = getGitHubConfig();
    const octokit = getOctokit();
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    if (Array.isArray(response.data)) {
      return {
        success: false,
        error: 'Path is a directory, not a file',
      };
    }

    if ('content' in response.data && response.data.encoding === 'base64') {
      const base64Content = response.data.content.replace(/\s/g, '');
      let content: string;

      try {
        if (typeof Buffer !== 'undefined') {
          content = Buffer.from(base64Content, 'base64').toString('utf-8');
        } else if (typeof atob !== 'undefined') {
          content = atob(base64Content);
        } else {
          return {
            success: false,
            error: 'Base64 decoding not available in this environment',
          };
        }
      } catch (decodeError) {
        return {
          success: false,
          error: `Failed to decode base64 content: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`,
        };
      }

      return {
        success: true,
        content,
      };
    }

    return {
      success: false,
      error: 'File is not a regular file or has unsupported encoding',
    };
  } catch (error: any) {
    console.warn('[GitApi] Failed to get file:', error?.message ?? error);
    
    let errorMessage = error instanceof Error ? error.message : String(error);
    
    if (error?.status === 401 || error?.status === 403) {
      errorMessage = 'Authentication failed: Invalid or expired GitHub token';
    } else if (error?.status === 404) {
      errorMessage = `File not found: ${filePath}`;
    } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      errorMessage = 'Network error: Check your internet connection';
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}
