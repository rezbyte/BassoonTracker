import { EVENT, TRACKERMODE, VIEW } from "../../enum";
import EventBus from "../../eventBus";
import AppPanelContainer from "./panelContainer";
import Assets from "../assets";
import Layout from "./layout";
import { CheckboxButton } from "../components/checkboxbutton";
import Button, { ButtonProperties } from "../components/button";
import Label from "../components/label";
import SpinBox from "../spinBox";
import { Y } from "../yascal/yascal";
import Tracker from "../../tracker";
import { UI } from "../main";
import Song from "../../models/song";
import AppSongControl from "./components/songControl";
import { Size, TextAlignment } from "../basetypes";

export default class AppControlPanel extends AppPanelContainer {
  private songControl: AppSongControl;
  private buttonFileOperations: CheckboxButton;
  private buttonOptions: CheckboxButton;
  private buttonSampleEdit: CheckboxButton;
  private buttonProperties: ButtonProperties;
  private modButton: Button;
  private xmButton: Button;
  private trackView: number[];
  private trackButtons: Button[];
  private activeIndex: number | null = null;
  private labelTrackerMode: Label;
  private labelTrackView: Label;
  private trackCountSpinbox: SpinBox;
  private innerHeight = 0;

  constructor() {
    // UI.app_controlPanel
    super(40);
    this.songControl = new AppSongControl();
    this.addChild(this.songControl);

    this.buttonFileOperations = new CheckboxButton({
      label: "File",
      onDown: () => {
        const view = this.buttonFileOperations.isActive
          ? VIEW.fileOperations
          : VIEW.topMain;
        EventBus.trigger(EVENT.showView, view);
      },
    });
    this.buttonOptions = new CheckboxButton({
      label: "Options",
      onDown: () => {
        const view = this.buttonOptions.isActive ? VIEW.options : VIEW.topMain;
        EventBus.trigger(EVENT.showView, view);
      },
    });
    this.buttonSampleEdit = new CheckboxButton({
      label: "Sample Edit",
      onDown: () => {
        const view = this.buttonSampleEdit.isActive
          ? VIEW.sampleEditor
          : VIEW.bottomMain;
        EventBus.trigger(EVENT.showView, view);
      },
    });

    this.addChild(this.buttonFileOperations);
    this.addChild(this.buttonOptions);
    this.addChild(this.buttonSampleEdit);

    this.buttonProperties = {
      background: Assets.buttonKeyScale9,
      hoverBackground: Assets.buttonKeyHoverScale9,
      activeBackground: Assets.buttonKeyActiveScale9,
      isActive: false,
      textAlign: TextAlignment.center,
      font: UI.fontDark,
      paddingTopActive: 1,
    };

    this.modButton = new Button();
    this.xmButton = new Button();

    this.modButton.setProperties(this.buttonProperties);
    this.modButton.setLabel("mod");
    this.modButton.onDown = () => {
      Tracker.setTrackerMode(TRACKERMODE.PROTRACKER, false);
    };
    this.addChild(this.modButton);

    this.xmButton.setProperties(this.buttonProperties);
    this.xmButton.setLabel("XM");
    this.xmButton.onDown = () => {
      Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER, false);
    };
    this.addChild(this.xmButton);

    this.trackView = [4, 8, 12, 16];
    this.trackButtons = [];
    this.trackView.forEach(() => {
      this.trackButtons.push(new Button());
    });
    this.trackButtons.forEach((button, index) => {
      button.setProperties(this.buttonProperties);
      button.setLabel("" + this.trackView[index]);
      //button.index = index;
      button.onDown = () => {
        if (button.isDisabled) return;
        this.activeIndex = index;
        this.trackButtons.forEach((b, index) => {
          b.setActive(index === this.activeIndex);
        });
        Layout.setVisibleTracks(this.trackView[this.activeIndex]);
      };
      this.addChild(button);
    });

    this.labelTrackerMode = new Label();
    this.labelTrackerMode.setProperties({
      label: "Mode",
      labels: [
        { width: 20, label: "" },
        { width: 78, label: "M" },
        { width: 84, label: "Md" },
        { width: 100, label: "Mode" },
      ],
      font: UI.fontSmall,
      width: 100,
      height: 20,
      textAlign: TextAlignment.right,
    });
    this.labelTrackerMode.ignoreEvents = true;
    this.addChild(this.labelTrackerMode);

