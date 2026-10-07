# UI Snipping Tool

Select a component on a webpage, click **Copy to Figma**, and paste into a Figma Design canvas. Text stays editable and containers become native frames, with Auto Layout where the converter can reproduce the layout. Single-line text uses Auto Width; multiline text uses Auto Height. Simple text buttons receive Auto Layout, CSS baseline text rows preserve their alignment and gaps, and the redundant export wrapper is removed. Layer names use semantic IDs, classes, and element roles, with `text-container` for unnamed text-only frames. Empty single-child frame chains collapse when the child occupies the same bounds; frames with appearance, padding, clipping, semantic roles, sizing constraints, or multiple children remain.

## Install locally

Requires Node.js 20 or newer and Chrome 120 or newer.

```sh
git clone https://github.com/fieldsofland/ui-snipping-tool.git
cd ui-snipping-tool
npm ci
npm run build
```

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select this project's `dist` folder.
3. Open a webpage and press **Option + Shift + C** on macOS or **Alt + Shift + C** on Windows/Linux.
4. Hover to highlight, then click to select a component. Choose **Select parent** or press the up arrow to expand the selection.
5. Click **Copy to Figma**, switch to Figma Design, and paste with **Cmd + V** or **Ctrl + V**.

Press Escape to exit. The toolbar button also toggles selection. Chrome lets you customize the shortcut at `chrome://extensions/shortcuts`.

For the included `test/fixture.html`, enable **Allow access to file URLs** in the extension's Details page. For normal use, HTTPS pages and localhost support the clipboard API. Chrome internal pages and the Chrome Web Store do not allow extension injection. Reload the extension after rebuilding, and reload any tabs that already have the picker injected.

## Match installed fonts

The picker has a **Use installed fonts…** action. Open it, click **Enable font access**, approve Chrome's font permission, select the families you use, and click **Save selected fonts**. Copy the component again afterward. This setup is needed once per saved family, not for each capture.

Selected font files are stored only in the extension's local IndexedDB. Their actual glyphs, metrics, style names, and PostScript names feed the converter. No font files are uploaded. **Remove saved fonts** deletes the stored copies; Chrome's site settings manage the browser permission separately. Figma must also be able to access the same installed font to edit the resulting text. Families that have not been saved use the converter's CDN loader and may have approximate glyphs.

## Scope and privacy

The extension injects only into the active tab when you invoke it. It has no account, analytics, backend, or paid API. Conversion runs in your browser. The converter's default font loader downloads open-source fonts from Fontsource through jsDelivr, and its image loader fetches the selected component's image assets. This is not an offline tool.

Conversion uses the MIT-licensed [`@figit/dom-to-figma`](https://github.com/figitdesign/web-to-figma). Native clipboard compatibility depends on Figma's paste format. Arial font references are normalized to its real installed faces, and Inter style names match Figma. Other proprietary fonts, cross-origin images without CORS, complex CSS effects, canvas, and video may have missing details or require fallbacks. A capture represents the component at its current size and state. It cannot recover the source design's variants or library bindings.

This is an early experimental release. Live Chrome and Figma tests verified editable text, Auto Layout, installed Arial font matching, images, and SVG chart gradients. Complex mixed inline text can overlap or lose spaces, and some fixed-height controls paste shorter than the source. Visually clipped screen-reader labels are excluded; the latest filter has automated coverage, with its live table check still pending. Broader website and font fidelity remains to be tested.

SVG chart fills support native linear gradients in object-bounding-box coordinates, including stop opacity. SVG color alpha combines with fill/stroke opacity. Radial gradients, user-space gradients, and gradient transforms are not yet supported.

CSS box shadows become editable Figma drop shadows or inner shadows for `inset` shadows. Multiple shadows preserve offsets, blur, spread, and color opacity. Regression tests verify both types survive native clipboard encoding. Exact rendering across complex clipping and compositing still needs broader visual testing.

## Development

```sh
npm run check
npm test
npm run build
```

`src/content.ts` owns the in-page picker and copy panel. `src/background.ts` handles shortcut and toolbar activation. `test/fixture.html` provides a pricing card for manual paste verification.

## License

MIT. Not affiliated with Figma.
