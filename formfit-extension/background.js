const requirementsByTab = {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["requirementsByTab"], (result) => {
    Object.assign(requirementsByTab, result.requirementsByTab || {});
  });
});

function persistRequirements() {
  chrome.storage.local.set({ requirementsByTab });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "updateRequirements") {
    const tabId = sender.tab?.id;
    if (tabId && message.data) {
      requirementsByTab[tabId] = message.data;
      persistRequirements();
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "getRequirements") {
    const tabId = message.tabId;
    const data = tabId ? requirementsByTab[tabId] : null;
    sendResponse({ data });
    return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (requirementsByTab[tabId]) {
    delete requirementsByTab[tabId];
    persistRequirements();
  }
});
