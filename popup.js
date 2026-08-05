const STORAGE_KEY = "pretty-github-enabled";
const toggle = document.getElementById("toggle");

// Load current state (default: enabled).
chrome.storage.sync.get([STORAGE_KEY], (res) => {
  toggle.checked = res[STORAGE_KEY] !== false;
});

// Persist on change — the content script listens for this and re-applies live.
toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ [STORAGE_KEY]: toggle.checked });
});
