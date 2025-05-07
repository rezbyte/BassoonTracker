import Button from "../../components/button";
import Panel from "../../components/panel";
import { Y } from "../../yascal/yascal";
import Tracker from "../../../tracker";
import Host from "../../../host";
import Label from "../../components/label";
import Assets from "../../assets";
import { UI } from "../../main";
import App from "../../../app";
import Layout from "../layout";
import { COMMAND } from "../../../enum";
import { TextAlignment } from "../../basetypes";

export default class PatternSidebar extends Panel {
  private sideLabel: Label;
  private buttonsSide: Button[];
  private buttonsSideInfo: { label: string; onClick: () => void }[];
  private pianoButton: Button;
  //private nibblesButton: Button; TODO: Port Nibbles

  constructor() {
    // UI.pattern_sidebar
    super();
    this.setProperties({
      name: "sideButtonPanel",
    });

    this.sideLabel = new Label();
    this.sideLabel.setProperties({
      label: "DEMOSONGS:",
      font: UI.fontFT,
    });
    this.addChild(this.sideLabel);

    this.buttonsSide = [];
    this.buttonsSideInfo = [
      {
        label: "Demomusic",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/demomusic.mod");
        },
      },
      {
        label: "Stardust",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/StardustMemories.mod");
        },
      },
      {
        label: "Space Debris",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/spacedeb.mod");
        },
      },
      {
        label: "Tinytune",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/Tinytune.mod");
        },
      },
      {
        label: "Lotus 2",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/lotus20.mod");
        },
      },
      //{label:"Lotus 1", onClick:() => {Tracker.load('/demomods/lotus10.mod')}},
      {
        label: "Professionaltracker",
        onClick: () => {
          Tracker.load(
            Host.getRemoteUrl() +
              "/demomods/hoffman_and_daytripper_-_professional_tracker.mod",
          );
        },
      },
      //{label:"Monday", onClick:() => {Tracker.load('/demomods/Monday.mod')}},
      //{label:"Lunatic", onClick:() => {Tracker.load('/demomods/sound-of-da-lunatic.mod')}},
      {
        label: "XM: Ambrozia",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/Ambrozia.xm");
        },
      },
      {
        label: "XM: Aquarium",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/aws_aqua.xm");
        },
      },
      {
        label: "8CHN: Block Shockin'",
        onClick: () => {
          Tracker.load(Host.getRemoteUrl() + "/demomods/AceMan.mod");
        },
      },
      //{label:"28CHN: Dope", onClick:() => {Tracker.load('/demomods/dope.mod')}},
      //{label:"Exodus baum", onClick:() => {Tracker.load('/demomods/exodus-baum_load.mod')}},
      //{label:"Drum", onClick:() => {Tracker.load('/demomods/drum.mod')}},
      {
        label: "Random MOD",
        onClick: () => {
          App.doCommand(COMMAND.randomSong);
        },
      },
      {
        label: "Random XM",
        onClick: () => {
          App.doCommand(COMMAND.randomSongXM);
        },
      },
    ];

    for (let i = 0; i < this.buttonsSideInfo.length; i++) {
      const buttonSideInfo = this.buttonsSideInfo[i];
      const buttonElm = new Button();
      buttonElm.info = buttonSideInfo;
      buttonElm.onClick = buttonSideInfo.onClick;
      this.buttonsSide[i] = buttonElm;
      this.addChild(buttonElm);
    }

    this.pianoButton = new Button();
    this.pianoButton.setProperties({
      label: "",
      textAlign: TextAlignment.center,
      background: Assets.buttonLightScale9,
      hoverBackground: Assets.buttonLightHoverScale9,
      image: Y.getImage("piano"),
      font: UI.fontMed,
    });
    this.pianoButton.onClick = () => {
      App.doCommand(COMMAND.togglePiano);
    };
    this.addChild(this.pianoButton);

    /*this.nibblesButton = new Button();
    this.nibblesButton.setProperties({
      label: "",
      textAlign: TextAlignment.center,
      background: Assets.buttonLightScale9,
      hoverBackground: Assets.buttonLightHoverScale9,
      image: Y.getImage("nibbles"),
    });
    this.nibblesButton.onClick = () => {
      App.doCommand(COMMAND.nibbles);
    };
    this.addChild(this.nibblesButton);*/
    this.onResize = this._onResize.bind(this);
    this.onResize();
  }

  private _onResize() {
    this.sideLabel.setSize(this.width, Layout.trackControlHeight);

    const buttonHeight = 30;

    this.pianoButton.setProperties({
      left: 0,
      top: this.height - buttonHeight,
      width: this.width,
      height: buttonHeight,
    });

    const nibblesButtonTop = this.height - buttonHeight - buttonHeight;
    /*this.nibblesButton.setProperties({
      left: 0,
      top: this.height - buttonHeight - buttonHeight,
      width: this.width,
      height: buttonHeight,
    });*/

    const max = this.buttonsSideInfo.length;
    for (let i = 0; i < max; i++) {
      const button = this.buttonsSide[i];
      const buttonTop = i * buttonHeight + this.sideLabel.height;
      let buttonLeft = 0;
      if (buttonTop > nibblesButtonTop - buttonHeight) {
        // buttonTop > this.nibblesButton.top - buttonHeight)
        buttonLeft = -500;
      }

      let background = Assets.buttonLightScale9;
      let backgroundHover = Assets.buttonLightHoverScale9;
      if (i > max - 3) {
        background = Assets.panelDarkScale9;
        backgroundHover = Assets.panelDarkHoverScale9;
      }

      //this.addChild(buttonElm);
      button.setProperties({
        left: buttonLeft,
        top: buttonTop,
        width: this.width,
        height: buttonHeight,
        label: button.info?.label,
        textAlign: TextAlignment.left,
        background: background,
        hoverBackground: backgroundHover,
        font: UI.fontFT,
      });
    }
  }
}
