import Element, { ElementProperties } from "./components/element";
import { Y } from "./yascal/yascal";
import Tracker from "../tracker";
import StateManager from "./stateManager";
import NumberDisplay from "./components/numberdisplay";
import RangeSlider from "./components/rangeSlider";
import type { TouchData } from "./input";
import BitmapFont from "./components/bitmapfont";
import {
  Size,
  type ElementRangeProperties,
  type ElementUndoProperties,
} from "./basetypes";

interface SliderBoxProperties
  extends ElementProperties,
    ElementUndoProperties,
    ElementRangeProperties {
  label?: string;
  value?: number;
  onChange?: (value: number) => void;
  vertical?: boolean;
  font?: BitmapFont;
}

export class SliderBox extends Element {
  private label = "";
  private value = 0;
  private prevValue = 0;
  private min = 0;
  private max = 100;
  private step = 1;
  private font: BitmapFont | null = null;
  private padLength = 4;
  private padChar = " ";
  onChange: ((value: number) => void) | undefined;
  private vertical: boolean = false;

  private labelX = 0;
  private labelY = 0;
  private digitX = 0;
  private digitY = 0;
  private digitW = 10;
  private digitH = 10;

  private sliderHeight = 20;
  private sliderwidth = 20;
  private disabled = false;

  private lineVer = Y.getImage("line_ver");

  private numberDisplay: NumberDisplay;
  private slider: RangeSlider;
  private trackUndo: boolean = false;
  private undoLabel: string | null = null;
  private undoInstrument: boolean = false;

  constructor(initialProperties?: SliderBoxProperties) {
    // UI.sliderBox
    super();
    this.type = "sliderBox";
    if (initialProperties) this.setPropertiesValues(initialProperties);

    if (this.max > 9999) this.padLength = 5;

    this.slider = new RangeSlider({
      min: this.min,
      max: this.max,
      height: this.sliderHeight,
      width: this.sliderwidth,
      vertical: !!this.vertical,
      onChange: (v) => {
        if (v !== this.value) {
          this.setValue(v);
        }
      },
    });
    this.addChild(this.slider);

    this.numberDisplay = new NumberDisplay({
      min: this.min,
      max: this.max,
      padLength: 4,
      size: Size.small,
      onChange: (v) => {
        if (v !== this.value) {
          this.setValue(v);
        }
      },
    });
    this.numberDisplay.paddingBottom = -1;
    this.addChild(this.numberDisplay);

    this.slider.onMouseWheel = this.onMouseWheel;
  }

  private padValue() {
    let result = "" + this.value;
    while (result.length < this.padLength) {
      result = this.padChar + result;
    }
    return result;
  }

  setProperties(newProperties: SliderBoxProperties) {
    this.setPropertiesValues(newProperties);
    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
  }

  private setPropertiesValues(p: SliderBoxProperties) {
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
    this.label = p.label ?? this.label;
    this.vertical = p.vertical ?? this.vertical;
    this.font = p.font ?? this.font;
  }

  setValue(newValue: number, internal?: boolean) {
    if (newValue !== this.value) {
      this.prevValue = this.value;
    }
    this.value = newValue;
    this.slider.setValue(this.value, internal);
    this.numberDisplay.setValue(this.value, internal);
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

  getValue() {
    return this.value;
  }

  getPrevValue() {
    return this.prevValue;
  }

  setMax(newMax: number, skipCheck: boolean) {
    this.max = newMax;
    if (!skipCheck && this.value > this.max) this.setValue(this.max);
    this.slider.setMax(this.max, skipCheck);
    this.numberDisplay.setMax(this.max, skipCheck);
  }

  setMin(newMin: number, skipCheck: boolean) {
    this.min = newMin;
    if (!skipCheck && this.value < this.min) this.setValue(this.min);
    this.slider.setMin(this.min, skipCheck);
    this.numberDisplay.setMin(this.min); //this.numberDisplay.setMin(this.min,skipCheck);
  }

  setDisabled(value: boolean) {
    this.disabled = value;
    this.refresh();
    this.ignoreEvents = this.disabled;
  }

  render(internal?: boolean) {
    internal = !!internal;
    if (this.needsRendering) {
      this.clearCanvas();

      //this.ctx.drawImage(Y.getImage("panel_inset_dark"),digitX,digitY,digitW,digitH);
      //window.fontLed.write(this.ctx,padValue(),digitX+4,digitY+2,0);
      this.slider.render();
      this.numberDisplay.render();

      if (this.font) {
        this.font.write(this.ctx, this.label, this.labelX, this.labelY, 0);
      } else {
        this.ctx.fillStyle = "white";
        this.ctx.fillText(this.label, this.labelX, this.labelY);
      }

      if (this.vertical && this.lineVer) {
        this.ctx.drawImage(this.lineVer, this.width - 2, 0, 2, this.height);
      }

      if (this.disabled) {
        this.ctx.fillStyle = "rgba(34, 49, 85, 0.6)";
        this.ctx.fillRect(1, 0, this.width - 1, this.height);
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

  onMouseWheel(touchData: TouchData) {
    if (touchData.mouseWheels[0] > 0) {
      this.value++;
      if (this.value > this.max) this.value = this.max;
      this.setValue(this.value);
    } else {
      this.value--;
      if (this.value < this.min) this.value = this.min;
      this.setValue(this.value);
    }
  }

  onResize() {
    this.digitW = 40;
    this.digitH = 20;
    if (this.padLength == 5) {
      this.digitW = 48;
      this.digitX -= 8;
    }

    if (this.vertical) {
      this.slider.setSize(this.sliderwidth, this.height - 36);
      this.slider.setPosition(
        Math.floor((this.width - this.sliderwidth) / 2),
        0,
      );
      this.digitX = Math.floor((this.width - 40) / 2);
      this.digitY = this.height - 32;
      const textWidth = this.font?.getTextWidth(this.label, 0) ?? 0;
      this.labelX = Math.floor((this.width - textWidth) / 2);
      this.labelY = this.height - 10;
    } else {
      this.slider.setSize(this.width, this.sliderHeight);
      this.slider.setPosition(0, this.height - this.sliderHeight);
      this.digitX = this.width - 40;
      this.digitY = 2;
    }

    this.numberDisplay.setSize(this.digitW, this.digitH);
    this.numberDisplay.setPosition(this.digitX, this.digitY);
  }
}
