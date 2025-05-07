import { Y } from "../yascal/yascal";
import Element, { Changeable, ElementProperties } from "./element";
import Scale9Panel from "./scale9";
import Input from "../input";
import { ElementUndoProperties, LegacyKeyboardEvent } from "../basetypes";
import StateManager, { Control } from "../stateManager";
import { UI } from "../main";
import Tracker from "../../tracker";

interface InputBoxProperties
  extends Omit<ElementProperties, "zIndex">,
    Changeable<string>,
    ElementUndoProperties {
  onSubmit?: (value: string) => void;
  backgroundImage?: string;
  value?: string;
}

export default class InputBox
  extends Element
  implements Control<string>, Changeable<string>
{
  private value = "";
  private prevValue = "";
  private isActive: boolean;
  private isCursorVisible: boolean;
  private cursorPos: number | undefined;
  private backgroundImage = "panel_dark";
  private background: Scale9Panel;
  private onSubmit: ((value: string) => void) | undefined;
  onChange: ((value: string) => void) | undefined;
  private trackUndo = false;
  private undoLabel: string | undefined;
  private undoInstrument = false;

  constructor(initialProperties?: InputBoxProperties) {
    // formerly UI.inputbox
    super();
    if (initialProperties) this.setProperties(initialProperties);

    this.isActive = false;
    this.isCursorVisible = false;

    const background = new Scale9Panel(0, 0, this.width, this.height, {
      img: Y.getImage(this.backgroundImage),
      left: 3,
      top: 3,
      right: 2,
      bottom: 2,
    });
    background.ignoreEvents = true;
    this.background = background;
    this.addChild(this.background);
  }

  setProperties(p: InputBoxProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.onChange = p.onChange;
    this.onSubmit = p.onSubmit;
    this.backgroundImage = p.backgroundImage ?? this.backgroundImage;
    this.trackUndo = p.trackUndo ?? this.trackUndo;
    this.undoLabel = p.undoLabel ?? this.undoLabel;
    this.undoInstrument = p.undoInstrument ?? this.undoInstrument;
    this.value = p.value ?? this.value;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
    if (this.background) this.background.setSize(this.width, this.height);
  }

  render(internal?: boolean) {
    internal = !!internal;
    if (!this.isVisible()) return;

    if (this.needsRendering) {
      this.background.render();

      let textX = 0;
      if (this.value && UI.fontMed) {
        textX = 10;
        const textY = 6;
        UI.fontMed.write(this.ctx, this.value, textX, textY, 0);
      }

      if (this.isCursorVisible && this.cursorPos !== undefined) {
        this.ctx.fillStyle = "rgba(255,255,255,0.7)";
        const charWidth = 9;
        const cursorX = textX + this.cursorPos * charWidth + 8;
        this.ctx.fillRect(cursorX, 4, 2, this.height - 8);
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

  setValue(newValue: string, internal?: boolean) {
    if (newValue !== this.value) {
      this.prevValue = this.value;
    }
    this.value = newValue;
    this.refresh();

    if (!internal && this.onChange) {
      if (this.trackUndo) {
        const editAction = StateManager.createValueUndo(this);
        editAction.name = this.undoLabel || "Change " + this.name;
        if (this.undoInstrument) {
          editAction.instrument = Tracker.getCurrentInstrumentIndex();
          editAction.id += editAction.instrument;
        }
        StateManager.registerEdit(editAction);
      }
      this.onChange(this.value);
    }
  }

  getValue(): string {
    return this.value;
  }

  getPrevValue(): string {
    return this.prevValue;
  }

  /*getItemAtPosition(x: number, y: number) {
		y = y-startY;
		const index = Math.floor(y/lineHeight) + visibleIndex;
		if (index>=0 && index<items.length){
			return(items[index]);
		}else{
			return undefined;
		}
	};*/

  onClick() {
    if (!this.isActive) {
      this.activate();
    }
  }

  activate() {
    if (this.isActive) return;
    this.cursorPos = this.value ? this.value.length - 1 : -1;
    this.isActive = true;
    Input.setFocusElement(this);
    this.pingCursor();
  }

  deActivate(target?: Element | boolean) {
    const andSubmit = !!target;
    if (this.isActive) {
      this.isCursorVisible = false;
      this.isActive = false;
      this.refresh();
      Input.clearFocusElement();
      if (andSubmit && this.onSubmit) {
        this.onSubmit(this.value);
      }
    }
  }

  onKeyDown(keyCode: number, event: LegacyKeyboardEvent) {
    if (!this.isActive || this.cursorPos === undefined) return;

    let handled = false;
    switch (keyCode) {
      case 8: // backspace
        if (this.value) {
          if (this.cursorPos >= 0) {
            this.setValue(
              this.value.substr(0, this.cursorPos) +
                this.value.substr(this.cursorPos + 1),
            );
            this.cursorPos--;
          }
        }
        handled = true;
        break;
      case 9: // tab
      case 13: // enter
      case 27: // esc
        this.deActivate(keyCode === 13);
        handled = true;
        break;
      case 37: // left
        if (this.cursorPos >= 0) this.cursorPos--;
        this.refresh();
        handled = true;
        break;
      case 39: // right
        if (this.value) {
          this.cursorPos++;
          this.cursorPos = Math.min(this.cursorPos, this.value.length - 1);
          this.refresh();
        }
        handled = true;
        break;
      case 46: // delete
        if (this.value) {
          if (this.cursorPos < this.value.length - 1) {
            this.setValue(
              this.value.substr(0, this.cursorPos + 1) +
                this.value.substr(this.cursorPos + 2),
            );
          }
        }
        handled = true;
        break;
      case 89: ///y - redo
      case 90: //z - undo
        if (Input.isMetaKeyDown()) {
          this.deActivate();
          return;
        }
        break;
    }

    if (!handled && keyCode > 31) {
      const key = event.key;
      if (key.length === 1 && key.match(/[a-z0-9\._:\-\ #]/i)) {
        this.setValue(
          this.value.substr(0, this.cursorPos + 1) +
            key +
            this.value.substr(this.cursorPos + 1),
        );
        this.cursorPos++;
      }
      handled = true;
    }

    return handled;
  }

  private pingCursor() {
    if (!this.isActive) return;
    this.isCursorVisible = !this.isCursorVisible;
    this.refresh();
    setTimeout(this.pingCursor, 300);
  }
}
