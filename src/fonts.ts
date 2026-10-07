export type FontIdentity = { family: string; style: string; postscript?: string };
export type FontMetadata = { key: FontIdentity; fontWeight: number; fontStyle: string };
export type FontLayer = {
  type: string; fontName?: FontIdentity;
  derivedTextData?: { fontMetaData?: FontMetadata[]; layoutSize?: { x: number; y: number }; derivedLines?: { directionality: string }[]; [key: string]: unknown };
};

/** Match real family/style identities rather than synthesized fallback names. */
export function normalizeFontIdentity(identity: FontIdentity): FontIdentity {
  const family = identity.family.trim();
  if (family.toLowerCase() === 'arial') {
    const italic = /italic|oblique/i.test(identity.style);
    // Arial has four faces. CSS 500 selects Regular; 600 and above select Bold.
    const bold = /semi\s*bold|bold|extra\s*bold|black|heavy/i.test(identity.style);
    return {
      family: 'Arial',
      style: bold ? italic ? 'Bold Italic' : 'Bold' : italic ? 'Italic' : 'Regular',
      postscript: bold ? italic ? 'Arial-BoldItalicMT' : 'Arial-BoldMT' : italic ? 'Arial-ItalicMT' : 'ArialMT',
    };
  }
  if (family.toLowerCase() === 'inter') {
    return { family: 'Inter', style: identity.style.replace(/SemiBold/g, 'Semi Bold').replace(/ExtraBold/g, 'Extra Bold').replace(/ExtraLight/g, 'Extra Light'), postscript: '' };
  }
  return identity;
}

export function normalizeFonts(layers: FontLayer[], identities: Map<string, FontIdentity> = new Map()) {
  for (const layer of layers) {
    if (layer.type !== 'TEXT' || !layer.fontName) continue;
    layer.fontName = identities.get(`${layer.fontName.family}:${layer.fontName.style}`) || normalizeFontIdentity(layer.fontName);
    for (const meta of layer.derivedTextData?.fontMetaData || []) {
      meta.key = identities.get(`${meta.key.family}:${meta.key.style}`) || normalizeFontIdentity(meta.key);
      if (meta.key.family === 'Arial') {
        meta.fontWeight = meta.key.style.includes('Bold') ? 700 : 400;
        meta.fontStyle = meta.key.style.includes('Italic') ? 'ITALIC' : 'NORMAL';
      }
    }
  }
}

export function converterStyle(weight: number, italic: boolean) {
  const styles: Record<number,string> = {100:'Thin',200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black'};
  const style = styles[weight] || 'Regular';
  return italic ? style === 'Regular' ? 'Italic' : `${style} Italic` : style;
}
