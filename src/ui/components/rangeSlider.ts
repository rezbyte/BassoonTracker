import { ScaleRule } from "../basetypes";
import type { Drag } from "../input";
import { Y } from "../yascal/yascal";
import Element, { Changeable, ElementProperties } from "./element";
import Scale9Panel from "./scale9";

interface RangeSliderProperties extends ElementProperties {
  min?: number;
  max?: number;
  value?: number;
  vertical?: boolean;
  onChange?: ((value: number) => void) | undefined;
}

export default class RangeSlider extends Element implements Changeable<number> {
  private knob: HTMLCanvasElement;
  private knobVert: HTMLCanvasElement;
  private backImageVert: HTMLCanvasElement;
  private vertical: boolean;
  private maxHeight: number;
  private back: Scale9Panel;
  private knobLeft: number;
  private knobTop: number;
  private startKnobLeft: number;
  private startKnobTop: number;
  private min: number;
  private max: number;
  private value: number;
  onChange: ((value: number) => void) | undefined;

  constructor(initialProperties?: RangeSliderProperties) {
    // UI.rangeSlider
    super();
    this.type = "rangeslider";

    this.knob = this.getImage("slider_knob");
    this.knobVert = this.getImage("slider_knob_vert");
    const backImage = this.getImage("slider_back");
    this.backImageVert = this.getImage("slider_back_vert");
    this.vertical = false;
    this.maxHeight = 0;

    this.back = new Scale9Panel(0, 0, 0, 0, {
      img: backImage,
      left: 4,
      right: 4,
      top: 0,
      bottom: 0,
      scale: ScaleRule.repeatX,
    });
    this.addChild(this.back);
    this.back.ignoreEvents = true;

    this.knobLeft = 0;
    this.knobTop = 0;
    this.startKnobLeft = 0;
    this.startKnobTop = 0;

    this.min = 0;
    this.max = 100;
    this.value = 0;
    if (initialProperties) this.setProperties(initialProperties);
  }

  private getImage(src: string): HTMLCanvasElement {
    const image = Y.getImage(src);
    if (image == null) {
      throw new Error(`Failed to get image: ${src} for RangeSlider!`);
    }
    return image;
  }

  setProperties(p: RangeSliderProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;
    this.onChange = p.onChange ?? this.onChange;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    if (typeof p.min !== "undefined") this.min = p.min;
    if (typeof p.max !== "undefined") this.max = p.max;
    if (typeof p.value !== "undefined") this.setValue(p.value, true);
    if (typeof p.vertical !== "undefined") {
      this.vertical = !!p.vertical;

      this.back.setProperties({
        img: this.backImageVert,
        imgLeft: 0,
        imgRight: 0,
        imgTop: 4,
        imgBottom: 4,
        scale: ScaleRule.repeatY,
      });
    }
  }

  getValue(): number {
    return this.value;
  }

  setValue(v: number, internal?: boolean) {
    if (v > this.max) v = this.max;
    if (v < this.min) v = this.min;

    const hasChanged = !internal && this.value !== v;
    this.value = v;

    if (this.vertical) {
      const relMax = this.max - this.min;
      this.knobTop = this.maxHeight * (1 - (v - this.min) / relMax);
    } else {
      const maxWidth = this.width - this.knob.width;
      this.knobLeft = (maxWidth * v) / this.max;
    }

    this.refresh();

    if (hasChanged && !internal) {
      if (this.onChange) this.onChange(this.value);
    }
  }

  setMax(newMax: number, skipCheck: boolean) {
    this.max = newMax;
    if (!skipCheck && this.value > this.max) this.setValue(this.max);
  }
  setMin(newMin: number, skipCheck: boolean) {
    this.min = newMin;
    if (!skipCheck && this.value < this.min) this.setValue(this.min);
  }

  render(internal?: boolean) {
    if (this.needsRendering) {
      internal = !!internal;
      this.clearCanvas();

      const cx = Math.floor(this.width / 2) + 3;
      const cw = 6;
      let ch = this.height;
      if (this.min < 0) ch = Math.floor(ch / 2);

      this.ctx.fillStyle = "rgba(255,255,255,0.1";

      this.ctx.beginPath();
      this.ctx.moveTo(cx, ch);
      this.ctx.lineTo(cx, 2);
      this.ctx.lineTo(cx + cw, 2);
      this.ctx.fill();

      if (this.min < 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(cx - 6, ch);
        this.ctx.lineTo(cx - 6, this.height);
        this.ctx.lineTo(cx - 6 - cw, this.height);
        this.ctx.fill();
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(cx - 6, ch);
        this.ctx.lineTo(cx - 6, 2);
        this.ctx.lineTo(cx - 6 - cw, 2);
        this.ctx.fill();
      }

      this.back.render();
      if (this.vertical) {
        this.ctx.drawImage(
          this.knobVert,
          -1,
          this.knobTop,
          this.knobVert.width,
          this.knobVert.height,
        );
      } else {
        this.ctx.drawImage(
          this.knob,
          this.knobLeft,
          -1,
          this.knob.width,
          this.knob.height,
        );
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

  onResize() {
    this.maxHeight = this.height - this.knobVert.height + 3;

    this.back.setSize(this.width, this.height);
    this.setValue(this.value, true);
  }

  onDragStart() {
    this.startKnobLeft = this.knobLeft;
    this.startKnobTop = this.knobTop;
  }

  onDrag(touchData: Drag) {
    if (this.vertical) {
      const delta = touchData.deltaY;
      this.knobTop = this.startKnobTop + delta;
      if (this.knobTop < 0) this.knobTop = 0;

      if (this.knobTop > this.maxHeight) this.knobTop = this.maxHeight;

      if (this.maxHeight > this.knob.height) {
        const relMax = this.max - this.min;
        const relValue =
          relMax - Math.round((relMax * this.knobTop) / this.maxHeight);
        this.value = relValue + this.min;
      } else {
        this.value = this.max;
      }
    } else {
      const delta = touchData.deltaX ?? 0;
      this.knobLeft = this.startKnobLeft + delta;
      if (this.knobLeft < 0) this.knobLeft = 0;

      const maxWidth = this.width - this.knob.width;
      if (this.knobLeft > maxWidth) this.knobLeft = maxWidth;

      if (maxWidth > this.knob.width) {
        this.value = Math.round((this.max * this.knobLeft) / maxWidth);
      } else {
        this.value = 0;
      }
    }

    this.refresh();
    if (this.onChange) this.onChange(this.value);
  }
}
