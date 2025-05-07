import {
  ElementLabelProperties,
  LabelStruct,
  TextAlignment,
} from "../basetypes";
import Element, { ElementProperties } from "./element";
import BitmapFont from "./bitmapfont";
import Scale9Panel from "./scale9";
import { Scale9 } from "../assets";

// "checkbox" is now implemented in checkboxbutton
// "radio" appears unused
// "active" -> isActive
export interface ButtonProperties
  extends ElementProperties,
    ElementLabelProperties {
  image?: HTMLCanvasElement;
  backgroundImage?: CanvasImageSource;
  background?: Scale9Panel | Scale9;
  isActive?: boolean;
  hoverBackground?: Scale9Panel | Scale9;
  hoverImage?: HTMLCanvasElement;
  activeBackground?: Scale9Panel | Scale9;
  activeImage?: HTMLCanvasElement;
  paddingTopActive?: number;
  paddingLeft?: number;
  labels?: LabelStruct[];
}

export default interface Button {
  renderInternal?(): void;
}
export default class Button extends Element {
  isActive: boolean;
  isDisabled: boolean;
  private label: string;
  private image: HTMLCanvasElement | undefined;
  private backgroundImage: CanvasImageSource | undefined;
  private background: Scale9Panel | undefined;
  private activeBackground: Scale9Panel | undefined;
  private hoverBackground: Scale9Panel | undefined;
  private activeImage: HTMLCanvasElement | undefined;
  private hoverImage: HTMLCanvasElement | undefined;
  private font: BitmapFont | undefined;
  private textAlign: TextAlignment;
  private paddingTop: number;
  private paddingTopActive: number;
  private paddingLeft: number;
  private hasHover: boolean;
  private isHover: boolean;
  info: { label: string; onClick: () => void } | undefined; // Used by pattern sidebar
  index: number | null = null; // Used by options panel
  widthParam = 100; // Used by sample view

  constructor(x?: number, y?: number, w?: number, h?: number, text?: string) {
    // Formerly UI.button
    super(x, y, w, h);
    this.type = "button";
    this.isActive = false;
    this.isDisabled = false;
    this.label = text || "";
    this.textAlign = TextAlignment.left;
    this.paddingTop = 0;
    this.paddingTopActive = 0;
    this.paddingLeft = 10;
    this.hasHover = true;
    this.isHover = false;
  }

  setProperties(p: ButtonProperties) {
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
    this.image = p.image ?? this.image;
    this.backgroundImage = p.backgroundImage ?? this.backgroundImage;
    if (p.background && Button.isScale9(p.background)) {
      this.backgroundImage = undefined;
      this.background = new Scale9Panel(0, 0, 0, 0, p.background);
      this.background.setParent(this);
    } else if (p.background) {
      this.background = p.background;
    }
    this.isActive = p.isActive ?? this.isActive;
    if (p.hoverBackground) {
      this.hasHover = true;
      if (Button.isScale9(p.hoverBackground)) {
        this.hoverBackground = new Scale9Panel(0, 0, 0, 0, p.hoverBackground);
        this.hoverBackground.setParent(this);
      } else {
        this.hoverBackground = p.hoverBackground;
      }
    }
    if (p.hoverImage) {
      this.hoverImage = p.hoverImage;
      this.hasHover = true;
    }
    if (p.activeBackground && Button.isScale9(p.activeBackground)) {
      this.activeBackground = new Scale9Panel(0, 0, 0, 0, p.activeBackground);
      this.activeBackground.setParent(this);
    } else if (p.activeBackground) {
      this.activeBackground = p.activeBackground;
    }
    this.activeImage = p.activeImage ?? this.activeImage;
    this.paddingTopActive = p.paddingTopActive ?? this.paddingTopActive;
    this.paddingLeft = p.paddingLeft ?? this.paddingLeft;

    if (this.background) this.background.setSize(this.width, this.height);
    if (this.activeBackground)
      this.activeBackground.setSize(this.width, this.height);
    if (this.hoverBackground)
      this.hoverBackground.setSize(this.width, this.height);
    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    if (p.labels) {
      this.onResize = () => {
        if (p.labels) {
          const currentLabel = this.label;
          p.labels.forEach((item) => {
            if (this.width >= item.width) this.label = item.label;
          });
          if (currentLabel !== this.label) this.refresh();
        }
      };
    }
  }

