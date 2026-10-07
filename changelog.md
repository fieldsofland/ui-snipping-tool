# Changelog

## 2026-10-07

- Used measured browser bounds for layout inference so fallback font boxes do not prevent nested button rows from converting. Centered badge text vertically without squeezing it between CSS line-height-derived padding.

- Added geometry-based Auto Layout inference for rows, stacks, simple grids, wrapping groups, distributed spacing, fill-width children, intrinsic sizing hints, and absolute overlays. Retained existing layouts and rejected ambiguous geometry. Added layout and native wrapping clipboard tests.

- Corrected button-row detection to include single-row CSS grids used by GitHub and tolerate inline text line-box offsets. Added GitHub-style button regression fixture and kept multi-row grids excluded.

- Added Auto Layout to padded badge spans and simple centered inline icon/label/count rows, including content nested inside buttons. Preserved measured gaps and source height; excluded overlaps, transforms, and explicit CSS positioning.

- Started clipboard writes immediately on the Copy click using a promised HTML payload, before asynchronous font/image preparation can lose browser activation or focus. Success still waits for the completed write; added ordering and failure regression tests.

- Renamed the extension UI Snipping Tool. Verified existing outer and inset box-shadow conversion with regression coverage for multiple shadows, blur, spread, color alpha, and native clipboard encoding.

- Prepared the public MIT repository with reproducible build instructions and known capture limitations. Kept local session memory and generated files out of version control.

- Excluded visually clipped accessibility labels from capture using computed CSS rather than class names. This prevents shadcn's hidden "Drag to reorder" labels from becoming visible Figma text while preserving visible icons and revealed labels.

- Fixed SVG chart conversion to retain gradient-filled area paths and emit native linear gradients with stop opacity. Preserved color alpha in SVG fills/strokes and SVG text fill colors, correcting opaque chart gridlines and bright axis labels. Added color/gradient binary regression tests.

- Added optional installed-font setup and local storage of selected families so capture can use actual font glyphs and metrics instead of CDN fallback glyphs. This requires Chrome font-access consent once. Verified that saved Arial faces paste with visible text and correct price spacing without manual typography changes.

- Corrected Arial style and PostScript identities and Inter style naming in clipboard font references to help Figma match installed faces without manual replacement. Added font metadata and encoding regression tests.

- Added conservative reduction of redundant single-child frame chains, preserving appearance, clipping, padding, semantic boundaries, grouping, placement, and sizing. Added regression coverage for deeply nested wrappers.

- Added capture cleanup based on Matt's Figma before-and-after: removed redundant export wrapper, applied Auto Width or Auto Height to text, added Auto Layout to simple buttons and CSS baseline rows, and replaced generic frame names with semantic names.
- Added regression tests for layer cleanup and native clipboard encoding.

- Built the initial Chrome extension with shortcut activation, component highlighting, selection locking, parent selection, and an anchored Copy to Figma panel.
- Integrated an MIT-licensed DOM converter for native editable Figma clipboard output, avoiding a separate Figma plugin.
- Added build tooling, panel-position tests, a pricing-card fixture, MIT license, and installation instructions.

## 2026-07-22

- Researched existing Chrome extensions and web-to-Figma tools related to component capture.
- Confirmed that multiple close implementations already exist, especially Figma's official extension, Pluck, and Component Grabber.
- Documented a possible local-first, open-format direction if the repository continues as a fun side project.
