import { Y } from "../yascal/yascal";
import Element, { ElementProperties } from "./element";
import Ticker from "../ticker";

export default class Animsprite extends Element {
  private w: number;
  private h: number;
  private readonly baseImage: HTMLCanvasElement;
  private step: number;
  private frames: number;

  constructor(
    x: number | undefined,
    y: number | undefined,
    w: number | undefined,
    h: number | undefined,
    baseImageName: string,
    frames: number,
  ) {
    // UI.animsprite
    w = w || 14;
    h = h || 14;

    super(x, y, w, h); // super(x,y,w,h,true);

    this.w = w;
    this.h = h;
    const baseImage = Y.getImage(baseImageName);
    if (baseImage == null) {
      throw new Error(`Failed to load image: ${baseImageName} for Animsprite!`);
    }
    this.baseImage = baseImage;
    this.step = 0;
    this.frames = frames;
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

  onShow() {
    Ticker.onEachTick2(() => {
      this.step++;
      if (this.step >= this.frames) this.step = 0;
      this.refresh();
    }, 0);
  }

  onHide() {
    Ticker.onEachTick2();
  }

  render(internal?: boolean) {
    internal = !!internal;

    if (this.needsRendering) {
      this.clearCanvas();
      this.ctx.drawImage(
        this.baseImage,
        this.step * this.w,
        0,
        this.w,
        this.h,
        0,
        0,
        this.w,
        this.h,
      );
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
