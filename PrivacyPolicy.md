# Privacy Policy for Docket

**Last updated: March 12, 2026**

## Overview

Docket is a Chrome extension that lets you manage Google Calendar events by typing commands directly into text fields on any webpage. This policy explains what data the extension accesses, how it is used, and how it is stored.

**The short version: Docket does not collect, transmit, or store any user data on any external server. All data stays on your device or goes directly to Google.**

---

## Data We Access

### Google Account & Calendar Data
To function, Docket requires access to your Google account via OAuth 2.0. With your explicit consent, the extension is granted permission to:
- Read your Google Calendar events
- Create, update, and delete calendar events on your behalf
- Read your account email address (used solely to display who is signed in)

This data is accessed in real time from Google's servers and is never transmitted to any server operated by the developer.

### Working Hours Preference
The extension allows you to configure your working hours (days and time ranges). This preference is stored locally using Chrome's built-in `storage.sync` API, which syncs it across your own Chrome-signed-in devices via Google's Chrome sync infrastructure. This data never leaves Google's ecosystem and is never accessible to the developer.

---

## Data Storage

| Data | Where stored | Duration |
|---|---|---|
| Your email address | `chrome.storage.sync` (local/Chrome sync) | Until you sign out |
| Working hours preference | `chrome.storage.sync` (local/Chrome sync) | Until you change or clear it |
| OAuth access token | `chrome.storage.session` (in-memory only) | Until the browser session ends |

No data is stored on any external database, server, or third-party service operated by the developer.

---

## Data Sharing

Docket does not share, sell, rent, or transmit your data to any third party. The only external services the extension communicates with are:

- **Google OAuth** (`accounts.google.com`) — to authenticate your Google account
- **Google Calendar API** (`googleapis.com/calendar/v3`) — to read and modify your calendar events
- **Google Userinfo API** (`googleapis.com/oauth2/v2/userinfo`) — to retrieve your email address at sign-in

All communication with these services is governed by [Google's Privacy Policy](https://policies.google.com/privacy).

---

## Permissions Explained

- **Identity**: Required to authenticate you with Google via OAuth 2.0.
- **Storage**: Required to save your working hours preference and remember your signed-in email across sessions.
- **Host permissions (`<all_urls>`)**: Required to inject the command interface into text fields across all websites, so you can trigger calendar commands from any page.

---

## Data Deletion

You can remove all locally stored data at any time by:
1. Signing out from the Docket extension popup, which clears your stored email and OAuth token.
2. Uninstalling the extension, which removes all associated Chrome storage data.

---

## Children's Privacy

Docket is not directed at children under 13 and does not knowingly collect any information from children.

---

## Changes to This Policy

If this policy changes, the updated version will be posted to this page with a revised date. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## Contact

If you have questions about this privacy policy, please open an issue at the extension's GitHub repository.
