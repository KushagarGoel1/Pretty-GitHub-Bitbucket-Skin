/*
 * Pretty GitHub — Bitbucket Skin
 * - Adds a body marker so the CSS skin can be toggled on/off, and keeps it
 *   applied across GitHub's SPA (Turbo) navigations.
 * - In DARK mode, recolors the modern React diff (data-testid="diff-content")
 *   to Bitbucket's light diff palette. This is done in JS rather than CSS
 *   because GitHub paints add/del backgrounds via inline styles that reference
 *   registered custom properties, which external CSS (even !important) cannot
 *   reliably override. Setting the color inline on each cell always wins.
 * No network, no auth, no data collection.
 */
(function () {
  "use strict";

  const CLASS = "pretty-github-bb";
  const STORAGE_KEY = "pretty-github-enabled";

  // Bitbucket palette (sampled from a real Bitbucket diff).
  const BB = {
    surface: "#ffffff",
    text: "#172b4d",
    addLine: "#e3fcef",
    addNum: "#abf5d1",
    delLine: "#ffebe6",
    delNum: "#ffbdad",
    neutralNum: "#f4f5f7",
    hunk: "#eef4ff",
  };

  let enabled = true;
  let observer = null;

  // --- Page gate: only skin the PR diff / "Files changed" view ---
  // Everywhere else on github.com (repo home, issues, code browser, etc.) must
  // stay stock. We detect the diff view by URL (available immediately, even
  // before the diff DOM streams in) OR by the presence of the diff container.
  function onDiffPage() {
    // URLs: /owner/repo/pull/123/files  and the SPA variant /pull/123/changes
    if (/\/pull\/\d+\/(files|changes)\b/.test(location.pathname)) return true;
    // Fallback: the modern diff region is present.
    return !!document.querySelector('[data-testid="diff-content"], [data-testid="progressive-diffs-list"]');
  }

  // --- Dark-mode detection (matches GitHub's own signals) ---
  function isDark() {
    const html = document.documentElement;
    const mode = html.getAttribute("data-color-mode");
    if (mode === "dark") return true;
    if (mode === "auto") {
      if (html.hasAttribute("data-dark-theme")) {
        // "auto" + a dark-theme attr; also honor OS preference.
        return (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ) || html.getAttribute("data-dark-theme") != null;
      }
    }
    return false;
  }

  // --- Recolor one diff cell based on the marker in its inline style/class ---
  function recolorCell(td) {
    // `style` attr still carries GitHub's original var reference the first time;
    // after we set our own bg it won't, so we also stamp a data-attr so repeated
    // passes remain correct without re-reading the (now-overwritten) style.
    let kind = td.getAttribute("data-bb-kind");
    if (!kind) {
      const st = td.getAttribute("style") || "";
      const cls = td.className || "";
      if (st.indexOf("addition") !== -1) kind = "add";
      else if (st.indexOf("deletion") !== -1) kind = "del";
      else if (/diff-line-number-neutral/.test(cls)) kind = "neutral";
      else if (/hunk/.test(cls)) kind = "hunk";
      else kind = "plain";
      td.setAttribute("data-bb-kind", kind);
    }
    const isNum = /line-number/.test(td.className || "");
    let bg = null;
    switch (kind) {
      case "add": bg = isNum ? BB.addNum : BB.addLine; break;
      case "del": bg = isNum ? BB.delNum : BB.delLine; break;
      case "neutral": bg = BB.neutralNum; break;
      case "hunk": bg = isNum ? BB.neutralNum : BB.hunk; break;
      // A plain line-number cell is an EMPTY gutter (e.g. the old-side column on a
      // new-file hunk). GitHub fills these navy; Bitbucket uses the neutral gray
      // gutter. Non-gutter plain cells stay white.
      case "plain": bg = isNum ? BB.neutralNum : BB.surface; break;
    }
    if (bg) td.style.setProperty("background-color", bg, "important");
    td.style.setProperty("color", BB.text, "important");

    // Word-level intra-line highlights (span.x). GitHub paints them a heavy
    // translucent green/red with rounded corners; Bitbucket uses a softer SOLID
    // tint with square corners. The cell holding a word highlight often carries
    // NO addition/deletion marker itself (only the .x spans are colored), so we
    // can't use the cell's kind. Instead we classify each .x by its own native
    // background — greenish = addition, reddish = deletion — then recolor it.
    // (Same inline-style requirement as cells: color comes from a registered
    // custom prop, so only an inline style wins.)
    recolorWords(td);
  }

  // Classify a .x word-highlight by its current (native) background and repaint
  // it in Bitbucket's softer solid tint with square corners. Idempotent via a
  // data-bb-x stamp so we don't re-read a color we already changed.
  function recolorWords(scope) {
    const words = scope.querySelectorAll(".x");
    for (let w = 0; w < words.length; w++) {
      const el = words[w];
      if (el.getAttribute("data-bb-x")) continue;
      const c = getComputedStyle(el).backgroundColor;
      const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (!m) continue;
      const r = +m[1], g = +m[2], b = +m[3];
      let wordBg = null;
      if (g > r + 8 && g > b + 8) wordBg = BB.addNum;      // greenish -> addition
      else if (r > g + 8 && r > b + 8) wordBg = BB.delNum; // reddish  -> deletion
      if (wordBg) {
        el.style.setProperty("background-color", wordBg, "important");
        el.style.setProperty("border-radius", "0", "important");
        el.setAttribute("data-bb-x", "1");
      }
    }
  }

  function recolorAll(root) {
    if (!enabled || !isDark()) return;
    const scope = (root && root.querySelectorAll) ? root : document;
    const cells = scope.querySelectorAll('[data-testid="diff-content"] td');
    for (let i = 0; i < cells.length; i++) recolorCell(cells[i]);
    // Catch any word highlights in cells that weren't classified add/del.
    const regions = scope.querySelectorAll('[data-testid="diff-content"]');
    for (let i = 0; i < regions.length; i++) recolorWords(regions[i]);
  }

  // --- Undo (when toggled off): clear our inline overrides ---
  function clearAll() {
    const cells = document.querySelectorAll("[data-bb-kind]");
    for (let i = 0; i < cells.length; i++) {
      const td = cells[i];
      td.style.removeProperty("background-color");
      td.style.removeProperty("color");
      td.removeAttribute("data-bb-kind");
    }
    // Word highlights are stamped separately (their cell may not be add/del).
    const words = document.querySelectorAll("[data-bb-x]");
    for (let w = 0; w < words.length; w++) {
      words[w].style.removeProperty("background-color");
      words[w].style.removeProperty("border-radius");
      words[w].removeAttribute("data-bb-x");
    }
  }

  /* ------------------------------------------------------------------
   * Bitbucket-style "one file at a time" view.
   * GitHub stacks every changed file and scrolls through them all. Bitbucket
   * shows a single file and you pick the next one from the left file tree.
   * We emulate that by hiding every diff entry except the active one, and
   * switching the active entry when a file-tree link is clicked.
   * This is a layout change, so it applies in BOTH light and dark mode.
   * ------------------------------------------------------------------ */
  const ENTRY_SEL = '[class*="PullRequestDiffsList-module__diffEntry"]';
  const TREE_SEL = '[class*="PullRequestFileTree-module"]';

  function diffEntries() {
    return Array.prototype.slice.call(document.querySelectorAll(ENTRY_SEL));
  }

  function showOnlyEntry(entry) {
    const all = diffEntries();
    for (let i = 0; i < all.length; i++) {
      all[i].style.setProperty("display", all[i] === entry ? "" : "none", "important");
    }
  }

  // Map a file-tree anchor (href="#diff-XXX") to its diff entry container.
  function entryForAnchor(a) {
    const href = a.getAttribute("href") || "";
    if (href.indexOf("#diff-") !== 0) return null;
    const target = document.getElementById(href.slice(1));
    return target ? target.closest(ENTRY_SEL) : null;
  }

  function wireFileTree() {
    const tree = document.querySelector(TREE_SEL);
    if (!tree || tree.__bbWired) return;
    tree.__bbWired = true;
    // Capture-phase click: when a file link is chosen, show only that file.
    tree.addEventListener(
      "click",
      (ev) => {
        if (!enabled) return;
        const a = ev.target.closest('a[href^="#diff-"]');
        if (!a) return;
        const entry = entryForAnchor(a);
        if (entry) {
          showOnlyEntry(entry);
          // GitHub scrolls to the anchor; keep us at the top of the file.
          window.scrollTo(0, 0);
        }
      },
      true
    );
  }

  // Ensure a single file is shown. On the first pass over a given set of files
  // (or after new files stream in), collapse to the first file. Once we've
  // collapsed a list we don't re-collapse it, so the user's tree selection
  // (which leaves exactly one entry visible) is preserved.
  function applySingleFile() {
    if (!enabled) return;
    wireFileTree();
    const list = document.querySelector('[data-testid="progressive-diffs-list"]');
    const all = diffEntries();
    if (!all.length) return;

    // Has the user (or a previous pass) already hidden something? If so, the
    // single-file state is already established — leave it alone.
    const someHidden = all.some((e) => e.style.display === "none");
    if (someHidden) return;

    // Nothing hidden yet: this is the initial (all-visible) state. Collapse to
    // the first file, but only once per file-count so streamed-in files that
    // arrive later re-trigger a fresh collapse rather than being left expanded.
    const stamp = list ? list.getAttribute("data-bb-collapsed") : null;
    const countKey = String(all.length);
    if (stamp !== countKey && all.length > 1) {
      showOnlyEntry(all[0]);
      if (list) list.setAttribute("data-bb-collapsed", countKey);
    }
  }

  // Undo single-file view: reveal every diff entry again.
  function clearSingleFile() {
    const all = diffEntries();
    for (let i = 0; i < all.length; i++) all[i].style.removeProperty("display");
    const list = document.querySelector('[data-testid="progressive-diffs-list"]');
    if (list) list.removeAttribute("data-bb-collapsed");
  }

  // --- Observe lazy/virtualized diff loads and SPA navigations ---
  let lastPath = location.pathname;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      // If the SPA URL changed (tab switch, navigating away), re-evaluate the
      // page gate — this adds/removes the skin as we enter/leave the diff view.
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        apply(enabled);
        return;
      }
      if (!enabled || !onDiffPage()) return;
      // Cheap debounce: only act if a mutation added element nodes.
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          if (isDark()) recolorAll(document);
          applySingleFile();
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function apply(on) {
    enabled = on !== false;
    // The skin is active only when enabled AND on the PR diff view. On any other
    // page the class is removed so GitHub renders completely stock.
    const active = enabled && onDiffPage();
    document.documentElement.classList.toggle(CLASS, active);
    if (active) {
      recolorAll(document);
      applySingleFile();
    } else {
      clearAll();
      clearSingleFile();
    }
    // Keep observing regardless: SPA navigations INTO a diff page must be caught.
    startObserver();
  }

  // Read the saved preference (defaults to enabled) and apply immediately.
  try {
    chrome.storage.sync.get([STORAGE_KEY], (res) => apply(res[STORAGE_KEY]));
  } catch (e) {
    apply(true);
  }

  // Re-apply on GitHub's client-side navigation events.
  document.addEventListener("turbo:load", () => apply(enabled), { passive: true });
  document.addEventListener("pjax:end", () => apply(enabled), { passive: true });

  // Recolor once the DOM is ready (content script runs at document_start).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => apply(enabled), { once: true });
  }

  // React to OS theme changes (affects "auto" mode).
  if (window.matchMedia) {
    try {
      window.matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => apply(enabled));
    } catch (e) { /* older browsers: ignore */ }
  }

  // React to toggle changes from the popup.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes[STORAGE_KEY]) {
        apply(changes[STORAGE_KEY].newValue);
      }
    });
  } catch (e) {
    /* no-op */
  }
})();
