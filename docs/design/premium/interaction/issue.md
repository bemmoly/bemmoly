# Issue page

**Primary job.** Read an issue as a document and change any of it without leaving the page.

**Top actions.** Move the status (the big button and its one-click next transitions); edit the
title, description and criteria in place; assign (Assign to me sits beside the assignee).

**Layout.** The `contained` reading column: the body on the left (title, ghost actions of one
size, the AI summary when AI is on, description, acceptance criteria, sub-issues, links,
activity) and the rail on the right (status, then Properties, Planning and People groups). On
phones the rail sits under the title as one column.

**Editing.**
- Title: a click turns the 26px heading into a field of the same type, caret at the end. Enter
  or leaving saves; Escape puts it back.
- Description: the rich editor saves as you type, with a quiet Saving, Saved or Not saved with
  Retry beside it.
- Acceptance criteria: a checklist with a met counter, stored in the description document so
  no field is needed. Add in place.
- Rail values edit in place; an empty value reads "Add …". The epic shows in its stored colour.
- Every edit shows at once. A refusal puts the old value back with a toast offering Retry.

**Undo over confirm.** A status change, a removed label, a removed link offer Undo in a toast
for about six seconds. Moving back through Undo can still be refused by the workflow; the
refusal says so with Retry.

**Keyboard.** ↑↓ and j k step through the list the issue was opened from (remembered per tab,
and "4 of 23" in the header stepper); nothing happens when the issue was opened from elsewhere.
Keys never fire while typing or inside a menu or dialog. Escape leaves a field without saving.

**States.**
- Loading: a skeleton with the final grid (body and rail), so nothing shifts.
- Not found / no access: "PLT-204 is not here", why it may be, and Go back.
- Server down: "could not be opened", Try again and Go back.
- Empty sections: Sub-issues and Links always show, with their add row as the empty state.
- AI off: the summary takes no room at all. AI on: the box is drawn in the AI lilac.

**Choices recorded.**
- Linking is inline in the Links section (relation, then issue by key or title). The older
  Link issue dialog file stays in place for the dialogs stream to restyle or retire.
- Lists (Board, Backlog, My issues) must call `useRememberIssueList` for j k to know their
  order; those screens belong to other streams and wire it there.
