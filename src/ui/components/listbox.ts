import { Y } from "../yascal/yascal";
import Element, { Changeable, ElementProperties } from "./element";
import Scale9Panel from "./scale9";
import Assets from "../assets";
import Button from "./button";
import BitmapFont from "./bitmapfont";
import { UI } from "../main";
import type { TouchData, Touch, Drag } from "../input";

export interface ListBoxItem {
  title?: string; // TODO: Replace usages with label, this is done at runtime by `addListatLevel` in diskOperations
  parent?: ListBoxItem;
  children?: ListBoxItem[];
  isExpanded?: boolean;
  label: string;
  data?: number;
  level?: number;
  index: number;
  url?: string;
  icon?: HTMLCanvasElement | string;
  info?: string;
}

interface ListBoxProperties extends ElementProperties, Changeable<void> {
  selectedIndex?: number;
  centerSelection?: boolean;
  font?: BitmapFont;
}
export default class ListBox extends Element {
  private previousSelectedIndex = 0;
  private font: BitmapFont;
  private fontSmall: BitmapFont;
  private items: ListBoxItem[] = [];
  private visibleIndex = 0;
  private visibleIitems = 0;
  private lineHeight = 18;
  private startY = 10;
  private scrollBarItemOffset = 0;
  private hoverIndex: number | undefined;
  private prevHoverIndex: number | undefined;
  private selectedIndex: number;
  private centerSelection = false;
  private background: Scale9Panel;
  onChange: (() => void) | undefined;
  private buttonUp: Button;
  private buttonDown: Button;
  private scrollBar: Scale9Panel;
  private startDragIndex: number | undefined;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    // UI.listbox
    super(x, y, w, h); // super(x,y,w,h,true)
    this.selectedIndex = 0;
    this.background = new Scale9Panel(0, 0, this.width, this.height, {
      img: Y.getImage("panel_dark"),
      left: 3,
      top: 3,
      right: 2,
      bottom: 2,
    });
    this.background.ignoreEvents = true;
    this.addChild(this.background);

    const font = UI.fontMed;
    if (font == null) {
      throw new Error("");
    }
    this.font = font;

    const fontSmall = UI.fontSmall;
    if (fontSmall == null) {
      throw new Error("");
    }
    this.fontSmall = fontSmall;

    this.buttonUp = Assets.generate("button20_20");
    this.addChild(this.buttonUp);
    this.buttonUp.onClick = () => {
      this.navigateUp();
    };

    this.buttonDown = Assets.generate("button20_20");
    this.addChild(this.buttonDown);
    this.buttonDown.onClick = () => {
      this.navigateDown();
    };

    this.scrollBar = new Scale9Panel(
      (w ?? this.width) - 28,
      18,
      16,
      (h ?? this.height) - 3,
      {
        img: Y.getImage("bar"),
        left: 2,
        top: 2,
        right: 3,
        bottom: 3,
      },
    );

    this.scrollBar.onDragStart = () => {
      this.scrollBar.startDragIndex = this.visibleIndex;
    };

    this.scrollBar.onDrag = (touchData) => {
      if (this.scrollBar.startDragIndex === undefined) {
        console.error(
          "A ListBoxes scroll bar is missing startDragIndex for onHover!",
        );
        return;
      }
      if (this.items.length > this.visibleIitems && this.scrollBarItemOffset) {
        const delta = touchData.deltaY;
        this.visibleIndex = Math.floor(
          this.scrollBar.startDragIndex + delta / this.scrollBarItemOffset,
        );
        this.visibleIndex = Math.min(this.visibleIndex, this.getMaxIndex());
        this.visibleIndex = Math.max(this.visibleIndex, 0);

        if (this.centerSelection) {
          this.setSelectedIndex(this.visibleIndex);
        } else {
          this.setScrollBarPosition();
        }
      }
    };