    this.labelTrackView = new Label();
    this.labelTrackView.setProperties({
      label: "Display",
      labels: [
        { width: 10, label: "" },
        { width: 78, label: "t" },
        { width: 84, label: "tr" },
        { width: 100, label: "trck" },
        { width: 120, label: "Display" },
      ],
      font: UI.fontSmall,
      width: 100,
      height: 20,
      textAlign: TextAlignment.right,
    });
    this.labelTrackView.ignoreEvents = true;
    this.addChild(this.labelTrackView);

    this.trackCountSpinbox = new SpinBox();
    this.trackCountSpinbox.setProperties({
      name: "Pattern",
      value: Tracker.getTrackCount(),
      max: 32,
      min: 2,
      size: Size.big,
      padLength: 2,
      trackUndo: true,
      undoLabel: "Change Track count",
      onChange: (value) => {
        Tracker.setTrackCount(value);
      },
    });
    this.addChild(this.trackCountSpinbox);
    this.onPanelResize();

    EventBus.on(EVENT.showView, (view: VIEW) => {
      switch (view) {
        case VIEW.fileOperationsOpenFile:
        case VIEW.fileOperationsSaveFile:
        case VIEW.fileOperationsLoadSample:
        case VIEW.fileOperationsLoadModule:
        case VIEW.fileOperationsSaveSample:
        case VIEW.fileOperationsSaveModule:
          this.buttonFileOperations.setActive(true);
          this.buttonOptions.setActive(false);
          break;
        case VIEW.options:
          this.buttonFileOperations.setActive(false);
          this.buttonOptions.setActive(true);
          break;
        case VIEW.topMain:
          this.buttonFileOperations.setActive(false);
          this.buttonOptions.setActive(false);
          break;
        case VIEW.main:
          this.buttonFileOperations.setActive(false);
          this.buttonOptions.setActive(false);
          this.buttonSampleEdit.setActive(false);
          break;
        case VIEW.bottomMain:
          this.buttonSampleEdit.setActive(false);
          break;
        case VIEW.sampleEditor:
          this.buttonSampleEdit.setActive(true);
          break;
      }
    });

    EventBus.on(EVENT.trackerModeChanged, (mode: TRACKERMODE) => {
      this.modButton.setActive(mode === TRACKERMODE.PROTRACKER);
      this.xmButton.setActive(mode === TRACKERMODE.FASTTRACKER);
      Layout.setLayout();
    });

    EventBus.on(EVENT.trackCountChange, (count: number) => {
      this.trackCountSpinbox.setValue(count, true);
    });

