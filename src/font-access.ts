import { readFonts, saveFonts, clearFonts, styleWeight, type StoredFont } from './font-store';
type LocalFont = { family: string; style: string; postscriptName: string; blob(): Promise<Blob> };
const localWindow = window as typeof window & { queryLocalFonts?: () => Promise<LocalFont[]> };
const status = document.querySelector<HTMLElement>('#status')!;
const familyList = document.querySelector<HTMLElement>('#families')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
let available: LocalFont[] = [];
const requested = new Set((new URLSearchParams(location.search).get('families') || 'Arial').split('|'));
const stored = await readFonts();
status.textContent = stored.length ? `${stored.length} font faces are saved locally. New copies can use them.` : 'Enable access, then select the families you want to use. Fonts stay in this extension on your computer.';
document.querySelector('#enable')!.addEventListener('click', async () => {
  try {
    if (!localWindow.queryLocalFonts) throw new Error('This Chrome version does not support local font access.');
    available = await localWindow.queryLocalFonts();
    familyList.replaceChildren();
    for (const family of [...new Set(available.map(font => font.family))].sort()) {
      const label = document.createElement('label');const input = document.createElement('input');
      input.type = 'checkbox';input.value = family;input.checked = requested.has(family) || stored.some(font => font.family === family);
      label.append(input, document.createTextNode(family));familyList.append(label);
    }
    save.hidden = false;
    status.textContent = 'Choose the font families to save. All their installed faces will be available to the converter.';
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Font access was not granted.'; }
});
save.addEventListener('click', async () => {
  save.disabled = true;
  try {
    const selected = new Set([...familyList.querySelectorAll<HTMLInputElement>('input:checked')].map(input => input.value));
    if (!selected.size) throw new Error('Select at least one font family.');
    const fonts: StoredFont[] = [];
    for (const font of available.filter(font => selected.has(font.family))) {
      const blob = await font.blob();
      if (blob.size > 16 * 1024 * 1024) throw new Error(`${font.family} is too large to save. Choose a smaller font family.`);
      fonts.push({ family:font.family,style:font.style,postscript:font.postscriptName,weight:styleWeight(font.style),italic:/italic|oblique/i.test(font.style),bytes:await blob.arrayBuffer() });
    }
    await saveFonts(fonts);
    status.textContent = `Saved ${fonts.length} font faces locally. Return to your webpage and copy the component again. You can close this tab.`;
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Could not save fonts.'; }
  finally { save.disabled = false; }
});
document.querySelector('#clear')!.addEventListener('click', async () => { await clearFonts();status.textContent = 'Saved font files removed. Chrome font permission can be revoked in this page’s site settings.'; });
