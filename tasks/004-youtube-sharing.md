# Task 004: YouTube Sharing Integration

## Status

- ✅ Completed
- Roadmap entry: `Phase 14: YouTube Sharing Integration`

## Summary

Allow users to share YouTube videos to the app. A shared YouTube video will automatically create a resource note with the link attached. This involves investigating and implementing incoming intents on Android and share extensions on iOS to capture URLs shared from the YouTube app (or other apps).

## Original Overview

"Add this to the roadmap: allow users to share youtube videos to the app. A shared youtube video will become a resource note with the youtube video link attached to it. This involves investigation with the linking library: https://stackoverflow.com/questions/37653723/listening-for-incoming-links-on-android-with-react-native"

## Why This Matters

- Users often find content on YouTube that they want to save or take notes on later
- "Share to" is a standard mobile workflow for capturing external resources
- Automating the creation of a resource note with the video already attached saves multiple manual steps (create note, change type, paste link)
- Connects the existing `resource` note type and `EmbeddedVideoPanel` into a seamless capture flow

## Current State

- `resource` note type exists in `src/services/notes/types.ts` and `src/constants/noteTypes.ts`
- YouTube URL parsing and embedding are already implemented in `src/components/editor/video/videoUtils.ts` and `src/components/AttachVideoModal.tsx`
- The app supports deep linking via the `native` scheme (e.g., `native://...`) as configured in `app.config.js`
- There is no current handling for "Share to" (Android `SEND` intent or iOS Share Extension)

## Desired State

- When a user shares a YouTube video from the YouTube app to Keeper:
  - Keeper should open (if not already)
  - A new "resource" note should be created automatically
  - The YouTube video URL should be attached as a video block to the new note
  - The note title should ideally be pre-populated (e.g., "Resource: YouTube Video")
- Support both Android (intents) and iOS (share extension)
- Handle cases where the app is already open in the background versus a fresh launch

## Proposed Implementation Steps

- **Research (Android):**
  - Investigate `intent-filters` for `android.intent.action.SEND` in `app.config.js`
  - Determine if `expo-linking` is sufficient for capturing the shared text/URL, or if a custom native module (or a community library like `expo-sharing-intent`) is required
  - Reference the user-provided StackOverflow link for Android link listening patterns
- **Research (iOS):**
  - Investigate the implementation of a Share Extension in Expo (likely requires a config plugin or `expo-router` native hooks)
- **Shared Handler:**
  - Create a global handler (e.g., in `useAppStartup` or a dedicated hook) to listen for incoming share intents/links
  - Implement a `ShareService` or similar to process the incoming content:
    - Validate the URL using `videoUtils.ts`
    - Trigger `NoteService.saveNote` with `noteType: 'resource'` and initial content containing the video block
- **Editor Integration:**
  - Navigate the user to the newly created note's editor route
- **Tests:**
  - Add unit tests for the sharing handler and URL validation logic
  - Mock incoming intents to verify the note creation flow

## Candidate Files

- `app.config.js`
- `src/app/_layout.tsx`
- `src/hooks/useAppStartup.ts`
- `src/services/notes/NoteService.ts`
- `src/components/editor/video/videoUtils.ts`
- `src/app/editor.tsx`

## Acceptance Criteria

- Sharing a video from the YouTube app to Keeper results in a new resource note
- The new note contains the embedded video block for the shared URL
- The user is navigated to the editor for the new note
- The feature works on both Android and iOS (or at least Android initially if iOS is significantly more complex)
- The app handles the shared content whether it was already running or not

## Open Questions

- Should we fetch the video title from YouTube's oEmbed or API to populate the note title?
- How should we handle multiple shared items if the user shares more than one thing at once? (likely just take the first URL for now)
- Is a full Share Extension required for iOS, or is there a simpler URL-based approach that YouTube supports?
