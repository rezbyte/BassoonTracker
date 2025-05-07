import type BitmapFont from "./components/bitmapfont";

export const enum TextAlignment {
  left,
  center,
  right,
}

export const enum ScaleRule {
  repeatX,
  stretch,
  repeatY,
}

export const enum Size {
  small,
  medium,
  big,
}

export type LegacyKeyboardEvent = KeyboardEvent & { keyIdentifier?: string };

export interface ElementLabelProperties {
  label?: string;
  font?: BitmapFont;
  textAlign?: TextAlignment;
  paddingTop?: number;
}

export interface ElementUndoProperties {
  trackUndo?: boolean;
  undoLabel?: string;
  undoInstrument?: boolean;
}

export interface ElementRangeProperties {
  min?: number;
  max?: number;
  step?: number;
}

export interface LabelStruct {
  width: number;
  label: string;
}