    this.addChild(this.scrollBar);
  }
  setProperties(p: ListBoxProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;
    this.onChange = p.onChange ?? this.onChange;
    this.selectedIndex = p.selectedIndex ?? this.selectedIndex;
    this.centerSelection = p.centerSelection ?? this.centerSelection;
    this.font = p.font ?? this.font;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
    this.background.setSize(this.width, this.height);

    this.setScrollBarPosition();

    this.buttonUp.setProperties({
      left: this.width - 18,
      top: 2,
      width: 16,
      height: 16,
      label: "↑",
    });

    this.buttonDown.setProperties({
      left: this.width - 18,
      top: this.height - 19,
      width: 16,
      height: 16,
      label: "↓",
    });

    if (this.centerSelection) {
      this.startY = Math.ceil((this.height - this.lineHeight) / 2);
    }
  }

  setSelectedIndex(index: number, internal?: boolean) {
    this.selectedIndex = index;
    if (this.centerSelection) this.visibleIndex = this.selectedIndex;
    this.setScrollBarPosition();
    this.refresh();
    if (
      !internal &&
      this.onChange &&
      this.previousSelectedIndex != this.selectedIndex
    )
      this.onChange();
    this.previousSelectedIndex = this.selectedIndex;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  navigateUp() {
    if (this.visibleIndex > 0) {
      this.visibleIndex--;
      this.setScrollBarPosition();
    }
    if (this.centerSelection) {
      this.setSelectedIndex(this.visibleIndex);
    } else {
      this.refresh();
    }
  }

  navigateDown() {
    if (this.visibleIndex < this.getMaxIndex()) {
      this.visibleIndex++;
      this.setScrollBarPosition();
    }

    if (this.centerSelection) {
      this.setSelectedIndex(this.visibleIndex);
    } else {
      this.refresh();
    }
  }

  render(internal?: boolean) {
    internal = !!internal;
    if (!this.isVisible()) return;

    if (this.needsRendering) {
      this.background.render();
      const line = Y.getImage("line_hor");
      for (let i = 0, len = this.items.length; i < len; i++) {
        const item = this.items[i];
        let textX = 10;
        const indent = 10;
        let highlightY = 6;
        let textY = this.startY + (i - this.visibleIndex) * this.lineHeight;

        if (textY > 0 && textY < this.height) {
          let targetCtx: CanvasRenderingContext2D | undefined = this.ctx;
          let _y = textY;
          const clip = textY >= this.height - this.lineHeight;
          let itemCanvas: HTMLCanvasElement | undefined;

          if (clip) {
            const lastItemHeight = this.height - textY + 1;
            if (lastItemHeight > 1) {
              itemCanvas = document.createElement("canvas");
              itemCanvas.width = this.width - 2;
              itemCanvas.height = lastItemHeight;
              const canvas = itemCanvas.getContext("2d");
              if (canvas == null) {
                console.error("Failed to create a canvas for a ListBox!");
                return;
              }
              targetCtx = canvas;
              _y = 4;
              highlightY = 6;
            } else {
              targetCtx = undefined;
            }
          }

          if (targetCtx) {
            if (this.hoverIndex && this.hoverIndex + this.visibleIndex === i) {
              targetCtx.fillStyle = "rgba(110,130,220,0.07)";
              targetCtx.fillRect(
                0,
                _y - highlightY,
                this.width - 2,
                this.lineHeight,
              );
            }

            if (this.selectedIndex === i) {
              targetCtx.fillStyle = "rgba(110,130,220,0.15)";
              targetCtx.fillRect(
                0,
                _y - highlightY,
                this.width - 2,
                this.lineHeight,
              );
            }

            if (item.level) textX += item.level * indent;

            const icon =
              typeof item.icon === "string" ? Y.getImage(item.icon) : item.icon;
            if (icon) {
              targetCtx.drawImage(icon, textX, _y - 2);
              textX += icon.width + 4;
            }

            let text = item.label;

            if (this.font) {
              if (item.info) {
                const infoLength = item.info.length * 6 + 20;
                this.fontSmall.write(
                  targetCtx,
                  item.info,
                  this.width - infoLength,
                  _y,
                  0,
                );
                const charWidth = this.font.getCharWidthAsFixed();
                text = text.substr(
                  0,
                  Math.floor(
                    (this.width - infoLength - textX - 26) / charWidth,
                  ),
                );
              }

              this.font.write(targetCtx, text, textX, _y, 0);
            }

            textY += 11;
            _y += 11;

            if (line) targetCtx.drawImage(line, 0, _y, this.width - 2, 2);

            if (clip && itemCanvas) {
              this.ctx.drawImage(itemCanvas, 0, textY - 11 - 4);
            }
          }
        }
      }

      this.scrollBar.render();
      this.buttonUp.render();
      this.buttonDown.render();
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

  setItems(newItems: ListBoxItem[]) {
    this.items = newItems;
    this.visibleIndex = Math.min(this.visibleIndex, this.getMaxIndex());
    this.setScrollBarPosition();
    this.refresh();
  }

  getItems(): ListBoxItem[] {
    return this.items;
  }

  getItemAtPosition(x: number, y: number): ListBoxItem | undefined {
    y = y - this.startY;
    const index = Math.floor(y / this.lineHeight) + this.visibleIndex;
    if (index >= 0 && index < this.items.length) {
      return this.items[index];
    } else {
      return undefined;
    }
  }

  /*insertItemAfterIndex (newItem,index,indent){

    };*/

  private setScrollBarPosition() {
    const max = this.items.length;
    this.visibleIitems = Math.floor(this.height / this.lineHeight);
    if (this.centerSelection) {
      this.visibleIitems = 1;
    }

    const startTop = 18;
    let top = startTop;
    const startHeight = this.height - 4 - 32;
    let height = startHeight;
    this.scrollBarItemOffset = 0;

    if (max > this.visibleIitems) {
      height = Math.floor((this.visibleIitems / max) * startHeight);
      if (height < 12) height = 12;

      this.scrollBarItemOffset =
        (startHeight - height) / (max - this.visibleIitems);
    }

    if (this.visibleIndex && this.scrollBarItemOffset) {
      top = Math.floor(startTop + this.scrollBarItemOffset * this.visibleIndex);
    }

    this.scrollBar.setProperties({
      left: this.width - 18,
      top: top,
      width: 16,
      height: height,
    });
  }

  onMouseWheel(touchData: TouchData) {
    if (touchData.mouseWheels[0] > 0) {
      this.navigateUp();
    } else {
      this.navigateDown();
    }
  }

  onDragStart(touchData?: Touch) {
    this.startDragIndex = this.visibleIndex;
  }

  onDrag(touchData: Drag) {
    if (this.startDragIndex === undefined) {
      console.error("ListBox is missing startDragIndex for onHover!");
      return;
    }
    if (this.items.length > this.visibleIitems) {
      const delta = Math.round(touchData.deltaY / this.lineHeight);
      this.visibleIndex = this.startDragIndex - delta;
      this.visibleIndex = Math.max(this.visibleIndex, 0);
      this.visibleIndex = Math.min(this.visibleIndex, this.getMaxIndex());

      if (this.centerSelection) {
        this.setSelectedIndex(this.visibleIndex);
      } else {
        this.setScrollBarPosition();
      }
    }
  }

  onHover(data?: TouchData) {
    if (this.eventY === undefined) {
      console.error("ListBox expected eventY to be processed for onHover!");
      return;
    }
    const index = Math.floor((this.eventY - this.startY) / this.lineHeight);
    if (index !== this.prevHoverIndex) {
      this.hoverIndex = index;
      this.prevHoverIndex = this.hoverIndex;
      this.refresh();
    }
  }

  onHoverExit() {
    if (this.hoverIndex) {
      this.hoverIndex = undefined;
      this.prevHoverIndex = undefined;
      this.refresh();
    }
  }

  private getMaxIndex() {
    let max = this.items.length - 1;
    if (!this.centerSelection) {
      max = this.items.length - this.visibleIitems;
    }
    if (max < 0) max = 0;
    return max;
  }
}
