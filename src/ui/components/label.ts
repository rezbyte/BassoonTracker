import {
  ElementLabelProperties,
  LabelStruct,
  TextAlignment,
} from "../basetypes";
import BitmapFont from "./bitmapfont";
import Element, { ElementProperties } from "./element";

interface LabelProperties extends ElementProperties, ElementLabelProperties {
  labels?: LabelStruct[];
}

export default class Label extends Element {
  private label: string;
  private font: BitmapFont | null;
  private textAlign: TextAlignment;
  private paddingTop: number;

  constructor(initialProperties?: LabelProperties) {
    // UI.label
    super();
    this.type = "label";

    this.label = "";
    this.font = null;
    this.textAlign = TextAlignment.left;
    this.paddingTop = 0;
    if (initialProperties) this.setProperties(initialProperties);
  }

  setProperties(p: LabelProperties) {
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

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    if (p.labels) {
      const labels = p.labels;
      this.onResize = () => {
        const currentLabel = this.label;
        labels.forEach((item) => {
          if (this.width >= item.width) this.label = item.label;
        });
        if (currentLabel !== this.label) this.refresh();
      };
    }
  }

  setFont(f: BitmapFont) {
    this.font = f;
    this.refresh();
  }

  getFont(): BitmapFont | null {
    return this.font;
  }

  setLabel(text: string) {
    this.label = text;
    this.refresh();
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;
    if (this.needsRendering) {
      internal = !!internal;

      this.clearCanvas();

      if (this.label) {
        const fontSize = 10;
        const textY =
          Math.floor((this.height - fontSize) / 2) + this.paddingTop;
        let textX = 10;
        if (this.font) {
          let textLength;
          if (this.textAlign === TextAlignment.center) {
            textLength = this.font.getTextWidth(this.label, 0);
            textX = Math.floor((this.width - textLength) / 2);
          }
          if (this.textAlign === TextAlignment.right) {
            textLength = this.font.getTextWidth(this.label, 0);
            textX = Math.floor(this.width - textLength) - 10;
          }
          this.font.write(this.ctx, this.label, textX, textY, 0);
        } else {
          this.ctx.fillStyle = "white";
          this.ctx.fillText(this.label, textX, textY);
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
}
