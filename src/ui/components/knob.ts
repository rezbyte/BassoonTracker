import { Y } from "../yascal/yascal";
import BitmapFont from "./bitmapfont";
import Element, { ElementProperties, Changeable } from "./element";
import { UI } from "../main";
import type { Drag, Touch } from "../input";
import { ElementLabelProperties, TextAlignment } from "../basetypes";

interface KnobProperties extends ElementProperties, ElementLabelProperties {
  disabled?: boolean;
}

export default class Knob extends Element implements Changeable<number> {
  private label: string;
  private font: BitmapFont | null;
  private textAlign: TextAlignment;
  private paddingTop: number;

  private angle: number;
  private value: number;
  private startValue: number;

  private min: number;
  private max: number;

  private readonly properties = [
    "left",
    "top",
    "width",
    "height",
    "name",
    "font",
    "label",
    "textAlign",
    "paddingTop",
    "disabled",
  ];

  private img: HTMLCanvasElement;
  private imgDisabled: HTMLCanvasElement;
  private front: HTMLCanvasElement;
  private padding: number;
  isDisabled: boolean;
  onToggle: ((checked: boolean) => void) | null;
  onChange: ((value: number) => void) | undefined;

  constructor() {
    // Formerly UI.knob
    super();
    this.type = "knob";

    this.label = "";
    this.font = null;
    this.textAlign = TextAlignment.left;
    this.paddingTop = 0;

    this.angle = 0;
    this.value = 50;
    this.startValue = this.value;

    this.min = -160;
    this.max = 160;
    this.img = this.getImage("knob_back");
    this.imgDisabled = this.getImage("knob_back_inactive");
    this.front = this.getImage("knob_front");
    this.padding = 16;
    this.width = this.img.width + this.padding * 2;
    this.height = this.img.height + this.padding * 2;
    this.setSize(this.width, this.height);
    this.isDisabled = false;
    this.onToggle = null;
  }

  private getImage(imageName: string): HTMLCanvasElement {
    const image = Y.getImage(imageName);
    if (image == null) {
      throw new Error(`Failed to get image: ${imageName} to initalize Knob!`);
    }
    return image;
  }

  setProperties(p: KnobProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;
    this.label = p.label ?? this.label;
    this.font = p.font ?? this.font;
    this.textAlign = p.textAlign ?? this.textAlign;
    this.paddingTop = p.paddingTop ?? this.paddingTop;
    this.isDisabled = p.disabled ?? this.isDisabled;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
  }

  setFont(f: BitmapFont) {
    this.font = f;
    this.refresh();
  }

  setLabel(text: string) {
    this.label = text;
    this.refresh();
  }

  getLabel() {
    return this.label;
  }

  setValue(newValue: number) {
    this.angle = newValue;
    this.refresh();
  }

  getValue() {
    return this.value;
  }

  render(internal?: boolean) {
    if (this.needsRendering) {
      internal = !!internal;

      this.clearCanvas();

      let scale = 1;
      scale = 0.8; // TODO: Why mutate immediately??

      const imgw = this.img.width * scale;
      const imgh = this.img.height * scale;

      const w = imgw / 2;
      const h = imgh / 2;

      //this.ctx.drawImage(img,0,0);

      this.ctx.save();
      this.ctx.translate(this.padding + w, this.padding + h);
      this.ctx.drawImage(
        this.isDisabled ? this.imgDisabled : this.img,
        -w,
        -h,
        imgw,
        imgh,
      );

      // value is from 0 to 100;
      //const value = angle+50;

      const minAngle = -230;
      const maxAngle = 50;

      const max = Math.abs(minAngle) + maxAngle;
      const angleValue = minAngle + (this.value / 100) * max;

      const startAngle = (minAngle * Math.PI) / 180;
      const endAngle = (angleValue * Math.PI) / 180;

      this.ctx.fillStyle = this.isDisabled
        ? "rgba(170,170,170,0.5)"
        : "rgba(130,200,255,0.5)";
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 30, startAngle, endAngle, false); // outer (filled)
      this.ctx.arc(0, 0, 25, endAngle, startAngle, true); // outer (unfills it)
      this.ctx.fill();

      const angle = (this.value / 100) * 320 - 160;
      this.ctx.rotate((angle * Math.PI) / 180);
      this.ctx.drawImage(this.front, -w, -h, imgw, imgh);

      this.ctx.restore();

      if (this.label) {
        let labelX = (this.width - this.label.length * 6) / 2;
        labelX = this.padding + w - this.label.length * 3;
        if (UI.fontSmall) {
          UI.fontSmall.write(
            this.ctx,
            this.label,
            labelX,
            imgh + this.padding + 4,
          );
        } else {
          console.error(
            "Could not render label for Knob due to missing small font.",
          );
        }
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

  onDragStart() {
    this.startValue = this.value;
  }

  onDrag(touchData: Drag) {
    if (this.isDisabled) return;

    const delta = touchData.deltaY;
    if (!delta) return;
    this.value = this.startValue + delta;
    this.value = Math.max(this.value, 0);
    this.value = Math.min(this.value, 100);
    this.refresh();

    if (this.onChange) this.onChange(this.value);
  }

  onClick(e: Touch) {
    if (Math.abs(e.x - e.startX) < 3 && Math.abs(e.y - e.startY) < 3) {
      this.toggleDisabled();
    }
  }

  toggleDisabled() {
    this.isDisabled = !this.isDisabled;
    if (this.onToggle) this.onToggle(!this.isDisabled);
    this.refresh();
  }
}
