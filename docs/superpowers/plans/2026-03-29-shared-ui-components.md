# Shared UI Components Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify and extract the three most impactful duplicated UI patterns into shared components/hooks, reducing repeated code across the codebase.

**Architecture:** Three independent extractions: (1) `FilterChip` shared component used across filter bars and the note editor, (2) `IconButton` shared component for the editor toolbar's repeated pressable+icon pattern, (3) `useBlockInputHandlers` custom hook eliminating identical event handler logic duplicated across `ImageBlock` and `VideoBlock`.

**Tech Stack:** React Native, TypeScript, Expo, Jest + `jest-expo` + React Native Testing Library

---

## File Structure

**Create:**
- `src/components/shared/FilterChip.tsx` — shared pill chip with selected state
- `src/components/shared/__tests__/FilterChip.jest.test.tsx` — render + interaction tests
- `src/components/shared/IconButton.tsx` — square icon button with disabled state
- `src/components/shared/__tests__/IconButton.jest.test.tsx` — render + disabled tests
- `src/components/editor/blocks/useBlockInputHandlers.ts` — shared focus/keypress/selection hook
- `src/components/editor/blocks/__tests__/useBlockInputHandlers.jest.test.tsx` — hook behavior tests

**Modify:**
- `src/components/NoteFiltersBar.tsx` — remove local `FilterChip`, import shared
- `src/components/NoteEditorView.tsx` — replace `optionChip` pattern with shared `FilterChip`; remove `optionChip`/`optionChipSelected`/`optionChipText`/`optionChipTextSelected` styles
- `src/components/editor/EditorToolbar.tsx` — replace each repeated `TouchableOpacity`+`MaterialIcons` block with `IconButton`
- `src/components/editor/blocks/ImageBlock.tsx` — replace inline handlers with `useBlockInputHandlers`
- `src/components/editor/blocks/VideoBlock.tsx` — replace inline handlers with `useBlockInputHandlers`

---

## Task 1: Create shared `FilterChip` component

**Files:**
- Create: `src/components/shared/FilterChip.tsx`
- Create: `src/components/shared/__tests__/FilterChip.jest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/__tests__/FilterChip.jest.test.tsx
import { FilterChip } from "@/components/shared/FilterChip";
import { render, fireEvent } from "@testing-library/react-native";
import React from "react";

describe("FilterChip", () => {
  it("renders its label", () => {
    const { getByText } = render(
      <FilterChip label="Journals" selected={false} onPress={() => {}} />,
    );
    expect(getByText("Journals")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <FilterChip label="Todos" selected={false} onPress={onPress} />,
    );
    fireEvent.press(getByText("Todos"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders without error when selected", () => {
    const { getByText } = render(
      <FilterChip label="Notes" selected={true} onPress={() => {}} />,
    );
    expect(getByText("Notes")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="FilterChip.jest" --no-coverage
```

Expected: FAIL — cannot find module `@/components/shared/FilterChip`

- [ ] **Step 3: Create the component**

```tsx
// src/components/shared/FilterChip.tsx
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    chipTextSelected: {
      color: theme.colors.primaryContrast,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="FilterChip.jest" --no-coverage
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/FilterChip.tsx src/components/shared/__tests__/FilterChip.jest.test.tsx
git commit -m "feat: add shared FilterChip component"
```

---

## Task 2: Use shared `FilterChip` in `NoteFiltersBar`

**Files:**
- Modify: `src/components/NoteFiltersBar.tsx`

- [ ] **Step 1: Remove the local `FilterChip` function and import the shared one**

In `src/components/NoteFiltersBar.tsx`, delete lines 27–50 (the local `FilterChip` function) and add the import at the top:

```tsx
import { FilterChip } from "@/components/shared/FilterChip";
```

Also remove `useMemo` from the import if it is no longer used in the file (it is also used in the `NoteFiltersBar` function itself for `createStyles`, so keep it).

The `NoteFiltersBar` function body and `createStyles` are unchanged. The component already uses `<FilterChip>` by name, so after removing the local declaration and adding the import it will point to the shared version.

- [ ] **Step 2: Verify the linter is happy**

```bash
npm run lint
```

Expected: no errors relating to `NoteFiltersBar.tsx`

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all previously passing tests still pass

- [ ] **Step 4: Commit**

```bash
git add src/components/NoteFiltersBar.tsx
git commit -m "refactor: use shared FilterChip in NoteFiltersBar"
```

---

## Task 3: Use shared `FilterChip` in `NoteEditorView`

**Files:**
- Modify: `src/components/NoteEditorView.tsx`

The `NoteEditorView` renders todo-status option chips using a manual `TouchableOpacity` + `Text` pair with local `optionChip`/`optionChipSelected`/`optionChipText`/`optionChipTextSelected` styles. Replace them with `<FilterChip>`.

