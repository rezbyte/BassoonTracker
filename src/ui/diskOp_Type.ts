import Panel from "./components/panel";
import Scale9Panel from "./components/scale9";
import Assets from "./assets";
import Label from "./components/label";
import { UI } from "./main";
import RadioGroup from "./components/radiogroup";
import EventBus from "../eventBus";
import { EVENT, FILETYPE } from "../enum";
import { Size, TextAlignment } from "./basetypes";

export default class DiskOperationType extends Panel {
  private background: Scale9Panel;
  private label1: Scale9Panel;
  private labelLoad: Label;
  private selectionType: RadioGroup;

  constructor() {
    // UI.DiskOperationType
    super();
    this.background = new Scale9Panel(
      0,
      0,
      20,
      20,
      Assets.panelDarkInsetScale9,
    );
    this.background.ignoreEvents = true;
    this.addChild(this.background);

    this.label1 = new Scale9Panel(0, 0, 20, 20, Assets.panelDarkGreyScale9);
    this.label1.ignoreEvents = true;
    this.addChild(this.label1);

    this.labelLoad = new Label({
      label: "Type",
      font: UI.fontSmall,
    });
    this.addChild(this.labelLoad);

    this.selectionType = new RadioGroup();
    this.selectionType.setProperties({
      align: TextAlignment.right,
      size: Size.medium,
      divider: "line",
      highLightSelection: true,
    });
    this.selectionType.setItems([
      { label: "module", active: true, fileType: FILETYPE.module },
      { label: "sample", active: false, fileType: FILETYPE.sample },
      //{label:"pattern",active:false, fileType: FILETYPE.pattern}
    ]);
    this.selectionType.onChange = (selectedIndex) => {
      EventBus.trigger(
        EVENT.diskOperationTargetChange,
        this.selectionType.getSelectedItem(),
      );
    };
    this.addChild(this.selectionType);
  }
  setLayout() {
    const innerWidth = this.width - 2;
    let innerHeight = 70;

    if (this.height < 100) {
      innerHeight = this.height - 20;
    }

    if (!UI.mainPanel) return;
    this.clearCanvas();

    this.background.setProperties({
      left: 0,
      top: 0,
      height: this.height,
      width: this.width,
    });

    this.label1.setProperties({
      left: 1,
      top: 1,
      height: 16,
      width: innerWidth,
    });

    this.labelLoad.setProperties({
      left: -1,
      top: 3,
      height: 16,
      width: innerWidth,
    });

    this.selectionType.setProperties({
      left: 4,
      width: innerWidth - 4,
      height: innerHeight,
      top: 18,
    });
  }

  // TODO: Make return type enum
  getType(): "modules" | "samples" | "patterns" {
    const index = this.selectionType.getSelectedIndex();
    let result: "modules" | "samples" | "patterns" = "modules";
    if (index == 1) result = "samples";
    if (index == 2) result = "patterns";
    return result;
  }

  setType(index: number) {
    this.selectionType.setSelectedIndex(index);
  }
}
