import { FILETYPE, SAMPLETYPE } from "../../enum";
import { Size, TextAlignment } from "../basetypes";
import { Touch } from "../input";
import { UI } from "../main";
import { Y } from "../yascal/yascal";
import Element, { Changeable, ElementProperties } from "./element";

// TODO: Make generic with a value property so there is no need to keep expanding this
export interface RadioGroupItem {
  target?: string;
  fileFormat?: SAMPLETYPE;
  extention?: string;
  label: string;
  active?: boolean;
  index?: number;
  labels?: { width: number; label: string }[];
  fileType?: FILETYPE;
}

type RadioGroupSize = Size.small | Size.medium;

interface RadioGroupProperties extends ElementProperties {
  align?: TextAlignment;
  size?: RadioGroupSize;
  divider?: "line";
  highLightSelection?: true;
}

export default class RadioGroup extends Element implements Changeable<number> {
  private items: RadioGroupItem[] = [];

  private previousSelectedIndex: number | undefined;
  private selectedIndex: number | undefined;

  private startY: number;
  private size: RadioGroupSize;
  private align: TextAlignment;
  private buttonY: number;
  private itemHeight: number;
  private divider: "line" | undefined;
  private highLightSelection: true | undefined;
  onChange: ((value: number) => void) | undefined;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    // Formerly UI.radioGroup
    super(x, y, w, h); // super(x,y,w,h,true)
    this.startY = 0;
    this.size = Size.small;
    this.align = TextAlignment.right;
    this.buttonY = -3;
    this.itemHeight = 13;
    this.type = "radio";
  }

  setProperties(p: RadioGroupProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    if (p.align) this.align = p.align;
    if (p.size) this.size = p.size;
    if (p.divider) this.divider = p.divider;
    if (p.type) this.type = p.type;
    if (p.highLightSelection) this.highLightSelection = true;
  }

  onClick(e: Touch) {
    if (this.eventY == null) {
      console.error("Missing eventY for a RadioGroup's onClick handler!");
      return;
    }
    this.setSelectedIndex(
      Math.floor((this.eventY - this.startY + this.buttonY) / this.itemHeight),
    );
  }

  setSelectedIndex(index: number, internal?: boolean) {
    index = Math.min(index, this.items.length - 1);
    for (let i = 0, len = this.items.length; i < len; i++) {
      this.items[i].active = i == index;
    }
    this.selectedIndex = index;
    this.refresh();

    if (
      !internal &&
      this.onChange &&
      this.previousSelectedIndex != this.selectedIndex
    )
      this.onChange(this.selectedIndex);
    this.previousSelectedIndex = this.selectedIndex;
  }

  getSelectedIndex(): number | undefined {
    return this.selectedIndex;
  }

  getSelectedItem(): RadioGroupItem | undefined {
    if (this.selectedIndex == null) return;
    return this.items[this.selectedIndex];
  }

  render(internal?: boolean) {
    internal = !!internal;
    if (!this.isVisible()) return;

    if (this.needsRendering) {
      this.clearCanvas();

      let buttonActiveName = "radio_active";
      let buttonInactiveName = "radio_inactive";
      this.itemHeight = Math.floor(this.height / this.items.length);

      let font = UI.fontSmall;
      let textX = 5;
      let buttonX = this.width - 15;
      this.buttonY = -3;

      if (this.size === Size.medium) {
        buttonActiveName = "radio_big_active";
        buttonInactiveName = "radio_big_inactive";
        this.buttonY = -2;
        buttonX = this.width - 20;
        font = UI.fontMed;
      }

      if (font == null) {
        const fontName = this.size === Size.medium ? "fontMed" : "fontSmall";
        console.error(`Failed to get the font: ${fontName} for a RadioGroup!`);
        return;
      }

      const paddingTop = Math.floor((this.itemHeight - font.charHeight) / 2);

      if (this.align === TextAlignment.left) {
        textX = 30;
        buttonX = 5;
      }

      const line = Y.getImage("line_hor");
      if (line == null) {
        console.error("Missing image: line_hor while rendering RadioGroup!");
        return;
      }

      for (let i = 0, len = this.items.length; i < len; i++) {
        const item = this.items[i];
        const itemTop = this.startY + i * this.itemHeight;
        const textTop = itemTop + paddingTop;

        if (this.divider == "line" && i > 0) {
          this.ctx.drawImage(line, 0, itemTop, this.width, 2);
        }

        if (font) {
          let label = item.label;
          if (this.align === TextAlignment.right) {
            textX = buttonX - font.getTextWidth(item.label, 0) - 4;
            if (textX < 0 && item.labels) {
              const rest = buttonX - 4;
              item.labels.forEach(function (lb) {
                if (lb.width <= rest) label = lb.label;
              });
              textX = buttonX - font.getTextWidth(label, 0) - 4;
            }
          }

          font.write(this.ctx, label, textX, textTop, 0);
        }

        if (item.active) {
          if (this.highLightSelection) {
            this.ctx.fillStyle = "rgba(100,100,255,0.1";
            this.ctx.fillRect(0, itemTop, this.width - 2, this.itemHeight);
          }

          const buttonActive = Y.getImage(buttonActiveName);
          if (buttonActive == null) {
            console.error(`Missing image: ${buttonActiveName} for RadioGroup!`);
            return;
          }
          this.ctx.drawImage(buttonActive, buttonX, textTop + this.buttonY);
        } else {
          const buttonInactive = Y.getImage(buttonInactiveName);
          if (buttonInactive == null) {
            console.error(
              `Missing image: ${buttonInactiveName} for RadioGroup!`,
            );
            return;
          }
          this.ctx.drawImage(buttonInactive, buttonX, textTop + this.buttonY);
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

  setItems(newItems: RadioGroupItem[]) {
    this.selectedIndex = undefined;
    this.items = newItems;
    for (let i = 0, len = this.items.length; i < len; i++) {
      if (this.items[i].active) this.selectedIndex = i;
    }

    this.refresh();
  }

  /* getItemAtPosition(x: number, y: number) {
		y = y-this.startY;
		const index = Math.floor(y/this.itemHeight) + visibleIndex;
		if (index>=0 && index<this.items.length){
			this.items[index].index = index;
			return(this.items[index]);
		}else{
			return undefined;
		}
	}; */
}
