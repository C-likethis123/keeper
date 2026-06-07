import type { NativeEventSubscription } from "react-native";
import { GitJournal } from "./gitJournal";
import { DefaultGitNativeBridge } from "./gitNativeBridge";
import { GitSyncManager } from "./gitSyncManager";
import type { FlushOptions, GitFlushResult } from "./gitSyncTypes";
import { AsyncGitSyncStateStore } from "./init/stateStore";
import type {
  GitExitLog,
  GitJournalEntry,
  GitJournalOperation,
} from "./init/types";

const stateStore = new AsyncGitSyncStateStore();
const gitJournal = new GitJournal(stateStore);
const gitSyncManager = new GitSyncManager(
  gitJournal,
  new DefaultGitNativeBridge(),
);

export class GitService {
  static readonly instance = new GitService();

  private appStateSubscription: NativeEventSubscription | null = null;

  private constructor() {
    this.appStateSubscription = gitSyncManager.createAppStateSubscription();
  }

  static withGitLock<T>(task: () => Promise<T>): Promise<T> {
    return gitSyncManager.withGitLock(task);
  }

  static queueChange(filePath: string, operation: GitJournalOperation): void {
    void GitService.queueChangeAsync(filePath, operation);
  }

  static async queueChangeAsync(
    filePath: string,
    operation: GitJournalOperation,
    note?: GitJournalEntry["note"],
  ): Promise<void> {
    await gitJournal.queueChange(filePath, operation, note);
  }

  static clearQueuedChanges(): void {
    void GitService.clearQueuedChangesAsync();
  }

  static async clearQueuedChangesAsync(): Promise<void> {
    gitSyncManager.cancelScheduledCommit();
    await gitJournal.clear();
  }

  static scheduleCommitBatch(delayMs?: number): void {
    gitSyncManager.scheduleCommitBatch(delayMs);
  }

  static registerBackgroundSaveHandler(
    handler: (() => Promise<void>) | null,
  ): void {
    gitSyncManager.registerBackgroundSaveHandler(handler);
  }

  static async saveCurrentEditorBeforeBackgroundFlush(): Promise<void> {
    await gitSyncManager.saveCurrentEditorBeforeBackgroundFlush();
  }

  static registerReconcileHandler(handler: (() => Promise<void>) | null): void {
    gitSyncManager.registerReconcileHandler(handler);
  }

  static triggerBackgroundCommit(reason: string): void {
    gitSyncManager.triggerBackgroundCommit(reason);
  }

  static hasPendingJournal(): Promise<boolean> {
    return gitJournal.hasPending();
  }

  static hasExitLogInJournal(): Promise<boolean> {
    return gitJournal.hasExitLog();
  }

  static getLatestExitLogFromJournal(): Promise<GitExitLog | null> {
    return gitJournal.getLatestExitLog();
  }

  static prepareRecoveryForRemoteSync(): Promise<void> {
    return gitSyncManager.prepareRecoveryForRemoteSync();
  }

  static restorePendingChangesFromJournal(): Promise<boolean> {
    return gitJournal.restorePendingChanges();
  }

  static recoverPendingChanges(): Promise<GitFlushResult> {
    return gitSyncManager.recoverPendingChanges();
  }

  static flushPendingChanges(
    options: FlushOptions & { recovery?: boolean },
  ): Promise<GitFlushResult> {
    return gitSyncManager.flushPendingChanges(options);
  }

  static async commitBatch(message?: string): Promise<void> {
    await gitSyncManager.commitBatch(message);
  }

  dispose(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}
