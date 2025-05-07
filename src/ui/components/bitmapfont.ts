interface BitmapFontConfigBase {
  image: CanvasImageSource;
  startX: number;
  startY: number;
  charHeight: number;
  spaceWidth?: number;
  margin: number;
  lineSpacing?: number;
  chars?: string;
  onlyUpperCase?: boolean;
  debug?: boolean;
}
interface FixedWidthBitmapFontConfig extends BitmapFontConfigBase {
  charWidth: number;
  charsPerLine: number;
}
interface DynamicWidthBitmapFontConfig extends BitmapFontConfigBase {
  charWidth: number[] | string;
  charsPerLine: number[];
}
type BitmapFontConfig =
  | FixedWidthBitmapFontConfig
  | DynamicWidthBitmapFontConfig;

export default class BitmapFont {
  charWidth: number | number[];
  private widthArray: number[] = [];
  charHeight: number;
  private charSpacing: number;
  fixedWidth: boolean;
  private spaceWidth: number;
  private onlyUpperCase = false;
  private debug = false;
  private fontArray: HTMLCanvasElement[];
  private colors: Record<string, HTMLCanvasElement[]>;

  private getCharWidth(index: number, fixedWidth: boolean): number {
    if (fixedWidth && typeof this.charWidth === "number") {
      return this.charWidth;
    } else if (!fixedWidth && typeof this.charWidth === "object") {
      return this.charWidth[index];
    } else {
      throw new Error(
        `Invalid CharWidth state in Bitmap font! fixedWidth: ${fixedWidth} typeof charWidth ${typeof this.charWidth}`,
      );
    }
  }

  constructor(config: BitmapFontConfig) {
    // Formerly named 'generate'
    const img = config.image;
    const startX = config.startX;
    const startY = config.startY;
    const h = config.charHeight;
    this.spaceWidth = config.spaceWidth || 8;
    const margin = config.margin;
    const lineSpacing = config.lineSpacing || 0;
    const lineWidth = config.charsPerLine;
    const chars = config.chars || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    this.onlyUpperCase = config.onlyUpperCase ?? false;
    this.debug = !!config.debug;

    this.fontArray = [];
    this.colors = {};
    this.charSpacing = margin;
    const charHeight = h;
    this.charHeight = h;

    const { fixedWidth, charWidth } = BitmapFont.parseCharWidth(
      config.charWidth,
    );
    this.fixedWidth = fixedWidth;
    this.charWidth = charWidth;

    let _x = startX;
    let _y = startY;
    let _line = 0;
    let _lineIndex = 0;

    for (let i = 0, len = chars.length; i <= len; i++) {
      const myCanvas = document.createElement("canvas");

      const w = this.getCharWidth(i, this.fixedWidth) || 1;

      myCanvas.width = w;
      myCanvas.height = h;

      const myCtx = myCanvas.getContext("2d");
      if (myCtx == null) {
        console.error(`Failed to get canvas context for bitmap font: ${img}`);
        return;
      }

      let x: number;
      let y: number;
      if (this.fixedWidth && typeof lineWidth == "number") {
        x = startX + (i % lineWidth) * (w + margin);
        y = startY + Math.floor(i / lineWidth) * (h + lineSpacing);
      } else if (!this.fixedWidth && typeof lineWidth == "object") {
        x = _x;
        y = _y;
        _x += w + margin;
        _lineIndex++;

        if (_lineIndex >= lineWidth[_line]) {
          _line++;
          _lineIndex = 0;
          _x = startX;
          _y += charHeight + lineSpacing;
        }
      } else {
        throw new Error(
          `A BitmapFont received a config with conflicting width settings! lineWidth: ${lineWidth}, charWidth ${config.charWidth}`,
        );
      }

      myCtx.drawImage(img, x, y, w, h, 0, 0, w, h);

      const charCode = chars.charCodeAt(i);
      this.fontArray[charCode] = myCanvas;
      this.widthArray[charCode] = w;
    }
  }

  private static parseCharWidth(rawCharWidth: string | number | number[]): {
    fixedWidth: boolean;
    charWidth: number[] | number;
  } {
    switch (typeof rawCharWidth) {
      case "number":
        return { fixedWidth: true, charWidth: rawCharWidth };
      case "string":
        const splitCharWidth = rawCharWidth.split("");
        const charWidth: number[] = new Array(splitCharWidth.length);
        splitCharWidth.forEach(function (c, index) {
          charWidth[index] = parseInt(c);
        });
        return { fixedWidth: false, charWidth };
      case "object":
        return { fixedWidth: false, charWidth: rawCharWidth };
    }
  }

  getCharWidthAsFixed(): number {
    return Array.isArray(this.charWidth) ? this.charWidth[0] : this.charWidth;
  }

  generateColor(colorName?: string, color?: string) {
    colorName = colorName || "green";
    color = color || "rgba(107, 161, 65,0.9)";

    const fontArrayColor: HTMLCanvasElement[] = [];

    this.fontArray.forEach(function (c, index: number) {
      const c2 = document.createElement("canvas");
      const c3 = document.createElement("canvas");
      c2.width = c.width;
      c2.height = c.height;
      c3.width = c.width;
      c3.height = c.height;
      const cx2 = c2.getContext("2d");
      const cx3 = c3.getContext("2d");
      if (cx2 == null || cx3 == null) {
        console.error(
          `Failed to create canvas context while generating color: ${colorName} for a font`,
        );
        return;
      }

      cx3.fillStyle = color;
      cx3.fillRect(0, 0, 16, 16);

      cx3.globalCompositeOperation = "destination-atop";
      cx3.drawImage(c, 0, 0);

      cx2.drawImage(c3, 0, 0);
      cx2.globalCompositeOperation = "darken";
      cx2.drawImage(c, 0, 0);

      fontArrayColor[index] = c2;
    });
    this.colors[colorName] = fontArrayColor;
  }

  getTextWidth(text: string, spacing?: number): number {
    if (this.onlyUpperCase) text = text.toUpperCase();
    spacing = spacing || this.charSpacing;
    let w = 0;

    for (let i = 0, len = text.length; i < len; i++) {
      const code = text.charCodeAt(i);
      const _w = this.widthArray[code] || this.spaceWidth;
      w += _w + spacing;
    }

    return w;
  }

  write(
    canvasCtx: CanvasRenderingContext2D,
    text: string,
    x?: number,
    y?: number,
    spacing?: number,
    color?: string,
  ) {
    if (this.onlyUpperCase) text = text.toUpperCase();

    const colorArray =
      color == null || this.colors[color] == null
        ? this.fontArray
        : this.colors[color];

    spacing = spacing || this.charSpacing;
    x = x || 0;
    y = y || 0;
    let _x = x;

    for (let i = 0, len = text.length; i < len; i++) {
      const code = text.charCodeAt(i);
      const c = colorArray[code];
      let w = this.widthArray[code];

      if (!w) {
        if (code !== 32) console.warn("no font for char " + code);
        w = this.spaceWidth;
      }

      if (c) canvasCtx.drawImage(c, _x, y, w, this.charHeight);

      _x += w + spacing;
    }
  }
}
