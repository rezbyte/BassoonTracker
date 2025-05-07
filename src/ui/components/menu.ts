import { Touch, TouchData } from "../input";
import Element, { ElementProperties } from "./element";
import Scale9Panel from "./scale9";
import Input from "../input";
import { Scale9 } from "../assets";
import EventBus from "../../eventBus";
import { COMMAND, EVENT } from "../../enum";
import Button from "./button";
import { LegacyKeyboardEvent, TextAlignment } from "../basetypes";
import Assets from "../assets";
import { UI } from "../main";
import Submenu from "./submenu";

export interface MenuItem {
  disabled?: boolean | (() => boolean);
  index?: number;
  startX?: number;
  width?: number;
  onClick?: () => void;
  label: string | (() => string);
  subItems?: MenuItem[];
  subMenu?: Submenu;
  command?: COMMAND;
}
interface MenuProperties extends ElementProperties {
  background?: Scale9;
  layout?: "buttons";
}

export default class Menu extends Element {
  private items: MenuItem[] | undefined;
  private background: Scale9Panel | undefined;
  private buttons: Button[] = [];
  private activeIndex: number | undefined;
  private hoverIndex: number | undefined;
  private preHoverIndex: number | undefined;
  private itemMargin = 24;
  private layout: "buttons" | undefined;
  private submenuParent: Element;
  keepSelection: boolean;

  constructor(
    x: number,
    y: number,
    w: number,
    h: number,
    submenuParent: Element,
  ) {
    // UI.menu
    super(x, y, w, h);
    this.keepSelection = true;
    this.submenuParent = submenuParent;
  }

