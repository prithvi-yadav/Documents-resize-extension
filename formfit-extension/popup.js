import { resizeAndCompress } from "./utils/imageProcessor.js";

const imageInput = document.getElementById("imageInput");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const sizeInput = document.getElementById("sizeInput");
const formatSelect = document.getElementById("formatSelect");
const autoProcessToggle = document.getElementById("autoProcessToggle");
const floatingToggle = document.getElementById("floatingToggle");
const siteToggle = document.getElementById("siteToggle");
const siteLabel = document.getElementById("siteLabel");
const siteStatus = document.getElementById("siteStatus");
const siteResetBtn = document.getElementById("siteResetBtn");
const siteList = document.getElementById("siteList");
const exportSitesBtn = document.getElementById("exportSitesBtn");
const importSitesBtn = document.getElementById("importSitesBtn");
const importSitesInput = document.getElementById("importSitesInput");
const clearSitesBtn = document.getElementById("clearSitesBtn");
const smartUploadBtn = document.getElementById("smartUploadBtn");
const downloadBtn = document.getElementById("downloadBtn");
const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("status");

const FLOATING_TOGGLE_KEY = "floatingButtonsEnabled";
const SITE_OVERRIDES_KEY = "floatingButtonsBySite";
const AUTO_PROCESS_KEY = "autoProcessEnabled";

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) {
    statusEl.classList.add(type);
  }
}

function parsePositiveNumber(value) {
  const numberValue = Number.parseFloat(value);
  if (Number.isNaN(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function fillDetectedFields(data) {
  if (!data) {
    console.log('[FormFit Popup] No data to fill');
    return;
  }
  console.log('[FormFit Popup] Filling fields with:', data);
  if (data.width) {
    widthInput.value = data.width;
  }
  if (data.height) {
    heightInput.value = data.height;
  }
  if (data.maxSizeKB) {
    sizeInput.value = data.maxSizeKB;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getActiveHostname() {
  const tab = await getActiveTab();
  if (!tab?.url) {
    return null;
  }
  try {
    const url = new URL(tab.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.hostname;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function requestDetectedRequirements() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    console.log('[FormFit Popup] No active tab found');
    return null;
  }

  try {
    console.log('[FormFit Popup] Requesting auto-select input...');
    const autoSelectResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "autoSelectInput",
    });
    console.log('[FormFit Popup] Auto-select response:', autoSelectResponse);

    // Wait a bit for scanning to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[FormFit Popup] Requesting detected requirements...');
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "getDetectedRequirements",
    });
    console.log('[FormFit Popup] Detected requirements response:', response);

    if (response?.data) {
      fillDetectedFields(response.data);
      return response.data;
    }
  } catch (error) {
    console.log('[FormFit Popup] Content script error:', error);
  }

  try {
    console.log('[FormFit Popup] Falling back to background storage...');
    const response = await chrome.runtime.sendMessage({
      type: "getRequirements",
      tabId: tab.id,
    });
    console.log('[FormFit Popup] Background storage response:', response);
    if (response?.data) {
      fillDetectedFields(response.data);
      return response.data;
    }
  } catch (error) {
    console.log('[FormFit Popup] Background storage error:', error);
  }

  console.log('[FormFit Popup] No requirements detected');
  return null;
}

function getFloatingToggleValue() {
  return chrome.storage.local.get([FLOATING_TOGGLE_KEY]).then((result) => {
    if (typeof result[FLOATING_TOGGLE_KEY] === "boolean") {
      return result[FLOATING_TOGGLE_KEY];
    }
    return true;
  });
}

async function setFloatingToggleValue(enabled) {
  await chrome.storage.local.set({ [FLOATING_TOGGLE_KEY]: enabled });
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "setGlobalFloatingEnabled",
      enabled,
    });
  } catch (error) {
    // Ignore if the content script is not available.
  }
}

