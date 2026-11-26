# Add phone support

## Why

The board already fits a narrow desktop panel but needs host opt-in and touch behavior to work on
a phone.

## What changes

- Offer the board and page in OpenChamber phone clients.
- Size coarse-pointer controls for touch and keep dialogs and detail controls clear of the
  keyboard and safe-area insets.
- Restore focus to a non-text control after closing or deleting a change on a phone.

This change restores the phone-board requirements from `add-session-section-and-mobile`. Work
Status and its phone layout remain in the Work Status change.
