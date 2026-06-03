# Migration Plan: Removing MathBlock in favor of Lexical EquationNode

## Goal
Completely deprecate `src/components/editor/blocks/MathBlock.tsx` and move all math rendering logic to `EquationNode` (Lexical) which uses `MathView`.

## Current State
- `MathBlock` is used in `BlockMapper` and in the core editor model (`BlockNode.ts`).
- `EquationComponent` (Lexical) now uses `MathView`.

## Migration Steps

1.  **Refactor Core Model (If necessary)**
    - Determine if `createMathBlock` in `src/components/editor/core/BlockNode.ts` needs to remain for legacy support or if it can be replaced by a Lexical `EquationNode` creation helper.

2.  **Update BlockMapper**
    - Modify `src/components/editor/blocks/BlockMapper.tsx` to handle `math` block types by rendering the Lexical `EquationNode` instead of the legacy `MathBlock`.

3.  **Migrate/Deprecate Legacy Usages**
    - Search for remaining imports of `MathBlock`.
    - Update `src/components/editor/keyboard/enterCommands.ts` to reference `EquationNode` behavior instead of `MathBlock`.

4.  **Cleanup**
    - Remove `src/components/editor/blocks/MathBlock.tsx`.
    - Remove `createMathBlock` from `BlockNode.ts` / `Document.ts` if completely replaced.

## Risks
- Regression in math block rendering in legacy notes.
- Potential breaking changes in keyboard navigation (handled by `enterCommands.ts`).
