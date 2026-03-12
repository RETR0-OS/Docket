# Docket

A Chrome extension that lets you manage Google Calendar from any text field on the web. Type `::` to trigger a command palette — no tab-switching required.

## How it works

Type `::` in any input, textarea, or contenteditable field on any website. An autocomplete dropdown appears with available commands. Select one, fill in the date/time pickers that pop up, and Docket executes the action against your Google Calendar.

## Commands

| Command | Syntax | Description |
|---|---|---|
| `availability` | `::availability::` | Show free time slots for the current and next week |
| `schedule` | `::schedule <title> <date> <HH:MM> <HH:MM>::` | Create a new calendar event |
| `appointments` | `::appointments <date>::` | List all events on a given day |
| `reschedule` | `::reschedule <name> <date> <HH:MM> <HH:MM>::` | Move an existing event to a new time |
| `cancel` | `::cancel <date>::` | Delete an event (pick from a list for that day) |

**Date formats accepted:** `YYYY-MM-DD`, `today`, `tomorrow`, `yesterday`, `next <weekday>`, `this <weekday>`

**Multi-word titles** can be quoted: `::schedule "Team Standup" today 09:00 09:30::`

## Usage

1. Click into any text field on any website.
2. Type `::` — the command dropdown appears.
3. Arrow keys or Tab/Enter to select a command.
4. Use the date and time pickers that open automatically to fill placeholders.
5. The command fires when all placeholders are filled.

You can also type commands manually without the pickers — just complete the full `::command args::` syntax and it executes on the spot.

## Setup

### Prerequisites

- Node.js 18+
- A Google Cloud project with the Calendar API enabled and an OAuth2 Client ID configured for a Chrome extension

### Install & build

```bash
npm install
npm run build
```

The extension is output to `dist/`.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder
4. Sign in with your Google account when prompted

## Tech stack

- TypeScript + Vite
- Chrome Extension Manifest V3 (service worker + content script)
- Google OAuth2 via `chrome.identity`
- Shadow DOM for UI isolation (dropdown, overlays, date/time pickers)
- Google Calendar API v3
