const config = { enabled: true, disabledTabIds: new Set() };

const COMMANDS = {
  "toggle-all-tabs": toggleAllTabs,
  "toggle-current-tab": toggleCurrentTab,
  "del-del": del,
};
const CONTEXT_MENU = {
  "chrome-show-tab-numbers-toggle-all-tabs": {
    title: "Toggle tab numbering for all tabs",
    callback: toggleAllTabs,
  },
  "chrome-show-tab-numbers-toggle-current-tab": {
    title: "Toggle tab numbering for current tab",
    callback: toggleCurrentTab,
  },
    "del-del": {
    title: "del",
    callback: del,
  },
};

createContextMenu();

chrome.tabGroups.onCreated.addListener(requestToUpdateAll);
chrome.tabGroups.onMoved.addListener(requestToUpdateAll);
chrome.tabGroups.onRemoved.addListener(requestToUpdateAll);
chrome.tabGroups.onUpdated.addListener(requestToUpdateAll);
chrome.tabs.onCreated.addListener(requestToUpdateAll);
chrome.tabs.onMoved.addListener(requestToUpdateAll);
chrome.tabs.onRemoved.addListener(requestToUpdateAll);
chrome.tabs.onUpdated.addListener(requestToUpdateAll);

chrome.tabs.onRemoved.addListener(onTabRemoved);
chrome.commands.onCommand.addListener(onCommand);
chrome.contextMenus.onClicked.addListener(onMenuClicked);

const VALID_PROTOCOLS = new Set(["https:", "http:"]);
const INVALID_HOSTNAMES = new Set(["chrome.google.com"]);
const INVALID_PATHNAME_PATTERN = /\.pdf$/;

let timer = -1;

function requestToUpdateAll() {
  if (!config.enabled) {
    return;
  }

  clearTimeout(timer);
  timer = setTimeout(updateAll, 300000);
}

async function updateAll() {
  const tabs = await chrome.tabs.query({
    currentWindow: true,
    discarded: false,
  });

  let collapsedTabGroups;
  try {
    collapsedTabGroups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
      collapsed: true,
    });
  } catch (error) {
    if (error.message.includes("Grouping is not supported by tabs")) {
      return;
    }
  }

  const collapsedTabGroupIds = new Set(
    collapsedTabGroups.map((tabGroup) => tabGroup.id)
  );

  let indexAdjuster = 0;

  tabs.sort((tab1, tab2) => tab1.index - tab2.index);
  tabs.forEach((tab) => {
    if (collapsedTabGroupIds.has(tab.groupId)) {
      indexAdjuster--;
    }

    if (isValidUrl(tab.url)) {
      const isEnabled = config.enabled && !config.disabledTabIds.has(tab.id);
      const number = tab.index + 1 + indexAdjuster;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: updateOne,
        args: [{ isEnabled, number }],
      });
    }
  });
}

function isValidUrl(urlString) {
  if (urlString === "") {
    return false;
  }

  const url = new URL(urlString);

  return (
    VALID_PROTOCOLS.has(url.protocol) &&
    !INVALID_HOSTNAMES.has(url.hostname) &&
    !INVALID_PATHNAME_PATTERN.test(url.pathname)
  );
}

function updateOne({ isEnabled, number }) {
  const cache = document.showTabNumbers ?? {};
  const isCacheAvailable =
    isEnabled === cache.enabled &&
    number === cache.number &&
    document.title === cache.numberedTitle;

  if (isCacheAvailable) {
    return;
  }

  const NUMBERED_PATTERN = /^\d+\. ?/;
  const NOTIFICATION_COUNT_PATTERN = /^(\(\d+\)) \d+\. (?:\(\d+\) )?/;
  const unnumberedTitle = document.title
    .replace(NUMBERED_PATTERN, "")
    .replace(NOTIFICATION_COUNT_PATTERN, "$1 ");

  cache.enabled = isEnabled;
  cache.number = number;
  number = ( number>8 ? "" : number );
  cache.numberedTitle = (
    cache.enabled ? `${number}${unnumberedTitle}` : unnumberedTitle
  ).trim();

  let tempp;
  const firstChar = document.title.charAt(0);
if (!isNaN(parseInt(firstChar))) {
  tempp = true;
} else {
  tempp = false;
}
  
  tempp ? document.title.substring(1, document.title.length-1) : "";
  
  document.title = tempp ? document.title : cache.numberedTitle 
  document.showTabNumbers = cache;
}

function del() {
  document.title = cache.numberedTitle
}

function toggleAllTabs() {
  config.enabled = !config.enabled;
  updateAll();
}

async function toggleCurrentTab() {
  const [currentTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  const isDisabled = config.disabledTabIds.has(currentTab.id);

  if (isDisabled) {
    config.disabledTabIds.delete(currentTab.id);
  } else {
    config.disabledTabIds.add(currentTab.id);
  }

  updateAll();
}

function onTabRemoved(tabId) {
  const isDisabled = config.disabledTabIds.has(tabId);

  if (isDisabled) {
    config.disabledTabIds.delete(tabId);
  }
}

function onCommand(command) {
  COMMANDS[command]();
}

function createContextMenu() {
  chrome.contextMenus.removeAll();
  for (const menuItemId in CONTEXT_MENU) {
    chrome.contextMenus.create({
      contexts: ["action"],
      id: menuItemId,
      title: CONTEXT_MENU[menuItemId].title,
    });
  }
}

function onMenuClicked(info) {
  CONTEXT_MENU[info.menuItemId].callback();
}
