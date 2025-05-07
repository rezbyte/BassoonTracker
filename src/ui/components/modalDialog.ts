import { UI } from "../main";
import Element, { ElementProperties } from "./element";
import Scale9Panel from "./scale9";
import Assets from "../assets";
import Button from "./button";
import InputBox from "./inputbox";

interface ModalDialogProperties
  extends Omit<ElementProperties, "type" | "zIndex"> {
  ok?: boolean;
  cancel?: boolean;
  input?: boolean;
}

export class ModalDialog extends Element {
  private background: Scale9Panel;
  private okButton: Button;
  private shouldRenderOkButton: boolean;
  private cancelButton: Button;
  private shouldRenderCancelButton: boolean;
  private text = "";
  private inputBox: InputBox | undefined;
  inputValue: string | undefined;
  private shouldRenderInputBox: boolean;
  onClose: (() => void) | null;

  constructor(initialProperties?: ModalDialogProperties) {
    // Formerly Ui.modalDialog
    super();
    this.background = new Scale9Panel(
      0,
      0,
      Math.floor(this.width / 2),
      200,
      Assets.panelMainScale9,
    );

    this.background.ignoreEvents = true;
    this.addChild(this.background);

    const okButton = Assets.generate("buttonLight");
    if (okButton == null) {
      throw new Error(
        "Could not get the asset: buttonLight to initialize the OK button for a ModalDialog!",
      );
    }
    this.okButton = okButton;
    this.okButton.setProperties({
      name: "okbutton",
      label: "OK",
      width: 100,
      height: 28,
    });
    this.addChild(this.okButton);
    this.shouldRenderOkButton = false;

    const cancelButton = Assets.generate("buttonLight");
    if (cancelButton == null) {
      throw new Error(
        "Could not get the asset: buttonLight to initialize the Cancel button for a ModalDialog!",
      );
    }
    this.cancelButton = cancelButton;
    this.cancelButton.setProperties({
      name: "cancelbutton",
      label: "Cancel",
      width: 100,
      height: 28,
    });
    this.addChild(this.cancelButton);
    this.shouldRenderCancelButton = false;

    this.shouldRenderInputBox = false;

    this.onClose = null;
  }

  setProperties(p: ModalDialogProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.shouldRenderOkButton = p.ok ?? this.shouldRenderOkButton;
    this.shouldRenderCancelButton = p.cancel ?? this.shouldRenderCancelButton;
    this.shouldRenderInputBox = p.input ?? this.shouldRenderInputBox;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    let panelHeight = 200;
    if (this.height < panelHeight) panelHeight = this.height - 20;

    const panelWidth = Math.max(Math.floor(this.width / 2), 380);

    this.background.setSize(panelWidth, panelHeight);
    this.background.setPosition(
      Math.floor((this.width - panelWidth) / 2),
      Math.floor((this.height - panelHeight) / 2),
    );

    if (this.shouldRenderCancelButton) {
      this.okButton.setPosition(
        this.background.left + Math.floor(this.background.width / 2) - 110,
        this.background.top + this.background.height - 40,
      );
      this.cancelButton.setPosition(
        this.background.left + Math.floor(this.background.width / 2) + 10,
        this.background.top + this.background.height - 40,
      );
    } else {
      this.okButton.setPosition(
        this.background.left + Math.floor(this.background.width / 2) - 50,
        this.background.top + this.background.height - 40,
      );
    }

    if (this.shouldRenderInputBox) {
      if (!this.inputBox) {
        const inputBox = new InputBox({
          name: "dialoginput",
          width: 200,
          height: 28,
          value: "",
          onChange: () => {
            this.inputValue = inputBox.getValue();
          },
          onSubmit: (value) => {
            this.inputValue = value;
            this.onKeyDown(13);
          },
        });
        this.inputBox = inputBox;
        this.addChild(this.inputBox);
        setTimeout(() => {
          if (this.inputBox) this.inputBox.activate();
        }, 0);
      }

      this.inputBox.setProperties({
        left: this.background.left + 50,
        top: this.background.top + this.background.height - 80,
        width: this.background.width - 100,
        height: 28,
      });
    }
  }

  // will be overriden if other functionality needed
  onKeyDown(keyCode: number): true | undefined {
    switch (keyCode) {
      case 13:
        this.close();
        return true;
    }
  }

  render(internal?: boolean) {
    internal = !!internal;
    if (this.needsRendering) {
      this.clearCanvas();
      this.ctx.fillStyle = "rgba(0,0,0,0.6)";
      this.ctx.fillRect(0, 0, this.width, this.height);

      this.background.render();

      if (this.text) {
        const lines = this.text.split("/");
        let textY = this.background.top + 20;
        //const textX = this.background.left + 10;

        const maxWidth = this.background.width - 20;

        lines.forEach((line) => {
          let textX = 10;
          if (UI.fontFT) {
            const textLength = UI.fontFT.getTextWidth(line, 0);
            textX =
              this.background.left +
              10 +
              Math.floor((maxWidth - textLength) / 2);
            UI.fontFT.write(this.ctx, line, textX, textY, 0);
          }
          textY += 12;
        });
      }

      if (this.shouldRenderOkButton) this.okButton.render();
      if (this.shouldRenderCancelButton) this.cancelButton.render();

      if (this.inputBox) {
        this.inputBox.render();
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

  setText(newText: string) {
    this.text = newText;
  }

  getText(): string {
    return this.text;
  }

  close() {
    this.hide();
    if (this.onClose) this.onClose();
    UI.removeModalElement();
    //delete this;
  }
}
