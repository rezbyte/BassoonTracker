import { UI } from "../main";
import Assets from "../assets";
import Button, { ButtonProperties } from "./button";
import { Y } from "../yascal/yascal";
import { TextAlignment } from "../basetypes";

interface CheckboxButtonProperties extends ButtonProperties {
  checkbox?: boolean;
  onDown?: () => void;
}

export class CheckboxButton extends Button {
  private injectedOnDown: (() => void) | undefined;
  private checkbox: boolean;

  constructor(properties?: CheckboxButtonProperties) {
    // Formerly UI.checkboxbutton
    super(0, 0, 20, 20);
    this.injectedOnDown = properties?.onDown;
    this.checkbox = properties?.checkbox || false;
    this.setProperties({
      background: properties?.background || Assets.buttonDarkBlueScale9,
      hoverBackground:
        properties?.hoverBackground || Assets.buttonDarkBlueActiveScale9,
      activeBackground:
        properties?.activeBackground || Assets.buttonDarkBlueActiveScale9,
      isActive: false,
      textAlign: TextAlignment.left,
      paddingLeft: 30,
      font: properties?.font || UI.fontFT,
      label: properties?.label || "",
      labels: properties?.labels || undefined,
    });
  }

  renderInternal() {
    let stateImageName: string;
    let margin: number;
    if (this.checkbox) {
      stateImageName = this.isActive ? "checkbox_on" : "checkbox_off";
      margin = 7;
    } else {
      stateImageName = this.isActive ? "radio_active" : "radio_inactive";
      margin = 5;
    }

    const stateImage = Y.getImage(stateImageName);
    if (stateImage == null) {
      console.error(
        `Failed to render CheckboxButton due to missing image: ${stateImageName}`,
      );
      return;
    }

    this.ctx.drawImage(stateImage, 8, Math.floor(this.height / 2) - margin);
  }

  onDown() {
    this.toggleActive();
    if (this.injectedOnDown) this.injectedOnDown.bind(this).call(this);
  }
}
