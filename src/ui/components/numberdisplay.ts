import Element, { Changeable, ElementProperties } from "./element";
import StateManager, { Control } from "../stateManager";
import { TouchData } from "../input";
import {
  ElementRangeProperties,
  ElementUndoProperties,
  Size,
  LegacyKeyboardEvent,
} from "../basetypes";
import Input from "../input";
import Tracker from "../../tracker";
import { Y } from "../yascal/yascal";
import { UI } from "../main";
import BitmapFont from "./bitmapfont";

export interface NumberDisplayProperties
  extends ElementProperties,
    Changeable<number>,
    ElementUndoProperties,
    ElementRangeProperties {
  value?: number;
  padLength?: number;
  size?: Size;
  autoPadding?: boolean;
  disabled?: boolean;
}

export default interface NumberDisplay {
  renderInternal?(): void;
}
export default class NumberDisplay
  extends Element
  implements Control<number>, Changeable<number>
{
  //private isActive: boolean = false;
  protected isDisabled: boolean = false;
  padLength: number = 4;
  private value: number = 0;
  private prevValue: number = 0;
  private min: number = 0;
  private max: number = 100;
  protected step: number = 1;
  private padChar: string = " ";
  private padding: number = 0;
  protected paddingLeft: number = this.padding;
  protected paddingTop: number = this.padding;
  protected paddingRight: number = this.padding;
  paddingBottom: number = this.padding;
  private hasFocus: boolean = false;
  private cursorPos: number = 0;
  private isCursorVisible: boolean = false;
  onChange: ((value: number) => void) | undefined;
  private fontSize: Size = Size.medium;
  protected font: BitmapFont | undefined;
  private autoPadding: boolean = false;
  private fontOffset: { x: number; y: number; c: number };
  private static readonly fontOffsets: Record<
    Size,
    { x: number; y: number; c: number }
  > = {
    0: { x: 4, y: 3, c: 0 }, // small
    1: { x: 6, y: 7, c: 0 }, // medium
    2: { x: 7, y: 4, c: -2 }, // big
  };
  private trackUndo: boolean = false;
  private undoLabel: string | undefined;
  private undoInstrument: boolean = false;
  widthParam: number = 100; // Used by the button groups

  constructor(initialProperties?: NumberDisplayProperties) {
    // UI.numberDisplay
    super();
    this.type = "numberDisplay";
    this.fontOffset = NumberDisplay.fontOffsets[Size.medium];
    if (initialProperties) this.setPropertiesValues(initialProperties);
  }

  setProperties(p: NumberDisplayProperties) {
    this.setPropertiesValues(p);
    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    if (this.max > 9999 && this.padLength < 5) this.padLength = 5;
  }

  protected setPropertiesValues(p: NumberDisplayProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;
    this.trackUndo = p.trackUndo ?? this.trackUndo;
    this.undoLabel = p.undoLabel ?? this.undoLabel;
    this.undoInstrument = p.undoInstrument ?? this.undoInstrument;
    this.onChange = p.onChange ?? this.onChange;
    this.value = p.value ?? this.value;
    this.min = p.min ?? this.min;
    this.max = p.max ?? this.max;
    this.step = p.step ?? this.step;
    this.padLength = p.padLength ?? this.padLength;
    this.autoPadding = p.autoPadding ?? this.autoPadding;
    this.isDisabled = p.disabled ?? this.isDisabled;

    this.fontSize = p.size ?? this.fontSize;
    this.font = this.fontSize === Size.big ? UI.fontLedBig : UI.fontLed;
    this.fontOffset = NumberDisplay.fontOffsets[this.fontSize];
  }

  setValue(val: number, internal?: boolean) {
    if (val !== this.value) {
      this.prevValue = this.value;
    }
    this.value = val;
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

  updateValue(newValue: number) {
    if (newValue > this.max) newValue = this.max;
    if (newValue < this.min) newValue = this.min;
    this.setValue(newValue);
  }

  getValue(): number {
    return this.value;
  }

  getPrevValue(): number {
    return this.prevValue;
  }

  setDisabled(state?: boolean) {
    if (typeof state == "undefined") state = true;
    this.isDisabled = state;
    //if (state) this.isActive = false;
    this.refresh();
  }

  setFocus(state: boolean) {
    this.hasFocus = !!state;
    if (this.hasFocus) {
      Input.setFocusElement(this);
      this.cursorPos = this.padValue().length;
      this.pingCursor();
    } else {
      Input.clearFocusElement();
    }
    this.refresh();
  }

  togglFocus() {
    this.setFocus(!this.hasFocus);
  }

  setMax(newMax: number, internal?: boolean) {
    this.max = newMax;
    if (!internal && this.value > this.max) this.setValue(this.max);
  }

  setMin(newMin: number) {
    this.min = newMin;
    if (this.value < this.min) this.setValue(this.min);
  }

  onClick() {
    if (this.isDisabled) return;
    if (!this.onChange) return;
    this.togglFocus();
  }

  onMouseWheel(touchData: TouchData) {
    if (this.isDisabled) return;
    if (!this.onChange) return;
    if (touchData.mouseWheels[0] > 0) {
      this.updateValue(this.value + this.step);
    } else {
      this.updateValue(this.value - this.step);
    }
  }

  onKeyDown(keycode: number, event: LegacyKeyboardEvent) {
    const keyCode = event.keyCode;
    const key = event.key;

    switch (keyCode) {
      case 8: // backspace
        this.extract(-1);
        break;
      case 9:
      case 13:
      case 27:
        Input.clearFocusElement();
        break;
      case 37:
        this.setCursorPos(this.cursorPos - 1);
        break;
      case 38:
        this.updateValue(this.value + 1);
        break;
      case 39:
        this.setCursorPos(this.cursorPos + 1);
        break;
      case 40:
        this.updateValue(this.value - 1);
        break;
      case 46: // Del
        this.extract(0);
        break;
    }

    switch (key) {
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
      case "-":
        this.inject(key);
        break;
    }

    //console.error(keyCode,key);
    return true;
  }

  onResize() {
    if (this.autoPadding) this.padLength = Math.floor(this.width / 8) - 1;
  }

  activate() {
    this.hasFocus = true;
    this.cursorPos = this.padValue().length;
    this.isCursorVisible = true;
    this.pingCursor();
  }

  deActivate() {
    if (this.hasFocus) {
      this.hasFocus = false;
      this.isCursorVisible = false;
      this.refresh();
      Input.clearFocusElement();
    }
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;

    if (this.needsRendering) {
      internal = !!internal;
      this.ctx.clearRect(0, 0, this.width, this.height);

      let x = this.paddingLeft || this.padding;
      let y = this.paddingTop || this.padding;

      const w = this.width - x - (this.paddingRight || this.padding);
      const h = this.height - y - (this.paddingBottom || this.padding);
      const backgroundImageName = this.hasFocus
        ? "panel_inset_dark_active"
        : "panel_inset_dark_inactive";
      const backgroundImage = Y.getImage(backgroundImageName);
      if (backgroundImage == null) {
        console.error(
          `Failed to get image: ${backgroundImageName} for NumberDisplay background!`,
        );
        return;
      }
      this.ctx.drawImage(backgroundImage, x, y, w, h);

      if (this.font) {
        x += this.fontOffset.x;
        y = this.fontOffset.y;
        this.font.write(this.ctx, this.padValue(), x, y, 0);

        if (this.isCursorVisible) {
          this.ctx.fillStyle = "rgba(255,201,65,0.7)";
          const charWidth = this.font.getCharWidthAsFixed();
          const cursorX = x + this.cursorPos * charWidth + this.fontOffset.c;
          this.ctx.fillRect(cursorX, y, 2, this.font.charHeight);
        }
      }

      if (this.renderInternal) this.renderInternal();

      if (this.isDisabled) {
        this.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
        this.ctx.fillRect(0, 0, this.width, this.height);
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

  private padValue(): string {
    let result = "" + this.value;
    while (result.length < this.padLength) {
      result = this.padChar + result;
    }
    return result;
  }

  private pingCursor() {
    if (this.hasFocus) {
      this.isCursorVisible = !this.isCursorVisible;
      setTimeout(this.pingCursor.bind(this), 300);
    } else {
      this.isCursorVisible = false;
    }
    this.refresh();
  }

  private setCursorPos(newValue: number) {
    this.cursorPos = newValue;
    const max = this.padValue().length;
    const min = max - ("" + this.value).length;
    if (this.cursorPos > max) this.cursorPos = max;
    if (this.cursorPos < min) this.cursorPos = min;
    this.refresh();
  }

  private extract(offset: number) {
    const a = this.padValue().split("");
    a.splice(this.cursorPos + offset, 1);
    let v = parseInt(a.join("").trim());
    if (isNaN(v)) v = 0;
    this.updateValue(v);
  }

  private inject(n: string) {
    const a = this.padValue().split("");
    a.splice(this.cursorPos, 0, n);
    let v = parseInt(a.join("").trim());
    if (isNaN(v)) v = 0;
    this.updateValue(v);
  }
}
