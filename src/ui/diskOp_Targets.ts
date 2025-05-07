import Panel from "./components/panel";
import Scale9Panel from "./components/scale9";
import Assets from "./assets";
import RadioGroup, { RadioGroupItem } from "./components/radiogroup";
import EventBus from "../eventBus";
import { EVENT, FILETYPE } from "../enum";
import Label from "./components/label";
import { UI } from "./main";
import Host from "../host";
import { Size, TextAlignment } from "./basetypes";

interface Target {
  label: string;
  target: string;
  active?: boolean;
}
export default class DiskOperationTargets extends Panel {
  private currentTarget: string;
  private background: Scale9Panel;
  private label1: Scale9Panel;
  private label: Label;
  private targetsModule: Target[];
  private targetsSample: Target[];
  private targetsSave: Target[];
  private currentLoadTargets: any;
  private currentAction: string;
  private selectionTarget: RadioGroup;
  constructor() {
    // UI.DiskOperationTargets
    super();
    this.currentTarget = "bassoon";

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

    this.label = new Label({
      label: "From",
      font: UI.fontSmall,
    });
    this.addChild(this.label);

    this.targetsModule = [
      { label: "Bassoon:", target: "bassoon", active: true },
      { label: "Modarchive:", target: "modarchive" },
      { label: "Modules.pl:", target: "modulespl" },
      { label: "Dropbox:", target: "dropbox" },
      { label: "local:", target: "local" },
    ];

    this.targetsSample = [
      { label: "Bassoon:", target: "bassoon", active: true },
      { label: "Dropbox:", target: "dropbox" },
      { label: "local:", target: "local" },
    ];

    this.targetsSave = [
      { label: "local:", target: "local", active: true },
      { label: "Dropbox:", target: "dropbox" },
    ];

    if (!Host.useDropbox) {
      this.removeTarget(this.targetsModule, "dropbox");
      this.removeTarget(this.targetsSample, "dropbox");
      this.removeTarget(this.targetsSave, "dropbox");
    }
    this.currentLoadTargets = this.targetsModule;
    this.currentAction = "load";

    this.selectionTarget = new RadioGroup();
    this.selectionTarget.setProperties({
      align: TextAlignment.right,
      size: Size.medium,
      divider: "line",
      highLightSelection: true,
    });
    this.selectionTarget.setItems(this.targetsModule);
    this.selectionTarget.onChange = (selectedIndex) => {
      EventBus.trigger(
        EVENT.diskOperationTargetChange,
        this.selectionTarget.getSelectedItem(),
      );
    };
    this.addChild(this.selectionTarget);
    EventBus.on(EVENT.diskOperationTargetChange, (target?: RadioGroupItem) => {
      if (target && target.fileType !== undefined && target.fileType !== null) {
        if (this.currentAction === "save") {
          this.selectionTarget.setItems(this.targetsSave);
        } else {
          if (target.fileType === FILETYPE.module) {
            this.currentLoadTargets = this.targetsModule;
          }
          if (target.fileType === FILETYPE.sample) {
            this.currentLoadTargets = this.targetsSample;
          }

          this.selectionTarget.setItems(this.currentLoadTargets);
        }

        this.selectionTarget.setSelectedIndex(0);
      }
    });

    EventBus.on(
      EVENT.diskOperationActionChange,
      (target: RadioGroupItem | undefined) => {
        if (target == null) return;

        if (target.label === "save") {
          this.label.setLabel("To");
          this.currentAction = "save";
          this.selectionTarget.setItems(this.targetsSave);
        } else {
          this.label.setLabel("From");
          this.currentAction = "load";
          this.selectionTarget.setItems(this.currentLoadTargets);
        }

        EventBus.trigger(
          EVENT.diskOperationTargetChange,
          this.selectionTarget.getSelectedItem(),
        );
      },
    );

    EventBus.on(EVENT.dropboxConnectCancel, () => {
      this.selectionTarget.setSelectedIndex(0);
    });
  }

  private removeTarget(list: Target[], target: string) {
    const index = list.findIndex((item) => {
      return item.target === target;
    });
    if (index >= 0) {
      list.splice(index, 1);
    }
  }

  setLayout() {
    const innerWidth = this.width - 3;

    if (!UI.mainPanel) return;
    this.clearCanvas();

    this.background.setProperties({
      left: 0,
      top: 0,
      height: this.height,
      width: this.width,
    });

    this.label1.setProperties({
      left: 2,
      top: 1,
      height: 16,
      width: innerWidth,
    });

    this.label.setProperties({
      left: -1,
      top: 3,
      height: 16,
      width: innerWidth,
    });

    const buttonTop = 18;

    this.selectionTarget.setProperties({
      width: innerWidth,
      height: this.height - buttonTop - 2,
      left: 2,
      top: buttonTop,
    });
  }

  getTarget(): string {
    return this.currentTarget;
  }
}
