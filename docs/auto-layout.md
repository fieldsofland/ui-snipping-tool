# Auto Layout reconstruction

The export should produce a useful design structure from rendered geometry. DOM nesting and CSS display values are evidence, not the desired Figma hierarchy.

## Rules to develop

- Controls: consolidate redundant wrappers into icon, label, and optional count. Use horizontal Auto Layout with measured padding and gaps. Preserve intentionally fixed control height; let content width grow.
- Stacks: infer vertical groups from ordered child bounds, shared alignment, and consistent gaps. Cards commonly contain heading, body, and action groups.
- Rows: infer horizontal groups across inline, flex, and single-row grid implementations. Preserve centered or baseline alignment and distinguish fixed gaps from distributed space.
- Repetition: identify lists, navigation items, statistics, and repeated cards. Give each item its own layout and retain a parent row or stack.
- Wrapping: infer chip and badge groups that wrap, distinguishing intentional wrapping from multi-column grids.
- Sizing: infer Hug, Fill, and Fixed from intrinsic content, available parent space, CSS constraints, and measured padding. Preserve text width for multiline content.
- Overlays: keep positioned badges, floating controls, and decorative layers absolute within an otherwise useful Auto Layout parent.
- Simplification: collapse wrappers that contribute no appearance, clipping, meaningful sizing, or layout relationship. Retain component and section boundaries.

## Validation

Infer layout candidates from geometry and semantic evidence, then predict child bounds under each candidate. Choose a candidate only when its expected bounds closely match the capture. Text line boxes and visible glyph bounds differ, so treat them separately. Record a reason when a group cannot be converted confidently; avoid silently forcing complex compositions into a row.

The current implementation covers simple buttons, baseline text rows, padded badge spans, and measured centered single rows. General stacks, wrapping, distributed spacing, and robust sizing inference still need implementation and fixture coverage.
