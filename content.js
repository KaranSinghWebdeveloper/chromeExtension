/**
 * Gmail Inbox Categorizer - content script
 *
 * What it does:
 *  1. Reads category rules (keyword -> category) from chrome.storage.sync
 *  2. Scans every visible mail row in the Gmail list view
 *  3. Matches each row's sender + subject text against the rules
 *  4. Tags matching rows with a coloured left-border + small pill badge
 *  5. Lets you hide a whole category, or flip on "Focus mode" to hide
 *     every tagged row at once - leaving only your unrecognised
 *     (presumably important) mail visible.
 *
 * Everything is driven by chrome.storage.sync so the popup and this
 * content script always agree on the current rules/visibility state.
 */

(() => {
  const FALLBACK_CATEGORIES = [
    { id: "naukri", name: "Naukri", color: "#2563eb", keywords: ["naukri"], enabled: true, hidden: false },
    { id: "indeed", name: "Indeed", color: "#f97316", keywords: ["indeed"], enabled: true, hidden: false }
  ];

  let state = {
    categories: FALLBACK_CATEGORIES,
    focusMode: false,
    extensionEnabled: true,
    isolateCategories: []
  };

  const ROW_SELECTOR = "tr.zA";
  const PROCESSED_ATTR = "data-gic-processed";
  const CATEGORY_ATTR = "data-gic-category";
  const UNCATEGORIZED_KEY = "__uncategorized";

  // ---------- storage ----------

  function loadState() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ["categories", "focusMode", "extensionEnabled", "isolateCategories"],
        (result) => {
          state = {
            categories: result.categories && result.categories.length
              ? result.categories
              : FALLBACK_CATEGORIES,
            focusMode: !!result.focusMode,
            extensionEnabled: result.extensionEnabled !== false,
            isolateCategories: Array.isArray(result.isolateCategories)
              ? result.isolateCategories
              : []
          };
          resolve(state);
        }
      );
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    loadState()
      .then(() => {
        // Re-tag everything since rules may have changed, then refresh visibility/panel.
        document
          .querySelectorAll(`${ROW_SELECTOR}[${PROCESSED_ATTR}]`)
          .forEach((row) => row.removeAttribute(PROCESSED_ATTR));
        scanRows();
        renderPanel();
      })
      .catch((err) => console.error("[Inbox Categorizer] storage update failed:", err));
  });

  // ---------- row extraction helpers ----------

  function getRowText(row) {
    const senderEl = row.querySelector("span[email]");
    const senderName = senderEl ? (senderEl.getAttribute("name") || "") : "";
    const senderEmail = senderEl ? (senderEl.getAttribute("email") || "") : "";
    const subjectEl = row.querySelector(".bog") || row.querySelector(".y6");
    const subjectText = subjectEl ? subjectEl.textContent || "" : "";
    // .y2 usually holds the trailing snippet text next to the subject
    const snippetEl = row.querySelector(".y2");
    const snippetText = snippetEl ? snippetEl.textContent || "" : "";

    return `${senderName} ${senderEmail} ${subjectText} ${snippetText}`.toLowerCase();
  }

  function matchCategory(text, categories) {
    for (const cat of categories) {
      if (!cat.enabled) continue;
      for (const kw of cat.keywords) {
        const needle = (kw || "").toLowerCase().trim();
        if (needle && text.includes(needle)) {
          return cat;
        }
      }
    }
    return null;
  }

  // ---------- tagging / visibility ----------

  function ensureBadge(row, category) {
    let badge = row.querySelector(".gic-badge");
    const subjectContainer = row.querySelector(".xY") || row.querySelector(".a4W");

    if (!category) {
      if (badge) badge.remove();
      row.style.removeProperty("border-left");
      row.removeAttribute(CATEGORY_ATTR);
      return;
    }

    row.style.setProperty("border-left", `4px solid ${category.color}`, "important");
    row.setAttribute(CATEGORY_ATTR, category.id);

    if (!badge && subjectContainer) {
      badge = document.createElement("span");
      badge.className = "gic-badge";
      subjectContainer.prepend(badge);
    }
    if (badge) {
      badge.textContent = category.name;
      badge.style.background = category.color;
    }
  }

  function applyVisibility(row, category) {
    if (!state.extensionEnabled) {
      row.style.removeProperty("display");
      return;
    }

    const key = category ? category.id : UNCATEGORIZED_KEY;

    if (state.isolateCategories && state.isolateCategories.length > 0) {
      // "Show only" mode: display exclusively the categories the user picked,
      // regardless of focus mode or any per-category hide setting.
      const shouldShow = state.isolateCategories.includes(key);
      if (shouldShow) {
        row.style.removeProperty("display");
      } else {
        row.style.setProperty("display", "none", "important");
      }
      return;
    }

    if (!category) {
      row.style.removeProperty("display");
      return;
    }
    const shouldHide = state.focusMode || category.hidden;
    if (shouldHide) {
      row.style.setProperty("display", "none", "important");
    } else {
      row.style.removeProperty("display");
    }
  }

  function processRow(row) {
    if (!state.extensionEnabled) {
      ensureBadge(row, null);
      applyVisibility(row, null);
      row.setAttribute(PROCESSED_ATTR, "1");
      return;
    }
    const text = getRowText(row);
    const category = matchCategory(text, state.categories);
    ensureBadge(row, category);
    applyVisibility(row, category);
    row.setAttribute(PROCESSED_ATTR, "1");
  }

  function scanRows() {
    const rows = document.querySelectorAll(`${ROW_SELECTOR}:not([${PROCESSED_ATTR}])`);
    rows.forEach(processRow);
    updateCounts();
  }

  function rescanAllVisibility() {
    // Cheap pass: only re-apply hide/show + panel counts, no re-matching.
    document.querySelectorAll(ROW_SELECTOR).forEach((row) => {
      const catId = row.getAttribute(CATEGORY_ATTR);
      const category = state.categories.find((c) => c.id === catId) || null;
      applyVisibility(row, category);
    });
    updateCounts();
  }

  // ---------- counts for the panel ----------

  function updateCounts() {
    const counts = {};
    state.categories.forEach((c) => (counts[c.id] = 0));
    let uncategorized = 0;
    document.querySelectorAll(ROW_SELECTOR).forEach((row) => {
      const catId = row.getAttribute(CATEGORY_ATTR);
      if (catId && counts[catId] !== undefined) {
        counts[catId] += 1;
      } else if (!catId) {
        uncategorized += 1;
      }
    });
    counts[UNCATEGORIZED_KEY] = uncategorized;
    renderCounts(counts);
  }

  // ---------- floating panel ----------

  let panelEl = null;

  // Gmail enforces a Trusted Types CSP, which throws on any `.innerHTML =`
  // assignment and silently kills the rest of the script. Every element
  // below is built with createElement/textContent instead - no innerHTML.

  function renderPanel() {
    if (panelEl) panelEl.remove();

    panelEl = document.createElement("div");
    panelEl.id = "gic-panel";

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "gic-toggle-btn";
    toggleBtn.title = "Inbox Categorizer";
    toggleBtn.textContent = "📂";
    panelEl.appendChild(toggleBtn);

    const body = document.createElement("div");
    body.id = "gic-panel-body";
    body.className = "gic-hidden";
    panelEl.appendChild(body);

    // header
    const header = document.createElement("div");
    header.className = "gic-panel-header";
    const headerTitle = document.createElement("span");
    headerTitle.textContent = "Inbox Categorizer";
    header.appendChild(headerTitle);

    const enabledLabel = document.createElement("label");
    enabledLabel.className = "gic-switch-row";
    const enabledText = document.createElement("span");
    enabledText.textContent = "On";
    const enabledCheckbox = document.createElement("input");
    enabledCheckbox.type = "checkbox";
    enabledCheckbox.id = "gic-enabled-toggle";
    enabledCheckbox.checked = state.extensionEnabled;
    enabledLabel.appendChild(enabledText);
    enabledLabel.appendChild(enabledCheckbox);
    header.appendChild(enabledLabel);
    body.appendChild(header);

    // active "show only" banner
    if (state.isolateCategories && state.isolateCategories.length > 0) {
      const banner = document.createElement("div");
      banner.className = "gic-isolate-banner";

      const labels = state.isolateCategories.map((key) => {
        if (key === UNCATEGORIZED_KEY) return "Everything else";
        const cat = state.categories.find((c) => c.id === key);
        return cat ? cat.name : key;
      });

      const bannerText = document.createElement("span");
      bannerText.textContent = `Showing only: ${labels.join(", ")}`;
      banner.appendChild(bannerText);

      const clearBtn = document.createElement("button");
      clearBtn.className = "gic-clear-btn";
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        chrome.storage.sync.set({ isolateCategories: [] });
      });
      banner.appendChild(clearBtn);

      body.appendChild(banner);
    }

    // focus mode row
    const focusRow = document.createElement("label");
    focusRow.className = "gic-focus-row";
    const focusCheckbox = document.createElement("input");
    focusCheckbox.type = "checkbox";
    focusCheckbox.id = "gic-focus-toggle";
    focusCheckbox.checked = state.focusMode;
    const focusText = document.createElement("span");
    focusText.textContent = "Focus mode - hide all tagged mail, show only the rest";
    focusRow.appendChild(focusCheckbox);
    focusRow.appendChild(focusText);
    body.appendChild(focusRow);

    // category list
    const list = document.createElement("div");
    list.className = "gic-cat-list";
    body.appendChild(list);

    function isolateToggleBtn(key) {
      const btn = document.createElement("button");
      btn.className = "gic-solo-btn";
      btn.setAttribute("data-cat", key);
      btn.title = "Show only this category";
      btn.textContent = "👁";
      if (state.isolateCategories.includes(key)) {
        btn.classList.add("gic-solo-active");
      }
      btn.addEventListener("click", () => {
        const current = state.isolateCategories.includes(key)
          ? state.isolateCategories.filter((k) => k !== key)
          : [...state.isolateCategories, key];
        chrome.storage.sync.set({ isolateCategories: current });
      });
      return btn;
    }

    state.categories.forEach((cat) => {
      const row = document.createElement("label");
      row.className = "gic-cat-row";

      const dot = document.createElement("span");
      dot.className = "gic-dot";
      dot.style.background = cat.color;

      const name = document.createElement("span");
      name.className = "gic-cat-name";
      name.textContent = cat.name;

      const count = document.createElement("span");
      count.className = "gic-cat-count";
      count.setAttribute("data-cat", cat.id);
      count.textContent = "0";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.setAttribute("data-role", "visibility");
      checkbox.setAttribute("data-cat", cat.id);
      checkbox.checked = !cat.hidden;
      checkbox.title = "Show this category";

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(count);
      row.appendChild(isolateToggleBtn(cat.id));
      row.appendChild(checkbox);
      list.appendChild(row);
    });

    // static "everything else" row
    const uncatRow = document.createElement("div");
    uncatRow.className = "gic-cat-row gic-cat-row-static";
    const uncatDot = document.createElement("span");
    uncatDot.className = "gic-dot";
    uncatDot.style.background = "#9ca3af";
    const uncatName = document.createElement("span");
    uncatName.className = "gic-cat-name";
    uncatName.textContent = "Everything else";
    const uncatCount = document.createElement("span");
    uncatCount.className = "gic-cat-count";
    uncatCount.setAttribute("data-cat", UNCATEGORIZED_KEY);
    uncatCount.textContent = "0";
    uncatRow.appendChild(uncatDot);
    uncatRow.appendChild(uncatName);
    uncatRow.appendChild(uncatCount);
    uncatRow.appendChild(isolateToggleBtn(UNCATEGORIZED_KEY));
    list.appendChild(uncatRow);

    // footer
    const footer = document.createElement("div");
    footer.className = "gic-panel-footer";
    const footerText = document.createElement("span");
    footerText.textContent = "Manage keywords in the extension popup";
    footer.appendChild(footerText);
    body.appendChild(footer);

    document.body.appendChild(panelEl);

    // events
    toggleBtn.addEventListener("click", () => {
      body.classList.toggle("gic-hidden");
    });

    enabledCheckbox.addEventListener("change", (e) => {
      chrome.storage.sync.set({ extensionEnabled: e.target.checked });
    });

    focusCheckbox.addEventListener("change", (e) => {
      chrome.storage.sync.set({ focusMode: e.target.checked });
    });

    list.querySelectorAll('input[data-role="visibility"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-cat");
        const updated = state.categories.map((c) =>
          c.id === id ? { ...c, hidden: !e.target.checked } : c
        );
        chrome.storage.sync.set({ categories: updated });
      });
    });

    updateCounts();
  }

  function renderCounts(counts) {
    if (!panelEl) return;
    Object.entries(counts).forEach(([id, n]) => {
      const el = panelEl.querySelector(`.gic-cat-count[data-cat="${id}"]`);
      if (el) el.textContent = String(n);
    });
  }

  // ---------- observer / bootstrap ----------

  let debounceTimer = null;
  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanRows, 250);
  }

  function observeInbox() {
    const main = document.querySelector('div[role="main"]') || document.body;
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(main, { childList: true, subtree: true });
  }

  async function init() {
    try {
      await loadState();
      renderPanel();
      scanRows();
      observeInbox();
    } catch (err) {
      console.error("[Inbox Categorizer] failed to initialize:", err);
    }
  }

  // Gmail is a SPA behind a loading spinner - wait for the first row to exist.
  const bootObserver = new MutationObserver(() => {
    if (document.querySelector(ROW_SELECTOR)) {
      bootObserver.disconnect();
      init();
    }
  });
  bootObserver.observe(document.body, { childList: true, subtree: true });

  // Fallback in case rows are already present when the script runs.
  if (document.querySelector(ROW_SELECTOR)) {
    bootObserver.disconnect();
    init();
  }
})();