    EventBus.on(EVENT.songLoaded, (song: Song) => {
      let targetChannels = song.channels ?? 0;
      if (targetChannels > 12 && targetChannels < 16) targetChannels = 16;
      if (targetChannels > 8 && targetChannels < 12) targetChannels = 12;
      if (targetChannels > 4 && targetChannels < 8) targetChannels = 8;
      targetChannels = Math.min(targetChannels, Layout.maxVisibleTracks);
      Layout.setVisibleTracks(targetChannels);
      this.onPanelResize();
    });
  }

  onPanelResize() {
    this.innerHeight = this.height - Layout.defaultMargin * 2;
    const row1Top = Layout.defaultMargin;
    let row2Top = Layout.defaultMargin;

    if (Layout.controlPanelButtonLayout === "2row") {
      const halfHeight = Math.floor(
        (this.innerHeight - Layout.defaultMargin) / 2,
      );
      row2Top = this.height - halfHeight - Layout.defaultMargin;
      this.innerHeight = halfHeight;
    }

    this.songControl.setProperties({
      left: Layout.col1X,
      top: row1Top,
      width: Layout.songControlWidth,
      height: this.innerHeight,
      songPatternSelector: Size.small,
    });

    let buttonWidth = Layout.col1W - 60;
    buttonWidth = Math.max(buttonWidth, 120);
    let buttonMargin = Math.floor((Layout.col1W - buttonWidth) / 2);

    let buttonSampleLeft = Layout.col4X + buttonMargin;
    let buttonSampleLabel = "Sample Edit";

    if (Layout.controlPanelButtonLayout !== "1row") {
      buttonWidth = Math.floor(Layout.controlPanelButtonsWidth / 3);
      buttonMargin = 0;
      buttonSampleLeft = Layout.controlPanelButtonsLeft + buttonWidth * 2;
      buttonSampleLabel = "Sample";
    }

    const buttonHeight = this.innerHeight;

    this.buttonFileOperations.setProperties({
      left: Layout.controlPanelButtonsLeft + buttonMargin * 1.5,
      top: row2Top,
      width: buttonWidth,
      height: buttonHeight,
    });

    this.buttonOptions.setProperties({
      left: this.buttonFileOperations.left + buttonWidth + buttonMargin,
      top: row2Top,
      width: buttonWidth,
      height: buttonHeight,
    });

    this.buttonSampleEdit.setProperties({
      left: buttonSampleLeft,
      top: row2Top,
      width: buttonWidth,
      height: buttonHeight,
      label: buttonSampleLabel,
    });

    const marginLeft = Layout.modeButtonsWidth - 101;
    this.modButton.setProperties({
      left: Layout.modeButtonsLeft + marginLeft,
      top: row1Top,
      width: 51,
      height: 16,
    });

    this.xmButton.setProperties({
      left: this.modButton.left + this.modButton.width - 1,
      top: this.modButton.top,
      width: this.modButton.width,
      height: this.modButton.height,
    });

    let bLeft = this.modButton.left;
    this.trackButtons.forEach((button, index) => {
      button.setProperties({
        left: bLeft,
        top: this.modButton.top + this.modButton.height,
        width: 26,
        height: this.modButton.height,
      });
      bLeft += button.width - 1;

      button.setActive(this.trackView[index] === Layout.visibleTracks);
      button.setDisabled(this.trackView[index] > Layout.maxVisibleTracks);
    });

    this.labelTrackerMode.setProperties({
      left: Layout.modeButtonsLeft,
      top: row1Top + 1,
      width: Layout.modeButtonsWidth - 94,
      height: 20,
    });

    this.labelTrackView.setProperties({
      left: this.labelTrackerMode.left,
      top: this.labelTrackerMode.top + this.modButton.height,
      width: this.labelTrackerMode.width,
      height: this.labelTrackerMode.height,
    });

    this.trackCountSpinbox.setProperties({
      left: Layout.modeButtonsLeft,
      top: row1Top,
      width: Layout.TrackCountSpinboxWidth,
      height: this.innerHeight,
    });
  }

  renderInternal() {
    if (Layout.controlPanelButtonLayout === "2row") return;

    const lineVer = Y.getImage("line_ver");
    if (lineVer == null) {
      console.error("AppControlPanel needs the image line_ver to render!");
      return;
    }

    this.ctx.drawImage(
      lineVer,
      Layout.controlPanelButtonsLeft - 2,
      0,
      2,
      this.height - 1,
    );
    this.ctx.drawImage(
      lineVer,
      Layout.modeButtonsLeft - 2,
      0,
      2,
      this.height - 1,
    );

    if (Layout.controlPanelButtonLayout === "condensed") return;

    this.ctx.drawImage(lineVer, Layout.col4X - 2, 0, 2, this.height - 1);

    this.ctx.translate(0.5, 0.5);
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(Layout.col2X + 10, 10);
    this.ctx.lineTo(Layout.col2X + 10, 20);
    this.ctx.lineTo(Layout.col4X - 14, 20);
    this.ctx.lineTo(Layout.col4X - 14, 10);

    this.ctx.moveTo(Layout.col4X + 10, 30);
    this.ctx.lineTo(Layout.col4X + 10, 20);
    this.ctx.lineTo(Layout.col5X - 14, 20);
    this.ctx.lineTo(Layout.col5X - 14, 30);
    this.ctx.stroke();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.buttonFileOperations.render();
    this.buttonOptions.render();
    this.buttonSampleEdit.render();
  }
}
