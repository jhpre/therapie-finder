import regular from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import bold from "dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url";
import italic from "dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf?url";

/**
 * Font family used in the PDF. DejaVu Sans covers äöüß „“ – ½ × and ☐ ☎ ✉.
 * Licence: Bitstream Vera-derived (free to embed and redistribute), not literally OFL.
 */
export const PDF_FONT = "DejaVu Sans";

/** Bundled TTF files (emitted as own assets, same origin). */
export const fontSources = { regular, bold, italic };
