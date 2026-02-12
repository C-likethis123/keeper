export type GitChangeOperation = 'add' | 'modify' | 'delete';

export interface GitChange {
  filePath: string;
  operation: GitChangeOperation;
}

export interface CommitRequest {
  changes: GitChange[];
  message?: string;
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

const GIT_API_BASE_URL = process.env.EXPO_PUBLIC_GIT_API_URL;

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!GIT_API_BASE_URL) {
    console.warn(
      '[GitApi] EXPO_PUBLIC_GIT_API_URL is not set. Skipping git operation for',
      path,
    );
    throw new Error('GIT_API_URL_NOT_CONFIGURED');
  }

  const url = `${GIT_API_BASE_URL.replace(/\/+$/, '')}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `[GitApi] Request failed for ${path} with ${response.status}: ${text}`,
    );
  }

  return (await response.json()) as T;
}

export async function commitChanges(
  changes: GitChange[],
  message?: string,
): Promise<CommitResponse> {
  if (changes.length === 0) {
    return { success: true };
  }

  try {
    const body: CommitRequest = {
      changes,
      message,
    };

    return await request<CommitResponse>('/git/commit', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    });
  } catch (error: any) {
    console.warn('[GitApi] Failed to commit changes:', error?.message ?? error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

import { Octokit } from '@octokit/rest';
import { File } from 'expo-file-system';
import { NOTES_ROOT } from '@/services/notes/Notes';

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

    const owner = process.env.EXPO_PUBLIC_GITHUB_OWNER;
    const repo = process.env.EXPO_PUBLIC_GITHUB_REPO;

    if (!owner || !repo) {
      return {
        success: false,
        error: 'GitHub owner and repo not configured',
      };
    }

    const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
    if (!token) {
      return {
        success: false,
        error: 'GitHub token not configured',
      };
    }

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

export interface InitRepositoryResponse {
  success: boolean;
  repoPath?: string;
  error?: string;
}

export async function initRepository(): Promise<InitRepositoryResponse> {
  try {
    const response = await request<InitRepositoryResponse>('/git/init', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return response;
  } catch (error: any) {
    console.warn('[GitApi] Failed to initialize repository:', error?.message ?? error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

