import { Scale9 } from "../assets";
import Element, { ElementProperties } from "./element";
import Scale9Panel from "./scale9";
import EventBus from "../../eventBus";
import { EVENT } from "../../enum";
import type { Touch, TouchData } from "../input";
import { UI } from "../main";
import { Y } from "../yascal/yascal";
import Menu, { MenuItem } from "./menu";
import Assets from "../assets";

interface SubmenuProperties extends ElementProperties {
  background?: Scale9;
}

export default class Submenu extends Element {
  private items: MenuItem[] | undefined;

  private itemHeight = 26;
  private background: Scale9Panel | undefined;

  private paddingTop = 9;
  private paddingLeft = 9;
  private charWidth = 9;

  private hoverIndex: number | undefined;
  private preHoverIndex: number | undefined;

  private activeSubmenu: MenuItem | undefined;
  mainMenu: Menu | undefined;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    // UI.submenu
    super(x, y, w, h);
    this.type = "submenu";
  }

  setProperties(p: SubmenuProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;

    if (p["background"]) {
      this.background = new Scale9Panel(
        0,
        0,
        this.width,
        this.height,
        p["background"],
      );
      this.background.ignoreEvents = true;
      this.addChild(this.background);
    }

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
  }

  onHover(data: TouchData) {
    if (this.eventY === undefined) {
      console.error(
        "Submenu expected eventY to be processed for onHover but it was not!",
      );
      return;
    }
    const index = Math.floor(this.eventY / this.itemHeight);
    if (index !== this.preHoverIndex) {
      this.setSelectedIndex(index);
    }
  }

  onHoverExit() {
    if (this.hoverIndex) {
      this.hoverIndex = undefined;
      this.preHoverIndex = undefined;
      this.refresh();
    }
  }

  onShow() {
    this.hoverIndex = 0;
    this.preHoverIndex = 0;
  }

  onHide() {
    if (this.activeSubmenu) {
      this.activeSubmenu.subMenu?.hide();
      this.activeSubmenu = undefined;
    }
  }

  setSelectedIndex(index: number) {
    if (this.items == null) {
      console.error("Cannot set selected index on an empty Submenu!");
      return;
    }

    this.hoverIndex = Math.min(index, this.items.length - 1);
    if (this.hoverIndex < 0) this.hoverIndex = 0;
    this.preHoverIndex = this.hoverIndex;

    const item = this.items[this.hoverIndex];
    if (item.subItems) {
      this.activateSubmenu(item);
    } else {
      if (this.activeSubmenu) {
        this.activeSubmenu.subMenu?.hide();
        this.activeSubmenu = undefined;
      }
    }

    this.refresh();
  }

  getSelectedIndex() {
    if (typeof this.hoverIndex !== "undefined") return this.hoverIndex;
    return -1;
  }

  onClick(data: Touch) {
    if (!(this.items && this.items.length)) return;
    const selectedItem = this.items[Math.floor(data.y / this.itemHeight)];
    this.executeItem(selectedItem);
  }

  executeItem(item: MenuItem) {
    if (this.isDisabled(item)) return;
    if (item) {
      if (item.command !== undefined) {
        this.hide();
        this.parent?.refresh();
        if (this.mainMenu) this.mainMenu.deActivate();
        EventBus.trigger(EVENT.command, item.command);
      } else if (item.subItems) {
        this.toggleSubmenu(item);
      }
    }
  }

  activateSubmenu(item: MenuItem) {
    if (UI.mainPanel == null) {
      console.error(
        "Cannot activate Submenu due to the main panel not being initialized!",
      );
      return;
    }
    if (!item.subMenu) {
      if (this.parent == null) {
        console.error(
          "Cannot activate Submenu due to there being no parent to attach a new Submenu to!",
        );
        return;
      }
      const subMenu = new Submenu();
      subMenu.setProperties({
        background: Assets.buttonLightScale9,
      });
      subMenu.hide();
      if (item.subItems) subMenu.setItems(item.subItems);
      subMenu.zIndex = 300;
      this.parent.addChild(subMenu);
      subMenu.mainMenu = this.mainMenu;
      item.subMenu = subMenu;
    }
    let left = this.left + this.width - 20;
    if (left + item.subMenu.width > UI.mainPanel.width) {
      left = UI.mainPanel.width - item.subMenu.width;
    }
    const index = item.index ?? this.items?.length ?? 0;
    item.subMenu.setPosition(left, this.top + index * this.itemHeight);
    item.subMenu.show();
    this.activeSubmenu = item;
    this.refresh();
  }

  deActivateSubmenu() {
    if (this.activeSubmenu) {
      this.activeSubmenu.subMenu?.hide();
      this.activeSubmenu = undefined;
      this.refresh();
    }
  }

  toggleSubmenu(item: MenuItem) {
    if (item.subMenu && item.subMenu.isVisible()) {
      this.deActivateSubmenu();
    } else {
      this.activateSubmenu(item);
    }
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;
    internal = !!internal;

    if (this.needsRendering) {
      this.clearCanvas();
      if (this.background) this.background.render();

      if (this.items == null || this.items?.length <= 0) return;

      const line = Y.getImage("line_hor");
      if (line == null) {
        console.error("Failed to get image: line_hor for Submenu!");
        return;
      }

      let textY = 0;
      const textX = 0;
      const textWidth = this.width - 3;

      const max = this.items.length - 1;

      for (let i = 0; i <= max; i++) {
        const item = this.items[i];

        const disabled = this.isDisabled(item);

        if (i === this.hoverIndex && !disabled) {
          this.ctx.fillStyle = "rgba(255,255,255,0.2)";
          this.ctx.fillRect(textX, textY, textWidth, this.itemHeight);
        }

        if (item.label) {
          if (UI.fontFT == null) {
            console.error("Missing font fontFT to render Submenu label!");
            return;
          }
          const label = this.getLabel(item);
          UI.fontFT.write(
            this.ctx,
            label,
            textX + this.paddingLeft,
            textY + this.paddingTop,
          );
        }

        if (item.subItems) {
          if (UI.fontMed == null) {
            console.error("Missing font fontMed to render Submenu label!");
            return;
          }
          UI.fontMed.write(
            this.ctx,
            ">",
            this.width - 16,
            textY + this.paddingTop + 2,
          );
        }

        if (disabled) {
          this.ctx.fillStyle = "rgba(88,105,129,0.6)";
          this.ctx.fillRect(textX, textY, textWidth, this.itemHeight);
        }
        textY += this.itemHeight;
        if (i < max) this.ctx.drawImage(line, textX, textY, textWidth, 2);
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

  setItems(newItems: MenuItem[]) {
    this.items = newItems;
    let width = 50;
    for (const [index, item] of this.items.entries()) {
      const label = this.getLabel(item);
      let labelWidth = item.label ? label.length * this.charWidth : 0;
      labelWidth += this.paddingLeft * 2 + 6;
      width = Math.max(width, labelWidth);
      item.index = index;
    }
    const height = this.items.length * this.itemHeight + 4;
    this.setSize(width, height);
    if (this.background) this.background.setSize(this.width, this.height);

    this.hoverIndex = undefined;
    this.preHoverIndex = undefined;
    this.activeSubmenu = undefined;

    this.refresh();
  }

  getItems(): MenuItem[] | undefined {
    return this.items;
  }

  private isDisabled(item: MenuItem) {
    if (typeof item.disabled === "function") {
      return item.disabled();
    }
    return !!item.disabled;
  }

  private getLabel(item: MenuItem) {
    if (typeof item.label === "function") {
      return item.label();
    }
    return item.label;
  }
}
