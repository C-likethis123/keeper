- make select all once select within the current block. make select all multiple times select the whole document. 
    - rationale: so selecting all within the code block makes sense!

- wiki mode activation is weird. sometimes it's not activated at all. sometimes it's activated even without [[]]

- wiki dropdown does not fire when:
    1. escape a dropdown
    2. press enter to go to next block
    3. I am in the next block but the wiki dropdown cannot be removed now.

- sometimes undo and redo does not work because of some exception. It has to do with the focusedBlockIndex being out of range. Not sure how this could even happen!

- it does not listen to the code editor handlers :(
Now refactor key handlers:
1. code editor widget
    - escape: exits code block by going to the next item -> yes if I call a focus method directly. I don't think we want that. How do we handle escapes.
    - arrowdown: goes to the next line if it's the last line in the current block -> yes
    - arrowup: goes to the previous line in the current block -> yes
    - enter: handles smart editor, checks if we are between braces etc -> sometimes it works sometimes it doesn't
    - tab: indentation -> yes
    - backspace: brace deletion -> it does not delete everything, if it's between brackets it will show {}}  instead
    - normal keys: checks for brace completion


2. hybrid editor
    - engages key handler class (see 3)
    - escapes to end wiki mode -> works
    - handles next to go to the next item in the menu -> works

3. key handler class
    - key binding class, maps a key combination to an action
    - undo, redo -> works (somtimes I get errors, but should be ok)
    - select all -> does not work within code editor...`
    - escape to clear selection -> works. sometimes it doesn't.


4. editor's key handler
    - backspace: to remove selected blocks
    - split to get new blocks
    - arrows: goes to previous and next block
    - spaces: triggers new styles
    - paste: pasting image on block (does not work, add it in the global handler!)


- keyboard shortcut to select all should select the entire document
    - Drag to select blocks
    - typing while selected should replace the blocks (note: it's not like that in logseq)
    Shift + click / arrow range selection
    Cut / paste block ranges
    Multi-block transform (indent, toggle list)


## Add a toolbar for these:
- tables: other editors also dk how to render this in real time
- images: upload from disk




----
# Low priority, good to fix

- Refactor logic for blockselection:
    - data is needed in editorblockwidget. However the data is passed from hybrid editor -> block config -> editor block widget
    - there is `onDelete` and another deletion logic in handleKeyEvent.
    - key handling logic is all over the place

- Explore using 'freezed' for common serialisation like `note.dart`
- implement delete button for latex thing
The fix for "Losing focus on note creation":
- cannot make content only notes without the auto focus being cooked
- cannot enter for old and new notes
* Changed hybrid_editor.dart so that it only calls `setState` when there are new blocks added, not when there are changes to each and every block.
* This helps to fix the issue, but I can't help but think there's probably a better way to make changes than this.


- `inlinemarkdownrenderer` does not show the style once it's completed

- Can only delete blocks via clicking. Cannot delete via keyboard, if it's the first block in the row it would not be focused.
- HOLY I DID IT 

- I cannot trigger focus by clicking on any part of the document - others are also like this. Also it's not straightforward to add a placeholder.

- refactor the widgets code

- refactor keyboard shortcuts, it's too messy now.