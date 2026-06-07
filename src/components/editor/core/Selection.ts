/// Represents a position within the document.
///
/// A position is defined by the block index and the character offset
/// within that block's content.
export interface DocumentPosition {
  readonly blockIndex: number;
  readonly offset: number;
}

/// Represents a selection in the document.
///
/// A selection has an anchor (where the selection started) and a focus
/// (where the selection currently ends). If anchor == focus, it's a
/// collapsed selection (cursor).
export interface DocumentSelection {
  readonly anchor: DocumentPosition;
  readonly focus: DocumentPosition;
}
