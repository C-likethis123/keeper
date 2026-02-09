# CodeBlock Tests

This directory contains automated tests for the CodeBlock component, focusing on brace completion and cursor positioning functionality.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npm test CodeBlock.brace-completion.test.tsx
```

## Test Structure

### CodeBlock.brace-completion.test.tsx

Comprehensive tests for brace completion and cursor positioning:

1. **Opening Brace Insertion**
   - Tests that typing opening braces (`(`, `{`, `[`, `<`, `"`, `'`, `` ` ``) automatically inserts matching closing braces
   - Verifies all supported brace types work correctly

2. **Cursor Positioning After Brace Insertion**
   - Ensures cursor is positioned between braces after insertion
   - Tests cursor positioning with existing text

3. **Preserving Closing Brace When Typing Inside**
   - Verifies that closing braces are preserved when typing inside brace pairs
   - Tests with different brace types
   - Tests with multiple characters

4. **Complex Scenarios**
   - Nested braces
   - Typing at end of text with braces
   - Preventing duplicate closing braces

5. **Edge Cases**
   - Backspace handling
   - Rapid typing
   - Various edge conditions

## Test Utilities

The tests use helper functions to simulate user interactions:

- `simulateTyping()` - Simulates typing a character with proper selection updates
- `getTextInput()` - Retrieves the TextInput component from the rendered tree

## Mocking

The tests mock:
- `SyntaxHighlighter` component
- `CodeBlockHeader` component
- Expo modules (clipboard, etc.)
- Custom hooks (useExtendedTheme)

## Writing New Tests

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use the helper functions for consistency
3. Mock external dependencies appropriately
4. Test both positive and negative cases
5. Include edge cases and error scenarios

## Example Test

```typescript
it('should insert closing parenthesis when opening parenthesis is typed', async () => {
  const { UNSAFE_root } = render(<CodeBlock {...defaultProps} />);
  const textInput = getTextInput(UNSAFE_root);

  // Type '('
  simulateTyping(textInput, '', '(', 1);

  await waitFor(() => {
    expect(textInput.props.value || textInput._fiber.memoizedProps.defaultValue).toBe('()');
  });
});
```

