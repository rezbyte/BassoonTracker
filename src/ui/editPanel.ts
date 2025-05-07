import Element from "./components/element";
import Button from "./components/button";
import { ElementProperties } from "./components/element";
import { UI } from "./main";
import Assets from "./assets";
import Editor from "../editor";
import Scale9Panel from "./components/scale9";
import { TextAlignment } from "./basetypes";

export default class EditPanel extends Element {
  private buttonsPattern: Button[];
  private panel: Scale9Panel;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    // UI.editPanel
    super(x, y, w, h);
    this.type = "EditPanel";

    this.panel = new Scale9Panel(0, 0, 0, 0, Assets.panelInsetScale9);
    this.addChild(this.panel);

    const labels = ["clear", "copy", "paste"];

    this.buttonsPattern = [];
    const handleButton = this.handleButton;
    for (let i = 0; i < 6; i++) {
      const button = Assets.generate("buttonDark");
      button.onClick = function () {
        handleButton(i);
      };
      button.setProperties({
        label: "  " + labels[Math.floor(i / 2)],
        font: UI.fontSmall,
        textAlign: TextAlignment.center,
        paddingTop: 3,
      });
      this.addChild(button);
      this.buttonsPattern.push(button);
    }
  }

  handleButton(index: number) {
    switch (index) {
      case 0:
        Editor.clearTrack();
        UI.setStatus("Track cleared");
        break;
      case 1:
        Editor.clearPattern();
        UI.setStatus("Pattern cleared");
        break;
      case 2:
        Editor.copyTrack(undefined);
        UI.setStatus("Track copied");
        break;
      case 3:
        Editor.copyPattern();
        UI.setStatus("Pattern copied");
        break;
      case 4:
        UI.setStatus(
          Editor.pasteTrack() ? "Track pasted" : "Nothing to paste!",
        );
        break;
      case 5:
        UI.setStatus(
          Editor.pastePattern() ? "Pattern pasted" : "Nothing to paste!",
        );
        break;
    }
  }

  setProperties(p: ElementProperties) {
    this.left = p.left ?? this.left;
    this.top = p.top ?? this.top;
    this.width = p.width ?? this.width;
    this.height = p.height ?? this.height;
    this.name = p.name ?? this.name;
    this.type = p.type ?? this.type;
    this.zIndex = p.zIndex ?? this.zIndex;

    this.setSize(this.width, this.height);
    this.setPosition(this.left, this.top);

    this.panel.setSize(this.width, this.height);

    const buttonWidth = Math.floor(this.width / 2) - 2;
    const buttonHeight = 21;

    for (let i = 0; i < 6; i++) {
      const side = i % 2;
      const row = Math.floor(i / 2);
      this.buttonsPattern[i].setProperties({
        left: side * buttonWidth + 2,
        width: buttonWidth,
        top: 25 + row * buttonHeight,
        height: buttonHeight,
      });
    }
  }

  private triggerChangeEvent() {
    //EventBus.trigger(EVENT.trackStateChange,{track: this.track,  solo: buttons.solo.isActive, mute: buttons.mute.isActive});
  }

  render(internal?: boolean) {
    internal = !!internal;
    if (this.needsRendering) {
      if (!this.isVisible()) return;
      this.clearCanvas();

      this.panel.render();
      const fontMed = UI.fontMed;
      if (fontMed == null) {
        console.error("Failed to render an EditPanel due to missing fontMed!");
        return;
      }

      fontMed.write(this.ctx, "↓Track", 6, 11, 0);
      fontMed.write(
        this.ctx,
        "↓Pattern",
        this.buttonsPattern[1].left + 6,
        11,
        0,
      );

      for (let i = 0; i < 6; i++) {
        this.buttonsPattern[i].render();
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
}