- [ ] **Step 1: Add the import**

At the top of `src/components/NoteEditorView.tsx`, add:

```tsx
import { FilterChip } from "@/components/shared/FilterChip";
```

- [ ] **Step 2: Replace the optionChip JSX block**

Find the `TODO_STATUS_OPTIONS.map` block (around line 336) that looks like this:

```tsx
{TODO_STATUS_OPTIONS.map((option) => {
  const selected = (todoStatus ?? "open") === option.value;
  return (
    <TouchableOpacity
      key={option.value}
      style={[
        styles.optionChip,
        selected && styles.optionChipSelected,
      ]}
      onPress={() => {
        setTodoStatus(option.value);
      }}
    >
      <Text
        style={[
          styles.optionChipText,
          selected && styles.optionChipTextSelected,
        ]}
      >
        {option.label}
      </Text>
    </TouchableOpacity>
  );
})}
```

Replace it with:

```tsx
{TODO_STATUS_OPTIONS.map((option) => (
  <FilterChip
    key={option.value}
    label={option.label}
    selected={(todoStatus ?? "open") === option.value}
    onPress={() => setTodoStatus(option.value)}
  />
))}
```

- [ ] **Step 3: Remove dead styles**

In the `createStyles` function at the bottom of `NoteEditorView.tsx`, delete these four style entries:

```
optionChip: { ... },
optionChipSelected: { ... },
optionChipText: { ... },
optionChipTextSelected: { ... },
```

- [ ] **Step 4: Verify lint and tests pass**

```bash
npm run lint && npm test -- --no-coverage
```

Expected: no errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/NoteEditorView.tsx
git commit -m "refactor: use shared FilterChip for todo status chips in NoteEditorView"
```

---

## Task 4: Create shared `IconButton` component

The `EditorToolbar` repeats the same `TouchableOpacity` (40×40 rounded, bordered) + `MaterialIcons` pattern six times, differing only in icon name, `disabled` boolean, and `onPress` handler.

**Files:**
- Create: `src/components/shared/IconButton.tsx`
- Create: `src/components/shared/__tests__/IconButton.jest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/__tests__/IconButton.jest.test.tsx
import { IconButton } from "@/components/shared/IconButton";
import { render, fireEvent } from "@testing-library/react-native";
import React from "react";

