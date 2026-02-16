const itemsRoot = document.getElementById("items");
const overlay = document.getElementById("overlay");
const backdrop = document.getElementById("backdrop");
const closeBtn = document.getElementById("close");
const sourceLink = document.getElementById("source-link");
const sourceContent = document.getElementById("source-content");
const overlayTitle = document.getElementById("overlay-title");

let lastTrigger = null;

function trapFocus(event) {
  if (event.key !== "Tab") return;
  event.preventDefault();
  closeBtn.focus();
}

function closeOverlay() {
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", onOverlayKeydown);
  if (lastTrigger) lastTrigger.focus();
}

function onOverlayKeydown(event) {
  if (event.key === "Escape") closeOverlay();
  trapFocus(event);
}

async function openOverlay(itemId, triggerEl) {
  lastTrigger = triggerEl;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  closeBtn.focus();
  document.addEventListener("keydown", onOverlayKeydown);

  sourceLink.textContent = "Loading source link...";
  sourceLink.removeAttribute("href");
  sourceContent.textContent = "Loading source content...";
  overlayTitle.textContent = "Source details";

  try {
    const response = await fetch(`/api/newsletter/items/${itemId}/source`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    overlayTitle.textContent = data.sourceTitle || "Source title unavailable";
    if (data.sourceUrl) {
      sourceLink.textContent = data.sourceUrl;
      sourceLink.href = data.sourceUrl;
    } else {
      sourceLink.textContent = "Source link unavailable";
      sourceLink.removeAttribute("href");
    }

    sourceContent.textContent = data.content || "Full source content is unavailable.";
  } catch {
    sourceLink.textContent = "Source link unavailable";
    sourceLink.removeAttribute("href");
    sourceContent.textContent = "Unable to load source details right now.";
  }
}

function renderItems(items) {
  itemsRoot.innerHTML = "";
  for (const item of items) {
    const button = document.createElement("button");
    button.className = "item";
    button.type = "button";
    button.innerHTML = `<strong>${item.headline}</strong><br /><small>${item.summary}</small>`;
    button.addEventListener("click", () => openOverlay(item.id, button));
    itemsRoot.appendChild(button);
  }
}

async function init() {
  const response = await fetch("/api/newsletter/items");
  const items = await response.json();
  renderItems(items);
}

closeBtn.addEventListener("click", closeOverlay);
backdrop.addEventListener("click", closeOverlay);

init();