async function loadSiteToggleState() {
  const hostname = await getActiveHostname();
  if (!hostname) {
    siteLabel.textContent = "This site";
    siteStatus.textContent = "Unavailable";
    siteToggle.disabled = true;
    siteResetBtn.disabled = true;
    return;
  }

  siteLabel.textContent = `This site (${hostname})`;

  const [{ [FLOATING_TOGGLE_KEY]: globalEnabled }, { [SITE_OVERRIDES_KEY]: overrides }] =
    await Promise.all([
      chrome.storage.local.get([FLOATING_TOGGLE_KEY]),
      chrome.storage.local.get([SITE_OVERRIDES_KEY]),
    ]);

  const resolvedGlobal =
    typeof globalEnabled === "boolean" ? globalEnabled : true;
  const siteMap = overrides || {};
  const overrideValue =
    typeof siteMap[hostname] === "boolean" ? siteMap[hostname] : null;

  if (overrideValue === null) {
    siteToggle.checked = resolvedGlobal;
    siteStatus.textContent = "Using global setting";
    siteResetBtn.disabled = true;
  } else {
    siteToggle.checked = overrideValue;
    siteStatus.textContent = overrideValue
      ? "Override: enabled"
      : "Override: disabled";
    siteResetBtn.disabled = false;
  }
}

async function setSiteOverride(enabled) {
  const hostname = await getActiveHostname();
  if (!hostname) {
    return;
  }

  const stored = await chrome.storage.local.get([SITE_OVERRIDES_KEY]);
  const siteMap = stored[SITE_OVERRIDES_KEY] || {};
  siteMap[hostname] = enabled;
  await chrome.storage.local.set({ [SITE_OVERRIDES_KEY]: siteMap });

  const tab = await getActiveTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "setSiteFloatingOverride",
        hostname,
        enabled,
      });
    } catch (error) {
      // Ignore if the content script is not available.
    }
  }

  await loadSiteToggleState();
}

async function clearSiteOverride() {
  const hostname = await getActiveHostname();
  if (!hostname) {
    return;
  }

  const stored = await chrome.storage.local.get([SITE_OVERRIDES_KEY]);
  const siteMap = stored[SITE_OVERRIDES_KEY] || {};
  delete siteMap[hostname];
  await chrome.storage.local.set({ [SITE_OVERRIDES_KEY]: siteMap });

  const tab = await getActiveTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "clearSiteFloatingOverride",
        hostname,
      });
    } catch (error) {
      // Ignore if the content script is not available.
    }
  }

  await loadSiteToggleState();
}

function formatSiteStatus(value) {
  return value ? "Enabled" : "Disabled";
}

async function renderSiteList() {
  const stored = await chrome.storage.local.get([SITE_OVERRIDES_KEY]);
  const siteMap = stored[SITE_OVERRIDES_KEY] || {};
  const entries = Object.entries(siteMap).sort((a, b) => a[0].localeCompare(b[0]));

  siteList.innerHTML = "";
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "site-empty";
    empty.textContent = "No site overrides yet.";
    siteList.appendChild(empty);
    return;
  }

  entries.forEach(([hostname, enabled]) => {
    const row = document.createElement("div");
    row.className = "site-item";

    const label = document.createElement("span");
    label.textContent = hostname;

    const status = document.createElement("small");
    status.textContent = formatSiteStatus(enabled);
    label.appendChild(status);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const storedSites = await chrome.storage.local.get([SITE_OVERRIDES_KEY]);
      const map = storedSites[SITE_OVERRIDES_KEY] || {};
      delete map[hostname];
      await chrome.storage.local.set({ [SITE_OVERRIDES_KEY]: map });
      await loadSiteToggleState();
      await renderSiteList();
    });

    row.appendChild(label);
    row.appendChild(removeBtn);
    siteList.appendChild(row);
  });
}

async function exportSiteOverrides() {
  const stored = await chrome.storage.local.get([SITE_OVERRIDES_KEY]);
  const siteMap = stored[SITE_OVERRIDES_KEY] || {};
  const blob = new Blob([JSON.stringify(siteMap, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "formfit-site-overrides.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function clearAllSiteOverrides() {
  await chrome.storage.local.set({ [SITE_OVERRIDES_KEY]: {} });
  await loadSiteToggleState();
  await renderSiteList();
  setStatus("All site overrides cleared.", "success");
}

async function importSiteOverrides(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid file format.");
    }
    const normalized = {};
    Object.entries(parsed).forEach(([hostname, value]) => {
      if (typeof value === "boolean") {
        normalized[hostname] = value;
      }
    });
    await chrome.storage.local.set({ [SITE_OVERRIDES_KEY]: normalized });
    await loadSiteToggleState();
    await renderSiteList();
    setStatus("Site overrides imported.", "success");
  } catch (error) {
    setStatus(error.message || "Failed to import overrides.", "error");
  }
}

async function getAutoProcessValue() {
  const stored = await chrome.storage.local.get([AUTO_PROCESS_KEY]);
  if (typeof stored[AUTO_PROCESS_KEY] === "boolean") {
    return stored[AUTO_PROCESS_KEY];
  }
  return true;
}

async function setAutoProcessValue(enabled) {
  await chrome.storage.local.set({ [AUTO_PROCESS_KEY]: enabled });
  const tab = await getActiveTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "setAutoProcessEnabled",
        enabled,
      });
    } catch (error) {
      // Ignore if the content script is not available.
    }
  }
}

