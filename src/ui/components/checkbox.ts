import { Y } from "../yascal/yascal";
import Element, { ElementProperties } from "./element";

interface CheckboxProperties extends ElementProperties {
  checked?: boolean;
}

export default class Checkbox extends Element {
  private checked = false;
  flashTimeout = 0; // Used in ui/app/menu.ts for a flash effect
  onToggle: ((checked: boolean) => void) | null = null;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    // Formerly UI.checkbox
    w = w || 14;
    h = h || 14;
    super(x, y, w, h);
  }

  setProperties(p: CheckboxProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;
    this.checked = p.checked ?? this.checked;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);
  }

  setState(checked: boolean, internal?: boolean) {
    this.checked = checked;
    this.refresh();
    if (this.onToggle && !internal) this.onToggle(this.checked);
  }

  onClick() {
    this.setState(!this.checked);
  }

  check() {
    this.setState(true);
  }
  unCheck() {
    this.setState(false);
  }
  toggle() {
    this.setState(!this.checked);
  }
  render(internal?: boolean) {
    internal = !!internal;
    if (!this.isVisible()) return;

    if (this.needsRendering) {
      this.clearCanvas();

      const stateImage = this.checked
        ? Y.getImage("checkbox_on")
        : Y.getImage("checkbox_off");
      if (stateImage == null) {
        console.error(
          `Cannot render checkbox without image: ${this.checked ? "checkbox_on" : "checkbox_off"}`,
        );
        return;
      }
      this.ctx.drawImage(stateImage, 0, 0);
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
