import http from 'isomorphic-git/http/web';
import type { HttpClient, GitHttpRequest, GitHttpResponse } from 'isomorphic-git';

/**
 * Creates an HTTP client for isomorphic-git with enhanced error handling.
 * Wraps isomorphic-git/http/web to provide better error messages for common scenarios.
 * 
 * @param owner - GitHub repository owner (for error messages)
 * @param repo - GitHub repository name (for error messages)
 * @returns Configured HTTP client compatible with isomorphic-git
 */
export function createGitHttpClient(owner?: string, repo?: string): HttpClient {
    return {
        async request(request: GitHttpRequest): Promise<GitHttpResponse> {
            try {
                const response = await http.request(request);

                if (response.statusCode && response.statusCode >= 400) {
                    if (response.statusCode === 401 || response.statusCode === 403) {
                        throw new Error(
                            `Authentication failed: Invalid or expired GitHub token (HTTP ${response.statusCode}). ` +
                            `Check token permissions and ensure it has 'repo' scope.`
                        );
                    } else if (response.statusCode === 404) {
                        if (owner && repo) {
                            throw new Error(`Repository not found: ${owner}/${repo}`);
                        } else {
                            throw new Error(`Resource not found (HTTP ${response.statusCode})`);
                        }
                    } else {
                        throw new Error(`HTTP ${response.statusCode}: ${response.statusMessage || 'Unknown error'}`);
                    }
                }

                return response;
            } catch (error) {
                if (error instanceof TypeError && error.message.includes('fetch')) {
                    throw new Error('Network error: Unable to connect to GitHub. Check your internet connection');
                }

                const errorMsg = error instanceof Error ? error.message : String(error);
                if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized') || errorMsg.includes('Forbidden')) {
                    throw new Error(
                        `Authentication failed: Invalid or expired GitHub token. ` +
                        `Check token permissions and ensure it has 'repo' scope.`
                    );
                }

                if (error instanceof Error && (
                    error.message.includes('Authentication failed') ||
                    error.message.includes('Repository not found') ||
                    error.message.includes('Network error')
                )) {
                    throw error;
                }

                throw error;
            }
        },
    };
}