  setProperties(p: MenuProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;
    this.layout = p.layout ?? this.layout;

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

  onClick(data: Touch) {
    if (this.items == null) return;

    const selectedIndex = this.getItemIndexAtPosition(data.x);
    this.items.forEach(function (item, index) {
      if (index !== selectedIndex && item.subMenu) item.subMenu.hide();
    });

    if (selectedIndex < 0) return;
    const selectedItem = this.items[selectedIndex];
    this.activeIndex = undefined;

    Input.setFocusElement(this);

    if (selectedItem.subMenu) {
      const xOffset = data.globalX - data.x;
      selectedItem.subMenu.setPosition(
        (selectedItem.startX || 0) + xOffset,
        this.height,
      );
      selectedItem.subMenu.toggle();
      selectedItem.subMenu.parent?.refresh();

      if (selectedItem.subMenu.isVisible()) {
        this.activeIndex = selectedIndex;
      }
    }
    if (selectedItem.command !== undefined) {
      EventBus.trigger(EVENT.command, selectedItem.command);
    }
  }

  onHover(data: TouchData) {
    if (this.eventX === undefined) {
      console.error("Menu expected eventX to be processed but it was not!");
      return;
    }
    const selectedIndex = this.getItemIndexAtPosition(this.eventX);
    if (selectedIndex !== this.preHoverIndex) {
      this.hoverIndex = selectedIndex;
      this.preHoverIndex = this.hoverIndex;
      this.refresh();
    }

    if (selectedIndex < 0) return;
    if (
      this.activeIndex !== undefined &&
      this.activeIndex >= 0 &&
      this.activeIndex !== selectedIndex
    ) {
      this.activateSubmenu(selectedIndex);
    }
  }

  onHoverExit() {
    if (this.hoverIndex) {
      this.hoverIndex = undefined;
      this.preHoverIndex = undefined;
      this.refresh();
    }
  }

  onKeyDown(keyCode: number, event: LegacyKeyboardEvent) {
    let handled;
    //console.error(keyCode);
    switch (keyCode) {
      case 13: // enter
        const subItem = this.getActiveSubItem();
        if (subItem) {
          if (
            subItem.item.subMenu &&
            subItem.item.subMenu.isVisible() &&
            subItem.item.subMenu.getSelectedIndex() >= 0
          ) {
            const index = subItem.item.subMenu.getSelectedIndex();
            const item = subItem.item.subMenu.getItems()?.[index];
            if (item) subItem.item.subMenu.executeItem(item);
          } else {
            subItem.menu.executeItem(subItem.item);
          }
        }
        handled = true;
        break;
      case 27: // esc
        this.deActivate();
        handled = true;
        break;
      case 37:
        if (this.activeIndex !== undefined && this.activeIndex >= 0) {
          const subItem = this.getActiveSubItem();
          if (
            subItem &&
            subItem.item.subMenu &&
            subItem.item.subMenu.isVisible()
          ) {
            subItem.menu.deActivateSubmenu();
          } else {
            this.activateSubmenu(Math.max(this.activeIndex - 1, 0));
          }
        }
        handled = true;
        break;
      case 39:
        if (
          this.activeIndex !== undefined &&
          this.items !== undefined &&
          this.activeIndex >= 0
        ) {
          const subItem = this.getActiveSubItem();
          if (
            subItem &&
            subItem.item.subMenu &&
            !subItem.item.subMenu.isVisible()
          ) {
            subItem.menu.activateSubmenu(subItem.item);
          } else {
            this.activateSubmenu(
              Math.min(this.activeIndex + 1, this.items.length - 1),
            );
          }
        }
        handled = true;
        break;
      case 38:
        if (
          this.activeIndex !== undefined &&
          this.items !== undefined &&
          this.activeIndex >= 0
        ) {
          const subItem = this.getActiveSubItem();
          if (
            subItem &&
            subItem.item.subMenu &&
            subItem.item.subMenu.isVisible()
          ) {
            subItem.item.subMenu.setSelectedIndex(
              subItem.item.subMenu.getSelectedIndex() - 1,
            );
          } else {
            const activeItem = this.items[this.activeIndex];
            if (activeItem && activeItem.subMenu) {
              activeItem.subMenu.setSelectedIndex(
                activeItem.subMenu.getSelectedIndex() - 1,
              );
            }
          }
        }
        handled = true;
        break;
      case 40:
        if (
          this.activeIndex !== undefined &&
          this.items !== undefined &&
          this.activeIndex >= 0
        ) {
          const subItem = this.getActiveSubItem();
          if (
            subItem &&
            subItem.item.subMenu &&
            subItem.item.subMenu.isVisible()
          ) {
            subItem.item.subMenu.setSelectedIndex(
              subItem.item.subMenu.getSelectedIndex() + 1,
            );
          } else {
            const activeItem = this.items[this.activeIndex];
            if (activeItem && activeItem.subMenu) {
              activeItem.subMenu.setSelectedIndex(
                activeItem.subMenu.getSelectedIndex() + 1,
              );
            }
          }
        }
        handled = true;
        break;
    }

    return handled;
  }

  deActivate(clickedItem?: Submenu) {
    if (
      this.items != null &&
      this.activeIndex != null &&
      this.activeIndex >= 0
    ) {
      const activeItem = this.items[this.activeIndex];
      if (activeItem && activeItem.subMenu) {
        if (
          clickedItem &&
          clickedItem.type === "submenu" &&
          clickedItem.mainMenu &&
          clickedItem.mainMenu.name === this.name
        ) {
        } else {
          activeItem.subMenu.hide();
          this.activeIndex = undefined;
          this.refresh();
          Input.clearFocusElement();
        }
      }
    }
  }

  activateSubmenu(index: number) {
    if (this.items == null || index === this.activeIndex) return;
    this.activeIndex = index;
    const activeIndex = this.activeIndex;
    this.items.forEach(function (item, index) {
      if (index !== activeIndex && item.subMenu) item.subMenu.hide();
    });

    const selectedItem = this.items[index];
    if (selectedItem && selectedItem.subMenu) {
      this.activeIndex = index;
      const xOffset = this.left;
      selectedItem.subMenu.setPosition(
        (selectedItem.startX || 0) + xOffset,
        this.height,
      );
      selectedItem.subMenu.toggle();
      selectedItem.subMenu.parent?.refresh();
    }
  }

  private getActiveSubItem(): { menu: Submenu; item: MenuItem } | undefined {
    if (
      this.items != null &&
      this.activeIndex != null &&
      this.activeIndex >= 0
    ) {
      const activeItem = this.items[this.activeIndex];
      if (activeItem && activeItem.subMenu) {
        const selectedIndex = activeItem.subMenu.getSelectedIndex();
        const subMenuItem = activeItem.subMenu.getItems()?.[selectedIndex];
        if (selectedIndex >= 0 && subMenuItem) {
          return {
            menu: activeItem.subMenu,
            item: subMenuItem,
          };
        }
      }
    }
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;
    internal = !!internal;

    if (this.needsRendering) {
      let textX = 10;
      const textY = 10;
      const fontWidth = 9;

      this.clearCanvas();
      if (this.background) this.background.render();

      if (this.buttons.length) {
        this.buttons.forEach(function (button) {
          button.render();
        });
      } else if (this.items) {
        if (UI.fontMed == null) {
          console.error("Failed to render Menu due to missing fontMed font!");
          return;
        }
        const itemMargin = this.itemMargin;
        const hoverIndex = this.hoverIndex;
        for (const [index, item] of this.items.entries()) {
          const label =
            typeof item.label === "function" ? item.label() : item.label;
          const w = label.length * fontWidth;
          item.startX = textX;
          item.width = w;

          if (index === hoverIndex) {
            this.ctx.fillStyle = "rgba(179,195,243,0.1)";
            this.ctx.fillRect(textX - itemMargin / 2, textY - 10, w + 20, 30);
          }
          UI.fontMed.write(this.ctx, label, textX, textY);
          textX += w + itemMargin;
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

  setItems(newItems: MenuItem[]) {
    this.items = newItems;
    this.submenuParent = this.submenuParent || this.parent;
    this.buttons = [];
    const buttonProperties = {
      background: Assets.buttonKeyScale9,
      activeBackground: Assets.buttonKeyActiveScale9,
      isActive: false,
      textAlign: TextAlignment.center,
      font: UI.fontDark,
      paddingTopActive: 1,
    };

    let buttonX = 3;
    let buttonY = 3;
    for (const [index, item] of this.items.entries()) {
      if (this.layout === "buttons") {
        const button = new Button(buttonX, buttonY, 60, 18);
        buttonX += 60;
        if (index === 1) {
          buttonX = 3;
          buttonY += 18;
        }

        button.setProperties(buttonProperties);
        const label =
          typeof item.label === "function" ? item.label() : item.label;
        button.setLabel(label);
        if (item.onClick)
          button.onClick = function () {
            if (item.onClick) item.onClick();
          };
        this.buttons.push(button);
        this.addChild(button);
      }

      if (item.subItems) {
        const subMenu = new Submenu();
        subMenu.setProperties({
          background: Assets.buttonLightScale9,
        });
        subMenu.hide();
        subMenu.setItems(item.subItems);
        subMenu.zIndex = 200;
        this.submenuParent.addChild(subMenu);
        subMenu.mainMenu = this;
        item.subMenu = subMenu;
      }
    }
    this.zIndex = 9;

    this.refresh();
  }

  getItems(): MenuItem[] | undefined {
    return this.items;
  }

  private getItemIndexAtPosition(x: number): number {
    if (this.items && this.items.length) {
      for (let i = 0, max = this.items.length; i < max; i++) {
        const item = this.items[i];
        const startX = item.startX ?? 0;
        const width = item.width ?? 9;
        if (
          x >= startX - this.itemMargin / 2 &&
          x <= startX + width + this.itemMargin / 2
        ) {
          return i;
        }
      }
    }
    return -1;
  }
}
