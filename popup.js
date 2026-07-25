const FALLBACK_CATEGORIES = [
  { id: "naukri", name: "Naukri", color: "#2563eb", keywords: ["naukri"], enabled: true, hidden: false },
  { id: "indeed", name: "Indeed", color: "#f97316", keywords: ["indeed"], enabled: true, hidden: false }
];

const UNCATEGORIZED_KEY = "__uncategorized";

let categories = [];
let extensionEnabled = true;
let focusMode = false;
let isolateCategories = [];

const listEl = document.getElementById("category-list");
const template = document.getElementById("category-template");
const enabledToggle = document.getElementById("enabled-toggle");
const focusToggle = document.getElementById("focus-toggle");
const addBtn = document.getElementById("add-category-btn");
const isolateBanner = document.getElementById("isolate-banner");
const isolateBannerText = document.getElementById("isolate-banner-text");
const isolateClearBtn = document.getElementById("isolate-clear-btn");
const everythingSoloBtn = document.getElementById("everything-solo-btn");

function uid() {
  return "cat_" + Math.random().toString(36).slice(2, 9);
}

function save() {
  chrome.storage.sync.set({ categories, extensionEnabled, focusMode, isolateCategories });
}

function toggleIsolate(key) {
  isolateCategories = isolateCategories.includes(key)
    ? isolateCategories.filter((k) => k !== key)
    : [...isolateCategories, key];
  save();
  renderIsolateBanner();
  render();
}

function renderIsolateBanner() {
  everythingSoloBtn.classList.toggle("solo-active", isolateCategories.includes(UNCATEGORIZED_KEY));

  if (isolateCategories.length === 0) {
    isolateBanner.style.display = "none";
    return;
  }
  const labels = isolateCategories.map((key) => {
    if (key === UNCATEGORIZED_KEY) return "Everything else";
    const cat = categories.find((c) => c.id === key);
    return cat ? cat.name : key;
  });
  isolateBannerText.textContent = `Showing only: ${labels.join(", ")}`;
  isolateBanner.style.display = "flex";
}

function render() {
  listEl.innerHTML = "";
  categories.forEach((cat) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".category-card");
    card.dataset.id = cat.id;

    const colorInput = node.querySelector(".cat-color");
    const nameInput = node.querySelector(".cat-name");
    const soloBtn = node.querySelector('[data-role="solo"]');
    const deleteBtn = node.querySelector(".delete-btn");
    const chipsBox = node.querySelector(".keyword-chips");
    const keywordInput = node.querySelector(".keyword-input");
    const hiddenToggle = node.querySelector(".cat-hidden");

    colorInput.value = cat.color;
    nameInput.value = cat.name;
    hiddenToggle.checked = !!cat.hidden;
    soloBtn.classList.toggle("solo-active", isolateCategories.includes(cat.id));

    renderChips(chipsBox, cat);

    colorInput.addEventListener("input", () => {
      cat.color = colorInput.value;
      save();
    });

    nameInput.addEventListener("change", () => {
      cat.name = nameInput.value.trim() || cat.name;
      save();
      renderIsolateBanner();
    });

    soloBtn.addEventListener("click", () => toggleIsolate(cat.id));

    deleteBtn.addEventListener("click", () => {
      categories = categories.filter((c) => c.id !== cat.id);
      isolateCategories = isolateCategories.filter((k) => k !== cat.id);
      save();
      renderIsolateBanner();
      render();
    });

    hiddenToggle.addEventListener("change", () => {
      cat.hidden = hiddenToggle.checked;
      save();
    });

    keywordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const value = keywordInput.value.trim().toLowerCase();
        if (value && !cat.keywords.includes(value)) {
          cat.keywords.push(value);
          keywordInput.value = "";
          renderChips(chipsBox, cat);
          save();
        }
      }
    });

    listEl.appendChild(node);
  });
}

function renderChips(chipsBox, cat) {
  chipsBox.innerHTML = "";
  cat.keywords.forEach((kw) => {
    const chip = document.createElement("span");
    chip.className = "keyword-chip";
    const label = document.createElement("span");
    label.textContent = kw;
    chip.appendChild(label);
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      cat.keywords = cat.keywords.filter((k) => k !== kw);
      renderChips(chipsBox, cat);
      save();
    });
    chip.appendChild(removeBtn);
    chipsBox.appendChild(chip);
  });
}

// Golden-angle hue rotation: each new category gets a hue ~137.5° away
// from the last, so colors stay visually distinct no matter how many
// categories you create - no repeats, no clashing neighbors.
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) =>
    Math.round(255 * f(x)).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

function nextCategoryColor() {
  const hue = (categories.length * 137.508) % 360;
  return hslToHex(hue, 68, 46);
}

addBtn.addEventListener("click", () => {
  categories.push({
    id: uid(),
    name: "New category",
    color: nextCategoryColor(),
    keywords: [],
    enabled: true,
    hidden: false
  });
  save();
  render();
});

enabledToggle.addEventListener("change", () => {
  extensionEnabled = enabledToggle.checked;
  save();
});

focusToggle.addEventListener("change", () => {
  focusMode = focusToggle.checked;
  save();
});

everythingSoloBtn.addEventListener("click", () => toggleIsolate(UNCATEGORIZED_KEY));

isolateClearBtn.addEventListener("click", () => {
  isolateCategories = [];
  save();
  renderIsolateBanner();
  render();
});

chrome.storage.sync.get(
  ["categories", "extensionEnabled", "focusMode", "isolateCategories"],
  (result) => {
    categories = result.categories && result.categories.length
      ? result.categories
      : FALLBACK_CATEGORIES;
    extensionEnabled = result.extensionEnabled !== false;
    focusMode = !!result.focusMode;
    isolateCategories = Array.isArray(result.isolateCategories)
      ? result.isolateCategories
      : [];

    enabledToggle.checked = extensionEnabled;
    focusToggle.checked = focusMode;
    renderIsolateBanner();
    render();
  }
);
