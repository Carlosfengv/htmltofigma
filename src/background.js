const MESSAGE_TOGGLE = "HTML_TO_FIGMA_TOGGLE";

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["vendor/figma-capture.js", "src/content.js"],
  });
}

async function sendToggle(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: MESSAGE_TOGGLE });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  try {
    // Force-inject both scripts every click so capture API is always available.
    await ensureContentScript(tab.id);
    await sendToggle(tab.id);
  } catch (error) {
    console.warn("html-to-figma: unable to toggle on this page", error);
  }
});