  private static isScale9(image: Scale9 | Scale9Panel): image is Scale9 {
    return (image as Scale9).img !== undefined;
  }

  setBackgroundImage(img: CanvasImageSource) {
    this.backgroundImage = img;
    this.refresh();
  }

  setFont(f: BitmapFont) {
    this.font = f;
    this.refresh();
  }

  setLabel(text: string) {
    this.label = text;
    this.refresh();
  }

  toggleActive() {
    this.isActive = !this.isActive;
    this.refresh();
  }

  setActive(state = true) {
    this.isActive = !!state;
    this.refresh();
  }

  setDisabled(state?: boolean) {
    if (typeof state == "undefined") state = true;
    this.isDisabled = state;
    if (state) this.isActive = false;
    this.refresh();
  }

  onHover() {
    if (this.hasHover) {
      if (!this.isActive) {
        this.isHover = true;
        this.refresh();
      }
    }
  }

  onHoverExit() {
    if (this.hasHover && this.isHover) {
      this.isHover = false;
      this.refresh();
    }
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;
    if (this.needsRendering) {
      internal = !!internal;
      const drawFonts = true;
      //this.ctx.clearRect(0,0,this.width,this.height,backgroundImage);

      if (this.backgroundImage) {
        this.ctx.drawImage(this.backgroundImage, 0, 0, this.width, this.height);
      } else if (this.background) {
        if (this.isActive && this.activeBackground) {
          this.activeBackground.render();
          if (this.activeImage) {
            const imgY = Math.floor(
              (this.height - this.activeImage.height) / 2,
            );
            const imgX = Math.floor((this.width - this.activeImage.width) / 2);
            this.ctx.drawImage(this.activeImage, imgX, imgY);
            //drawFonts = false;
          }
        } else {
          let stateImage = this.image;
          if (this.isHover && this.hoverImage) {
            stateImage = this.hoverImage;
          }
          if (this.isHover && this.hoverBackground) {
            this.hoverBackground.render();
          } else {
            this.background.render();
          }
          if (stateImage) {
            const imgY = Math.floor((this.height - stateImage.height) / 2);
            const imgX = Math.floor((this.width - stateImage.width) / 2);
            this.ctx.drawImage(stateImage, imgX, imgY);
            //drawFonts = false;
          }
        }
      } else {
        this.ctx.fillStyle = "grey";
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = "black";
        this.ctx.rect(0, 0, this.width, this.height);
        this.ctx.stroke();
      }

      if (this.label && drawFonts) {
        const fontSize = 10;
        const fontWidth = 8; // TODO: get from font
        const textY =
          Math.floor((this.height - fontSize) / 2) +
          (this.isActive ? this.paddingTopActive : this.paddingTop);
        let textX = this.paddingLeft;
        if (this.font) {
          if (this.textAlign === TextAlignment.center) {
            let textLength = this.label.length * fontWidth;
            if (!this.font.fixedWidth)
              textLength = this.font.getTextWidth(this.label, 0);
            textX = Math.floor((this.width - textLength) / 2);
          }
          if (this.textAlign === TextAlignment.right) {
            let textLength = this.label.length * fontWidth;
            if (!this.font.fixedWidth)
              textLength = this.font.getTextWidth(this.label, 0);
            textX = this.width - textLength - 5;
          }
          this.font.write(this.ctx, this.label, textX, textY, 0);
        } else {
          this.ctx.fillStyle = "white";
          this.ctx.fillText(this.label, textX, textY);
        }
      }

      if (this.isDisabled) {
        this.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      if (this.renderInternal) this.renderInternal();
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
