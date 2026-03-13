const MESSAGE_TOGGLE = "HTML_TO_FIGMA_TOGGLE";
const MESSAGE_SET_ENABLED = "HTML_TO_FIGMA_SET_ENABLED";
const MESSAGE_GET_TAB_STATE = "HTML_TO_FIGMA_GET_TAB_STATE";
const STORAGE_KEY_ENABLED_TABS = "h2fEnabledTabs";

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["vendor/figma-capture.js", "src/custom-action-bar.js", "src/content.js"],
  });
}

async function getEnabledTabsMap() {
  const stored = await chrome.storage.session.get(STORAGE_KEY_ENABLED_TABS);
  const map = stored[STORAGE_KEY_ENABLED_TABS];
  return map && typeof map === "object" ? map : {};
}

async function isTabEnabled(tabId) {
  const map = await getEnabledTabsMap();
  return Boolean(map[String(tabId)]);
}

async function setTabEnabled(tabId, enabled) {
  const map = await getEnabledTabsMap();
  map[String(tabId)] = Boolean(enabled);
  await chrome.storage.session.set({ [STORAGE_KEY_ENABLED_TABS]: map });
}

async function clearTabEnabled(tabId) {
  const map = await getEnabledTabsMap();
  delete map[String(tabId)];
  await chrome.storage.session.set({ [STORAGE_KEY_ENABLED_TABS]: map });
}

async function broadcastEnabledState(tabId, enabled) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_SET_ENABLED,
      enabled: Boolean(enabled),
    });
  } catch (error) {
    // Ignore receiver errors; frame scripts may still be loading.
    console.debug("html-to-figma: state broadcast skipped", error);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  try {
    // Force-inject both scripts into every frame so iframe documents can be inspected.
    await ensureContentScript(tab.id);
    const nextEnabled = !(await isTabEnabled(tab.id));
    await setTabEnabled(tab.id, nextEnabled);
    await broadcastEnabledState(tab.id, nextEnabled);
  } catch (error) {
    console.warn("html-to-figma: unable to toggle on this page", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === MESSAGE_GET_TAB_STATE) {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ enabled: false });
      return;
    }
    isTabEnabled(tabId)
      .then((enabled) => sendResponse({ enabled }))
      .catch(() => sendResponse({ enabled: false }));
    return true;
  }

  if (message.type === MESSAGE_TOGGLE) {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ enabled: false });
      return;
    }

    isTabEnabled(tabId)
      .then((enabled) => {
        const nextEnabled = !enabled;
        return setTabEnabled(tabId, nextEnabled).then(() => {
          broadcastEnabledState(tabId, nextEnabled);
          sendResponse({ enabled: nextEnabled });
        });
      })
      .catch(() => sendResponse({ enabled: false }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabEnabled(tabId).catch(() => {});
});
