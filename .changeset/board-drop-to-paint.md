---
'@bemmoly/module-work': patch
'@bemmoly/ui': patch
---

Dragging a card on a large board feels instant again: the card shows in its new column in the
frame after you let go, as it did before 0.4.0, instead of a beat later. A drop now redraws only
the cards it moved, opening an issue or typing in the filter no longer redraws every card, and
the Backlog's rows no longer all redraw after each drop. A card's hover tools and a row's menu are
drawn the first time the pointer or the keyboard reaches them, so they look and work as before.
