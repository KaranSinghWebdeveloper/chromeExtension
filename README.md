# Gmail Inbox Categorizer

A small Chrome extension that tags Naukri, Indeed and other job-site emails
in your Gmail inbox with a coloured label, and lets you hide those
categories with one click — so mail from actual clients stands out.

## Install (unpacked, for personal use)

1. Unzip this folder anywhere on your computer.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `gmail-categorizer` folder.
5. Open [Gmail](https://mail.google.com) (reload the tab if it was already open).

You'll see a small circular 📂 button in the bottom-right corner of Gmail,
and every recognised email gets a coloured left border + a small badge
next to its subject (e.g. `NAUKRI`, `INDEED`).

## Default categories

- **Naukri** — matches "naukri" (covers Naukri, Naukri360, Naukri Alerts)
- **Indeed** — matches "indeed"
- **Other Job Sites** — Cutshort, AmbitionBox, LinkedIn Jobs, Glassdoor, Internshala, Shine, Monster, Foundit, Instahyre, Hirect
- **Recruiter Outreach** — generic recruiter-invite phrases

Everything that doesn't match any category is left alone — that's your
"everything else" bucket, which is where client mail will show up.

## How to use it day-to-day

- Click the 📂 button to open the panel and see a live count per category.
- Toggle a category's checkbox off to hide just that category.
- Turn on **Focus mode** to hide *every* tagged email at once — what's
  left in your inbox is only mail the extension didn't recognise.
- Turn Focus mode back off (or toggle categories back on) to bring
  everything back. Nothing is deleted or archived — this only changes
  what's shown while you're on the page.

## Customize categories & keywords

Click the extension icon in Chrome's toolbar to open the popup:

- Add a new category with **+ New category**, pick a colour, and give it a name.
- Type a keyword (e.g. `agicent`, `viral pitch`, or a specific client's domain
  like `acmecorp.com`) and press **Enter** to add it as a chip. You can add
  as many keywords as you like per category.
- Click the ✕ on a chip to remove that keyword, or the ✕ on a category
  card to delete the whole category.
- "Hide this category in Gmail" pre-hides that category by default.

A category matches when any of its keywords appears anywhere in the
sender's name, sender's email address, or the subject line — matching is
case-insensitive and works on partial text (e.g. keyword `indeed` matches
sender "Indeed Apply").

## Notes / limitations

- This only changes what's displayed in the currently open Gmail tab —
  it doesn't move, label, archive, or delete anything on Google's servers,
  so it's fully reversible and safe to try.
- It works on the standard Gmail inbox/list view. Gmail occasionally
  changes its internal HTML; if badges stop appearing after a Gmail
  redesign, the CSS selectors in `content.js` (`getRowText`) may need a
  small update.
- Settings sync via `chrome.storage.sync`, so they follow you if you're
  signed into the same Chrome profile on another machine.