describe("IconButton", () => {
  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <IconButton name="undo" onPress={onPress} testID="btn" />,
    );
    fireEvent.press(getByTestId("btn"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <IconButton name="undo" onPress={onPress} disabled testID="btn" />,
    );
    fireEvent.press(getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="IconButton.jest" --no-coverage
```

Expected: FAIL — cannot find module `@/components/shared/IconButton`

- [ ] **Step 3: Create the component**

```tsx
// src/components/shared/IconButton.tsx
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

export function IconButton({
  name,
  size = 24,
  onPress,
  disabled = false,
  testID,
}: {
  name: MaterialIconName;
  size?: number;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useExtendedTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      testID={testID}
    >
      <MaterialIcons
        name={name}
        size={size}
        color={disabled ? theme.colors.textDisabled : theme.colors.text}
      />
    </TouchableOpacity>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  return StyleSheet.create({
    button: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="IconButton.jest" --no-coverage
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/IconButton.tsx src/components/shared/__tests__/IconButton.jest.test.tsx
git commit -m "feat: add shared IconButton component"
```

---

## Task 5: Use shared `IconButton` in `EditorToolbar`

**Files:**
- Modify: `src/components/editor/EditorToolbar.tsx`

- [ ] **Step 1: Add the import**

In `src/components/editor/EditorToolbar.tsx`, add:

```tsx
import { IconButton } from "@/components/shared/IconButton";
```

Remove `MaterialIcons` from the import if it is no longer used directly (it won't be after this step).

- [ ] **Step 2: Replace each repeated `TouchableOpacity`+`MaterialIcons` block**

The toolbar currently has six near-identical button blocks. Replace the entire `<View style={styles.toolbar}>` JSX body with:

```tsx
<View style={styles.toolbar}>
  <IconButton
    name="undo"
    onPress={() => executeEditorCommand("undo", commandContext)}
    disabled={!canUndo}
  />
  <IconButton
    name="redo"
    onPress={() => executeEditorCommand("redo", commandContext)}
    disabled={!canRedo}
  />
  <IconButton
    name="format-indent-increase"
    onPress={handleIndent}
    disabled={!canIndent}
  />
  <IconButton
    name="format-indent-decrease"
    onPress={handleOutdent}
    disabled={!canOutdent}
  />
  <IconButton
    name="check-box-outline-blank"
    onPress={handleConvertToCheckbox}
    disabled={!canConvertToCheckbox}
  />
  {Platform.OS !== "web" ? (
    <IconButton name="add-photo-alternate" onPress={handleInsertImage} />
  ) : (
    <Text>TODO: Insert Image</Text>
  )}
</View>
```

- [ ] **Step 3: Remove dead styles**

In `createStyles` at the bottom of `EditorToolbar.tsx`, delete the `button` style entry:

```
button: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: theme.colors.background,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 1,
  borderColor: theme.colors.border,
},
```

- [ ] **Step 4: Remove unused imports**

If `MaterialIcons` is no longer imported directly in the file, remove it from the import list. Also remove `Text` from `react-native` imports if only used for the web placeholder (keep it — `<Text>TODO: Insert Image</Text>` still uses it).

- [ ] **Step 5: Verify lint and tests pass**

```bash
npm run lint && npm test -- --no-coverage
```

Expected: no errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/EditorToolbar.tsx
git commit -m "refactor: use shared IconButton in EditorToolbar"
```

---

## Task 6: Create `useBlockInputHandlers` hook

`ImageBlock` and `VideoBlock` have near-identical `handleFocus`, `handleKeyPress`, and `handleSelectionChange` implementations. Extract them into a hook.

**Files:**
- Create: `src/components/editor/blocks/useBlockInputHandlers.ts`
- Create: `src/components/editor/blocks/__tests__/useBlockInputHandlers.jest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/blocks/__tests__/useBlockInputHandlers.jest.test.tsx
import { useBlockInputHandlers } from "@/components/editor/blocks/useBlockInputHandlers";
import { renderHook, act } from "@testing-library/react-native";
import React from "react";

// Mock dependencies
jest.mock("@/hooks/useFocusBlock", () => ({
  useFocusBlock: () => ({ focusBlock: jest.fn() }),
}));
jest.mock("@/stores/editorStore", () => ({
  useEditorBlockSelection: () => ({ start: 0, end: 0 }),
}));
jest.mock(
  "@/components/editor/keyboard/useVerticalArrowNavigation",
  () => ({
    useVerticalArrowNavigation: () => () => false,
  }),
);

describe("useBlockInputHandlers", () => {
  const baseProps = {
    index: 2,
    isFocused: false,
    onEnter: jest.fn(),
    onBackspaceAtStart: jest.fn(),
    onSelectionChange: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("returns handleFocus, handleKeyPress, handleSelectionChange", () => {
    const { result } = renderHook(() => useBlockInputHandlers(baseProps));
    expect(typeof result.current.handleFocus).toBe("function");
    expect(typeof result.current.handleKeyPress).toBe("function");
    expect(typeof result.current.handleSelectionChange).toBe("function");
  });

  it("calls onSelectionChange with index and coordinates on selection event", () => {
    const onSelectionChange = jest.fn();
    const { result } = renderHook(() =>
      useBlockInputHandlers({ ...baseProps, onSelectionChange }),
    );
    act(() => {
      result.current.handleSelectionChange({
        nativeEvent: { selection: { start: 3, end: 7 } },
      } as any);
    });
    expect(onSelectionChange).toHaveBeenCalledWith(2, 3, 7);
  });

  it("calls onBackspaceAtStart when Backspace pressed at position 0", () => {
    const onBackspaceAtStart = jest.fn();
    const { result } = renderHook(() =>
      useBlockInputHandlers({ ...baseProps, onBackspaceAtStart }),
    );
    act(() => {
      result.current.handleKeyPress({
        nativeEvent: { key: "Backspace" },
      } as any);
    });
    expect(onBackspaceAtStart).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="useBlockInputHandlers.jest" --no-coverage
```

Expected: FAIL — cannot find module `@/components/editor/blocks/useBlockInputHandlers`

- [ ] **Step 3: Create the hook**

```ts
// src/components/editor/blocks/useBlockInputHandlers.ts
import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockSelection } from "@/stores/editorStore";
import { useCallback } from "react";
import type {
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  TextInputSelectionChangeEventData,
} from "react-native";
import type { BlockConfig } from "./BlockRegistry";

export function useBlockInputHandlers({
  index,
  isFocused,
  onEnter,
  onBackspaceAtStart,
  onSelectionChange,
}: {
  index: number;
  isFocused: boolean;
  onEnter: BlockConfig["onEnter"];
  onBackspaceAtStart: BlockConfig["onBackspaceAtStart"];
  onSelectionChange: BlockConfig["onSelectionChange"];
}) {
  const { focusBlock } = useFocusBlock();
  const selection = useEditorBlockSelection(index);
  const handleVerticalArrow = useVerticalArrowNavigation(index, selection);

  const handleFocus = useCallback(() => {
    if (isFocused) return;
    focusBlock(index);
  }, [focusBlock, index, isFocused]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;
      if (handleVerticalArrow(key)) return;
      if (key === "Enter" && selection && selection.start === selection.end) {
        onEnter(index, selection.end);
      }
      if (key === "Backspace" && selection?.start === 0 && selection?.end === 0) {
        onBackspaceAtStart(index);
      }
    },
    [handleVerticalArrow, index, onBackspaceAtStart, onEnter, selection],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      onSelectionChange(
        index,
        e.nativeEvent.selection.start,
        e.nativeEvent.selection.end,
      );
    },
    [onSelectionChange, index],
  );

  return { handleFocus, handleKeyPress, handleSelectionChange, selection };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="useBlockInputHandlers.jest" --no-coverage
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/blocks/useBlockInputHandlers.ts src/components/editor/blocks/__tests__/useBlockInputHandlers.jest.test.tsx
git commit -m "feat: add useBlockInputHandlers hook to share block event logic"
```

---

## Task 7: Use `useBlockInputHandlers` in `ImageBlock` and `VideoBlock`

**Files:**
- Modify: `src/components/editor/blocks/ImageBlock.tsx`
- Modify: `src/components/editor/blocks/VideoBlock.tsx`

### ImageBlock

- [ ] **Step 1: Update imports in `ImageBlock.tsx`**

Replace:
```tsx
import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockSelection } from "@/stores/editorStore";
```
With:
```tsx
import { useBlockInputHandlers } from "@/components/editor/blocks/useBlockInputHandlers";
```

- [ ] **Step 2: Replace inline handlers in `ImageBlock`**

Remove these lines from the `ImageBlock` function body:
```tsx
const { focusBlock } = useFocusBlock();
const inputRef = useRef<TextInput | null>(null);
const selection = useEditorBlockSelection(index);
// ...
const handleVerticalArrow = useVerticalArrowNavigation(index, selection);
const handleFocus = useCallback(() => { ... }, [...]);
const handleKeyPress = useCallback((e) => { ... }, [...]);
const handleSelectionChange = useCallback((e) => { ... }, [...]);
```

Replace them with:
```tsx
const inputRef = useRef<TextInput | null>(null);
const { handleFocus, handleKeyPress, handleSelectionChange } =
  useBlockInputHandlers({ index, isFocused, onEnter, onBackspaceAtStart, onSelectionChange });
```

The rest of the component JSX (`<Pressable>`, `<Image>`, `<TextInput>`) is unchanged — the same handler names are still wired to the same props.

- [ ] **Step 3: Remove unused imports from `ImageBlock.tsx`**

Remove `useCallback` from the React import (if no other `useCallback` remains in the file after the handler removal). Keep `useRef`.

- [ ] **Step 4: Verify lint passes**

```bash
npm run lint -- src/components/editor/blocks/ImageBlock.tsx
```

Expected: no errors

### VideoBlock

- [ ] **Step 5: Update imports in `VideoBlock.tsx`**

Replace:
```tsx
import { useVerticalArrowNavigation } from "@/components/editor/keyboard/useVerticalArrowNavigation";
import { useFocusBlock } from "@/hooks/useFocusBlock";
import { useEditorBlockSelection } from "@/stores/editorStore";
```
With:
```tsx
import { useBlockInputHandlers } from "@/components/editor/blocks/useBlockInputHandlers";
```

- [ ] **Step 6: Replace inline handlers in `VideoBlock`**

Remove from the `VideoBlock` function body:
```tsx
const { focusBlock } = useFocusBlock();
const inputRef = useRef<TextInput | null>(null);
const selection = useEditorBlockSelection(index);
const handleVerticalArrow = useVerticalArrowNavigation(index, selection);
const handleFocus = useCallback(() => { ... }, [...]);
const handleKeyPress = useCallback((e) => { ... }, [...]);
const handleSelectionChange = useCallback((e) => { ... }, [...]);
```

Replace with:
```tsx
const inputRef = useRef<TextInput | null>(null);
const { handleFocus, handleKeyPress, handleSelectionChange, selection } =
  useBlockInputHandlers({ index, isFocused, onEnter, onBackspaceAtStart, onSelectionChange });
```

Note: `VideoBlock` uses `selection` in the JSX (`selection && selection.start === selection.end` — this is inside `handleKeyPress` now, but `selection` is also exposed from the hook return value for any direct JSX needs). The hook returns `selection` so it remains available.

- [ ] **Step 7: Remove unused imports from `VideoBlock.tsx`**

Remove `useCallback` from the React import if no other `useCallback` remains. Keep `useRef` and `useState`.

- [ ] **Step 8: Run full test suite and lint**

```bash
npm run lint && npm test -- --no-coverage
```

Expected: no errors, all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/editor/blocks/ImageBlock.tsx src/components/editor/blocks/VideoBlock.tsx
git commit -m "refactor: use useBlockInputHandlers in ImageBlock and VideoBlock"
```

---

## Verification

After all tasks are complete, run the full suite one final time:

```bash
npm run lint && npm test -- --no-coverage
```

Expected: all tests green, no lint errors.
