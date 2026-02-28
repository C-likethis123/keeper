# wikilink overlay

## Selection

Currently it is implemented as a View + Pressable.
However clicking on it closes the overlay. This makes clicking and scrolling impossible.

To make clicking and scrolling possible, we can wrap it in a Modal so it can receive click events. However, this dismisses the keyboard so searching is not possible.

Goal: Find a solution so that it can support:
- clicking to select an option
- scrolling to view more options
- pressing enter to select an option
- key up and down to navigate to and fro options
- pressing away to dismiss the wikilink

## Scroll view

- keyboard avoiding view
    - extremely problematic, blocks randomly goes missing