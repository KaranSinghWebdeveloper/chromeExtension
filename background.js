// Runs once when the extension is installed or updated.
// Seeds sensible default categories so the extension works out of the box.

const DEFAULT_CATEGORIES = [
  {
    id: "naukri",
    name: "Naukri",
    color: "#2563eb",
    keywords: ["naukri"],
    enabled: true,
    hidden: false
  },
  {
    id: "indeed",
    name: "Indeed",
    color: "#f97316",
    keywords: ["indeed"],
    enabled: true,
    hidden: false
  },
  {
    id: "jobsites",
    name: "Other Job Sites",
    color: "#9333ea",
    keywords: [
      "cutshort",
      "ambitionbox",
      "linkedin job",
      "glassdoor",
      "internshala",
      "shine.com",
      "monster",
      "foundit",
      "instahyre",
      "hirect"
    ],
    enabled: true,
    hidden: false
  },
  {
    id: "recruiters",
    name: "Recruiter Outreach",
    color: "#0d9488",
    keywords: [
      "job invite",
      "we've been looking for candidates",
      "you've been chosen",
      "job |",
      "career opportunity",
      "hiring for"
    ],
    enabled: true,
    hidden: false
  }
];

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.sync.get(["categories", "focusMode"]);
  if (!existing.categories) {
    await chrome.storage.sync.set({
      categories: DEFAULT_CATEGORIES,
      focusMode: false,
      extensionEnabled: true,
      isolateCategories: []
    });
  }
});
