import { ScaleRule, TextAlignment } from "../basetypes";
import { Y } from "../yascal/yascal";
import type { ElementProperties } from "./element";
import Element from "./element";

export default class Image extends Element {
  private baseImage: HTMLCanvasElement | null;
  private scale: ScaleRule | null;
  private verticalAlign: "top" | null;
  private horizintalAlign: TextAlignment | null;

  constructor(
    x: number | undefined,
    y: number | undefined,
    w: number | undefined,
    h: number | undefined,
    src: string,
  ) {
    // UI.image
    w = w || 14;
    h = h || 14;
    super(x, y, w, h); // super(x,y,w,h,true)
    const baseImage = Y.getImage(src);
    if (baseImage == null) {
      console.error(`Failed to get image: ${src} for Image element!`);
    }
    this.baseImage = baseImage ?? null;
    this.scale = null;
    this.verticalAlign = null;
    this.horizintalAlign = null;
  }

  setProperties(p: ElementProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
  }

  render(internal?: boolean) {
    internal = !!internal;
    if (!this.isVisible()) return;

    if (this.needsRendering) {
      this.clearCanvas();
      if (this.baseImage)
        switch (this.scale) {
          case ScaleRule.stretch:
            this.ctx.drawImage(this.baseImage, 0, 0, this.width, this.height);
            break;
          default:
            let marginW = (this.width - this.baseImage.width) >> 1;
            let marginH = (this.height - this.baseImage.height) >> 1;
            if (this.verticalAlign === "top") marginH = 0;
            if (this.horizintalAlign === TextAlignment.right)
              marginW = this.width - this.baseImage.width;
            this.ctx.drawImage(this.baseImage, marginW, marginH);
        }
    }
    this.needsRendering = false;

    if (internal) {
      return this.canvas;
    } else {
      this.parentCtx.drawImage(
        this.canvas,
        this.left,
        this.top,
        this.width,
        this.height,
      );
    }
  }
}
