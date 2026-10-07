import { readFonts, matchFont } from './font-store';
async function toggle(tab: chrome.tabs.Tab) {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'component-grabber:toggle' });
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  } catch (error) {
    console.warn('UI Snipping Tool cannot run on this page.', error);
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'Open a regular webpage to select a component' });
  }
}
chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-picker') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) await toggle(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'component-grabber:font-setup') {
    const families = Array.isArray(message.families) ? message.families.filter((family: unknown) => typeof family === 'string').slice(0,16) : ['Arial'];
    chrome.tabs.create({ url: chrome.runtime.getURL('font-access.html') + '?families=' + encodeURIComponent(families.join('|')) });
    return;
  }
  if (message.type === 'component-grabber:font') {
    readFonts().then(fonts => {
      const font = matchFont(fonts, String(message.family), Number(message.weight), Boolean(message.italic));
      respond(font ? { ...font, bytes: Array.from(new Uint8Array(font.bytes)) } : null);
    }).catch(() => respond(null));
    return true;
  }
});
