const QUICKCONNECT_EXPECTED_CONTENT_VERSION = "2.2";
const QUICKCONNECT_MESSAGE_SOURCE = `quickconnect:${QUICKCONNECT_EXPECTED_CONTENT_VERSION}`;

const COMMAND_TO_ACTION = {
    "paste-message": "pasteMessage",
    "connect-profile": "connectProfile",
    "add-note": "addNote",
    "send-invite": "sendWithoutNote"
};

chrome.commands.onCommand.addListener(async (command) => {
    const action = COMMAND_TO_ACTION[command];
    if (!action) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
        await ensureContentScript(tab.id);
        await chrome.tabs.sendMessage(tab.id, { source: QUICKCONNECT_MESSAGE_SOURCE, action });
    } catch (error) {
        console.log("LinkedIn QuickConnect: command dispatch failed", error);
    }
});

async function ensureContentScript(tabId) {
    const [{ result: loadedVersion } = {}] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.__ORTUS_F1_CONNECTION_VERSION__ || null
    });

    if (loadedVersion === QUICKCONNECT_EXPECTED_CONTENT_VERSION) return;

    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
    });
}