async function processImage() {
  const file = imageInput.files[0];
  if (!file) {
    throw new Error("Please select an image file.");
  }

  const width = parsePositiveNumber(widthInput.value);
  const height = parsePositiveNumber(heightInput.value);
  const maxSizeKB = parsePositiveNumber(sizeInput.value);

  if (!width || !height) {
    throw new Error("Please enter valid width and height.");
  }

  const format = formatSelect.value;

  setStatus("Processing image...");
  const blob = await resizeAndCompress(file, width, height, maxSizeKB, format);

  return { blob, format };
}

function triggerDownload(blob, format) {
  const extension = format === "image/png" ? "png" : "jpg";
  const fileName = `formfit-resized.${extension}`;
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

async function handleDownload() {
  try {
    setStatus("");
    const { blob, format } = await processImage();
    triggerDownload(blob, format);
    setStatus("Download ready.", "success");
  } catch (error) {
    setStatus(error.message || "Failed to process image.", "error");
  }
}

async function handleUpload() {
  try {
    setStatus("");
    const { blob } = await processImage();
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    const buffer = await blob.arrayBuffer();
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "uploadResizedImage",
      buffer,
      mimeType: blob.type,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Upload failed.");
    }

    setStatus("Upload successful.", "success");
  } catch (error) {
    setStatus(error.message || "Upload failed.", "error");
  }
}

async function handleSmartUpload() {
  try {
    setStatus("");
    await requestDetectedRequirements();

    const width = parsePositiveNumber(widthInput.value);
    const height = parsePositiveNumber(heightInput.value);

    if (!width || !height) {
      throw new Error("No detected size found. Enter width and height.");
    }

    const { blob } = await processImage();
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    const buffer = await blob.arrayBuffer();
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "uploadResizedImage",
      buffer,
      mimeType: blob.type,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Upload failed.");
    }

    setStatus("Smart upload successful.", "success");
  } catch (error) {
    setStatus(error.message || "Smart upload failed.", "error");
  }
}

requestDetectedRequirements();
getAutoProcessValue().then((enabled) => {
  autoProcessToggle.checked = enabled;
});
getFloatingToggleValue().then((enabled) => {
  floatingToggle.checked = enabled;
});
loadSiteToggleState();
renderSiteList();

imageInput.addEventListener("change", () => setStatus(""));
autoProcessToggle.addEventListener("change", () => {
  setAutoProcessValue(autoProcessToggle.checked);
});
floatingToggle.addEventListener("change", async () => {
  await setFloatingToggleValue(floatingToggle.checked);
  await loadSiteToggleState();
  await renderSiteList();
});
siteToggle.addEventListener("change", () => {
  setSiteOverride(siteToggle.checked).then(renderSiteList);
});
siteResetBtn.addEventListener("click", () => {
  clearSiteOverride().then(renderSiteList);
});
exportSitesBtn.addEventListener("click", exportSiteOverrides);
importSitesBtn.addEventListener("click", () => {
  importSitesInput.click();
});
clearSitesBtn.addEventListener("click", clearAllSiteOverrides);
importSitesInput.addEventListener("change", () => {
  const file = importSitesInput.files[0];
  if (file) {
    importSiteOverrides(file);
  }
  importSitesInput.value = "";
});
smartUploadBtn.addEventListener("click", handleSmartUpload);
downloadBtn.addEventListener("click", handleDownload);
uploadBtn.addEventListener("click", handleUpload);
