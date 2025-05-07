import { COMMAND, EVENT, TRACKERMODE, VIEW } from "../enum";
import Panel from "./components/panel";
import Tracker from "../tracker";
import EventBus from "../eventBus";
import Input, { TouchData } from "./input";
import Assets from "./assets";
import buttonGroup, { ButtonInfo } from "./app/components/buttonGroup";
import SpinBox from "./spinBox";
import { SliderBox } from "./sliderBox";
import { UI } from "./main";
import App from "../app";
import Button from "./components/button";
import InputBox from "./components/inputbox";
import EnvelopePanel from "./envelopePanel";
import Checkbox from "./components/checkbox";
import WaveForm, { RANGE, SamplePropertyChangeData } from "./waveform";
import { Y } from "./yascal/yascal";
import type Song from "../models/song";
import { TextAlignment } from "./basetypes";
import Layout from "./app/layout";
import type { NoteInfo } from "../models/note";
import NumberDisplay from "./components/numberdisplay";

export default class SampleView extends Panel {
  private currentInstrumentIndex: number | null;
  //private subPanel: string;
  private inputboxHeight: number;
  private instrumentName: InputBox;
  private closeButton: Button;
  private bit8Button: Button;
  private bit16Button: Button;
  private waveForm: WaveForm;
  private volumeEnvelope: EnvelopePanel;
  private panningEnvelope: EnvelopePanel;
  private sideButtonPanel: Panel;
  private spinBoxInstrument: SpinBox;
  private volumeSlider: SliderBox;
  private fineTuneSlider: SliderBox;
  private panningSlider: SliderBox;
  private repeatSpinbox: SpinBox;
  private repeatLengthSpinbox: SpinBox;
  private fadeOutSlider: SliderBox;
  private spinBoxRelativeNote: SpinBox;
  private spinBoxVibratoSpeed: SpinBox;
  private spinBoxVibratoDepth: SpinBox;
  private spinBoxVibratoSweep: SpinBox;
  private waveButtons: Button[];
  private buttons: Button[];
  private buttonsInfo: ButtonInfo[];
  private sampleDisplayPanel: buttonGroup;
  private sampleSelectPanel: buttonGroup;
  private sampleEditPanel: buttonGroup;
  private sampleVolumePanel: buttonGroup;
  private loopTitleBar: Button;
  private loopEnabledCheckbox: Checkbox;
  private vibratoTitleBar: Button;

  constructor() {
    // UI.SampleView()
    super();
    this.name = "SampleView";
    this.hide();
    this.currentInstrumentIndex = null;

    //this.subPanel = "loop";

    this.inputboxHeight = 20;
    const font = UI.fontCondensed;

    this.instrumentName = new InputBox({
      name: "instrumentName",
      height: this.inputboxHeight,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        if (this.currentInstrumentIndex) {
          const instrument = Tracker.getInstrument(this.currentInstrumentIndex);
          if (instrument) instrument.name = value;
          EventBus.trigger(
            EVENT.instrumentNameChange,
            this.currentInstrumentIndex,
          );
        }
      },
    });
    this.addChild(this.instrumentName);

    this.closeButton = Assets.generate("button20_20");
    this.closeButton.setLabel("x");
    this.closeButton.onClick = () => {
      App.doCommand(COMMAND.showBottomMain);
    };
    this.addChild(this.closeButton);

    const buttonProperties = {
      background: Assets.buttonKeyScale9,
      activeBackground: Assets.buttonKeyActiveScale9,
      isActive: false,
      textAlign: TextAlignment.center,
      font: UI.fontDark,
      paddingTopActive: 1,
    };

    this.bit8Button = new Button();
    this.bit16Button = new Button();

    this.bit8Button.setProperties(buttonProperties);
    this.bit8Button.setLabel("8");
    this.bit8Button.setActive(true);
    this.bit8Button.onDown = () => {
      this.changeSampleBit(8);
    };
    this.addChild(this.bit8Button);
    this.bit16Button.setProperties(buttonProperties);
    this.bit16Button.setLabel("16");
    this.bit16Button.onDown = () => {
      this.changeSampleBit(16);
    };
    this.addChild(this.bit16Button);

    this.waveForm = new WaveForm();
    this.addChild(this.waveForm);

    this.waveForm.onMouseWheel = (touchData: TouchData) => {
      if (touchData.mouseWheels[0] > 0) {
        this.waveForm.zoom(1.01);
      } else {
        this.waveForm.zoom(0.99);
      }
    };

    this.volumeEnvelope = new EnvelopePanel("volume");
    this.addChild(this.volumeEnvelope);

    this.panningEnvelope = new EnvelopePanel("panning");
    this.addChild(this.panningEnvelope);

    this.sideButtonPanel = new Panel();
    this.sideButtonPanel.setProperties({
      name: "instrumentSideButtonPanel",
    });

    this.spinBoxInstrument = new SpinBox({
      name: "Instrument",
      label: "",
      value: 1,
      max: 64,
      padLength: 2,
      min: 1,
      font: font,
      onChange: (value) => {
        Tracker.setCurrentInstrumentIndex(value);
      },
    });
    this.addChild(this.spinBoxInstrument);

    this.volumeSlider = new SliderBox({
      name: "Volume",
      label: "Volume",
      font: font,
      height: 200,
      width: 40,
      value: 64,
      max: 64,
      min: 0,
      step: 1,
      vertical: true,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          instrument.sample.volume = value;
        }
      },
    });
    this.sideButtonPanel.addChild(this.volumeSlider);

    this.fineTuneSlider = new SliderBox({
      name: "Finetune",
      label: "Finetune",
      font: font,
      value: 0,
      max: 7,
      min: -8,
      step: 1,
      vertical: true,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) instrument.setFineTune(value);
      },
    });
    this.sideButtonPanel.addChild(this.fineTuneSlider);

    this.panningSlider = new SliderBox({
      name: "Panning",
      label: "Panning",
      font: font,
      value: 0,
      max: 127,
      min: -127,
      vertical: true,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          //instrument.panning = value;
          instrument.sample.panning = value;
        }
      },
    });
    this.sideButtonPanel.addChild(this.panningSlider);

    this.repeatSpinbox = new SpinBox({
      name: "Repeat",
      label: "Start",
      value: 0,
      max: 65535,
      min: 0,
      step: 2,
      font: font,
      trackUndo: true,
      undoInstrument: true,
      disabled: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          if (
            instrument.sample.loop.length + value >
            instrument.sample.length
          ) {
            value = instrument.sample.length - instrument.sample.loop.length;
            this.repeatSpinbox.setValue(value, true);
          }
          instrument.sample.loop.start = value;
        }
        this.waveForm.refresh();
      },
    });
    this.sideButtonPanel.addChild(this.repeatSpinbox);

    this.repeatLengthSpinbox = new SpinBox({
      name: "Repeat Length",
      label: "Length",
      value: 0,
      max: 65535,
      min: 0,
      step: 2,
      font: font,
      trackUndo: true,
      undoInstrument: true,
      disabled: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          if (instrument.sample.loop.start + value > instrument.sample.length) {
            value = instrument.sample.length - instrument.sample.loop.start;
            this.repeatLengthSpinbox.setValue(value, true);
          }
          instrument.sample.loop.length = value;
        }
        EventBus.trigger(EVENT.samplePropertyChange, {
          interal_loopLength: value,
        });
        this.waveForm.refresh();
      },
    });
    this.sideButtonPanel.addChild(this.repeatLengthSpinbox);

    this.fadeOutSlider = new SliderBox({
      name: "Fadeout",
      label: "Fadeout",
      value: 0,
      max: 4095,
      min: 0,
      step: 1,
      font: font,
      vertical: true,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) instrument.fadeout = value;
      },
    });
    this.sideButtonPanel.addChild(this.fadeOutSlider);

    this.spinBoxRelativeNote = new SpinBox({
      name: "relativeNote",
      label: "RelativeNote",
      value: 0,
      max: 128,
      min: -127,
      step: 1,
      font: font,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          instrument.sample.relativeNote = value;
        }
      },
    });
    this.sideButtonPanel.addChild(this.spinBoxRelativeNote);

    this.spinBoxVibratoSpeed = new SpinBox({
      name: "vibratoSpeed",
      label: "Vib Speed",
      value: 0,
      max: 63,
      min: 0,
      step: 1,
      font: font,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          instrument.vibrato.rate = value;
        }
      },
    });
    this.sideButtonPanel.addChild(this.spinBoxVibratoSpeed);
    this.spinBoxVibratoSpeed.hide();

    this.spinBoxVibratoDepth = new SpinBox({
      name: "vibratoDepth",
      label: "Vib Depth",
      value: 0,
      max: 15,
      min: 0,
      step: 1,
      font: font,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          instrument.vibrato.depth = value;
        }
      },
    });
    this.sideButtonPanel.addChild(this.spinBoxVibratoDepth);
    this.spinBoxVibratoDepth.hide();

    this.spinBoxVibratoSweep = new SpinBox({
      name: "vibratoSweep",
      label: "Vib Sweep",
      value: 0,
      max: 255,
      min: 0,
      step: 1,
      font: font,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        const instrument = Tracker.getCurrentInstrument();
        if (instrument) {
          instrument.vibrato.sweep = value;
        }
      },
    });
    this.sideButtonPanel.addChild(this.spinBoxVibratoSweep);
    this.spinBoxVibratoSweep.hide();

    const waveLabels = ["sin", "square", "saw", "saw_inverse"];
    this.waveButtons = [];
    waveLabels.forEach((label, index) => {
      const button = new Button();
      button.setProperties({
        background: Assets.buttonKeyScale9,
        activeBackground: Assets.buttonKeyActiveScale9,
        image: Y.getImage("wave_" + label),
        activeImage: Y.getImage("wave_" + label),
        isActive: false,
      });
      button.onDown = () => {
        this.setVibratoWave(index);
      };
      button.hide();
      this.sideButtonPanel.addChild(button);
      this.waveButtons.push(button);
    });
    this.setVibratoWave(0);

    this.addChild(this.sideButtonPanel);

    this.buttons = [];
    this.buttonsInfo = [
      {
        label: "Load",
        onClick: () => {
          EventBus.trigger(EVENT.showView, VIEW.fileOperationsLoadSample);
        },
      },
      {
        label: "Play",
        onDown: () => {
          Input.handleNoteOn(Input.getPrevIndex());
        },
        onUp: () => {
          Input.handleNoteOff(Input.getPrevIndex());
          Input.clearInputNotes();
          this.waveForm.stop();
        },
      },
      {
        label: "Range",
        onDown: () => {
          this.waveForm.playSection(RANGE.range);
        },
        onUp: () => {
          Input.handleNoteOff(Input.getPrevIndex());
          Input.clearInputNotes();
          this.waveForm.stop();
        },
      },
      {
        label: "Loop",
        onDown: () => {
          this.waveForm.playSection(RANGE.loop);
        },
        onUp: () => {
          Input.handleNoteOff(Input.getPrevIndex());
          Input.clearInputNotes();
          this.waveForm.stop();
        },
      },

      {
        label: "Stop",
        onClick: () => {
          //App.doCommand(COMMAND.showBottomMain);
          Input.clearInputNotes();
          this.waveForm.stop();
        },
      },
      {
        label: "More",
        onClick: () => {
          this.sampleDisplayPanel.toggle();
          this.sampleSelectPanel.toggle();
          this.sampleEditPanel.toggle();
          this.sampleVolumePanel.toggle();

          this.volumeEnvelope.toggle();
          this.panningEnvelope.toggle();

          this.refresh();
        },
      },
    ];

    const buttonsDisplay: ButtonInfo[] = [
      {
        label: "Zoom In",
        width: 62,
        onClick: () => {
          this.waveForm.zoom(2);
        },
      },
      {
        label: "Out",
        width: 38,
        onClick: () => {
          this.waveForm.zoom(0.5);
        },
      },
      {
        label: "All",
        width: 50,
        onClick: () => {
          this.waveForm.zoom(1);
        },
      },
      {
        label: "",
        value: 0,
        width: 50,
        type: "number",
        onSamplePropertyChange: (button, props) => {
          if (
            typeof props.sampleLength !== "undefined" &&
            button instanceof NumberDisplay
          )
            button.setValue(props.sampleLength);
        },
      },
      {
        label: "Loop",
        width: 50,
        onClick: () => {
          this.waveForm.zoom(RANGE.loop);
        },
      },
      {
        label: "",
        value: 0,
        width: 50,
        type: "number",
        onSamplePropertyChange: (button, props) => {
          if (
            typeof props.loopLength !== "undefined" &&
            button instanceof NumberDisplay
          )
            button.setValue(props.loopLength);
          if (
            typeof props.interal_loopLength !== "undefined" &&
            button instanceof NumberDisplay
          )
            button.setValue(props.interal_loopLength);
        },
      },
      {
        label: "Range",
        width: 50,
        onClick: () => {
          this.waveForm.zoom(RANGE.range);
        },
      },
      {
        label: "",
        value: 0,
        width: 50,
        type: "number",
        onSamplePropertyChange: (button, props) => {
          if (
            typeof props.rangeLength !== "undefined" &&
            button instanceof NumberDisplay
          )
            button.setValue(props.rangeLength);
        },
      },
    ];

    const buttonsEdit: ButtonInfo[] = [
      {
        label: "Reverse",
        onClick: () => {
          this.waveForm.reverse();
        },
      },
      {
        label: "Invert",
        onClick: () => {
          this.waveForm.invert();
        },
      },
      {
        label: "Upsample",
        onClick: () => {
          this.waveForm.resample("up");
        },
      },
      {
        label: "DownSample",
        onClick: () => {
          this.waveForm.resample("down");
        },
      },
    ];

    const buttonsVolume: ButtonInfo[] = [
      {
        label: "Maximize",
        onClick: () => {
          this.waveForm.adjustVolume("max");
        },
      },
      {
        label: "Fade In",
        width: 62,
        onClick: () => {
          this.waveForm.adjustVolume("fadein");
        },
      },
      {
        label: "Out",
        width: 38,
        onClick: () => {
          this.waveForm.adjustVolume("fadeout");
        },
      },
      {
        label: "-5%",
        width: 50,
        onClick: () => {
          this.waveForm.adjustVolume(-5);
        },
      },
      {
        label: "+5%",
        width: 50,
        onClick: () => {
          this.waveForm.adjustVolume(5);
        },
      },
      {
        label: "-10%",
        width: 50,
        onClick: () => {
          this.waveForm.adjustVolume(-10);
        },
      },

      {
        label: "+10%",
        width: 50,
        onClick: () => {
          this.waveForm.adjustVolume(10);
        },
      },
    ];

    const buttonsSelect: ButtonInfo[] = [
      {
        label: "[",
        width: 15,
        onClick: () => {
          this.waveForm.select(RANGE.start);
        },
      },
      {
        label: "All",
        width: 70,
        onClick: () => {
          this.waveForm.select(RANGE.all);
        },
      },
      {
        label: "]",
        width: 15,
        onClick: () => {
          this.waveForm.select(RANGE.end);
        },
      },
      {
        label: "None",
        width: 50,
        onClick: () => {
          this.waveForm.select(RANGE.none);
        },
      },
      {
        label: "Loop",
        width: 50,
        onClick: () => {
          this.waveForm.select(RANGE.loop);
        },
      },
      {
        label: "Cut",
        width: 50,
        onClick: () => {
          UI.cutSelection();
        },
      },
      {
        label: "Copy",
        width: 50,
        onClick: () => {
          UI.copySelection();
        },
      },
      {
        label: "Paste",
        onClick: () => {
          UI.pasteSelection();
        },
      },
    ];

    this.buttonsInfo.forEach((buttonInfo) => {
      const button = Assets.generate("buttonLight");
      button.setLabel(buttonInfo.label);
      button.onClick = buttonInfo.onClick;
      button.onDown = buttonInfo.onDown;
      button.onTouchUp = buttonInfo.onUp;
      this.addChild(button);
      this.buttons.push(button);
    });

    this.sampleDisplayPanel = new buttonGroup("Display", buttonsDisplay);
    this.sampleSelectPanel = new buttonGroup("Select", buttonsSelect);
    this.sampleEditPanel = new buttonGroup("Edit", buttonsEdit);
    this.sampleVolumePanel = new buttonGroup("Volume", buttonsVolume);
    this.addChild(this.sampleDisplayPanel);
    this.addChild(this.sampleSelectPanel);
    this.addChild(this.sampleEditPanel);
    this.addChild(this.sampleVolumePanel);

    this.loopTitleBar = new Button();
    this.loopTitleBar.setProperties({
      background: Assets.panelDarkGreyScale9,
      activeBackground: Assets.panelDarkGreyBlueScale9,
      isActive: false,
      label: "Loop",
      font: UI.fontSmall,
      paddingTop: 2,
      paddingTopActive: 2,
      paddingLeft: 20,
    });
    this.loopTitleBar.onDown = () => {
      this.setSubPanel("loop");
    };
    this.addChild(this.loopTitleBar);

    this.loopEnabledCheckbox = new Checkbox();
    this.loopEnabledCheckbox.onToggle = (checked) => {
      const instrument =
        this.currentInstrumentIndex === null
          ? null
          : Tracker.getInstrument(this.currentInstrumentIndex);
      if (instrument) instrument.sample.loop.enabled = checked;

      this.repeatSpinbox.setDisabled(!checked);
      this.repeatLengthSpinbox.setDisabled(!checked);
      this.waveForm.refresh();
    };
    this.addChild(this.loopEnabledCheckbox);

    this.vibratoTitleBar = new Button();
    this.vibratoTitleBar.setProperties({
      background: Assets.panelDarkGreyScale9,
      activeBackground: Assets.panelDarkGreyBlueScale9,
      isActive: false,
      label: "Vibrato",
      font: UI.fontSmall,
      paddingTop: 2,
      paddingTopActive: 2,
    });
    this.vibratoTitleBar.onDown = () => {
      this.setSubPanel("vibrato");
    };
    this.addChild(this.vibratoTitleBar);
    // events
    EventBus.on(EVENT.instrumentChange, (value: number) => {
      this.currentInstrumentIndex = value;
      this.spinBoxInstrument.setValue(value, true);
      const instrument = Tracker.getInstrument(value);
      if (instrument) {
        this.instrumentName.setValue(instrument.name, true);
        this.fineTuneSlider.setValue(instrument.getFineTune(), true);
        this.fadeOutSlider.setValue(instrument.fadeout || 0, true);

        this.spinBoxVibratoSpeed.setValue(instrument.vibrato.rate || 0, true);
        this.spinBoxVibratoDepth.setValue(instrument.vibrato.depth || 0, true);
        this.spinBoxVibratoSweep.setValue(instrument.vibrato.sweep || 0, true);
        this.setVibratoWave(instrument.vibrato.type || 0);

        if (instrument.sample) {
          this.repeatSpinbox.setMax(instrument.sample.length, true);
          this.repeatLengthSpinbox.setMax(instrument.sample.length, true);

          this.volumeSlider.setValue(instrument.sample.volume, true);
          this.panningSlider.setValue(instrument.sample.panning || 0, true);
          this.repeatSpinbox.setValue(instrument.sample.loop.start, true);
          this.repeatLengthSpinbox.setValue(
            instrument.sample.loop.length,
            true,
          );
          this.spinBoxRelativeNote.setValue(
            instrument.sample.relativeNote,
            true,
          );
          this.loopEnabledCheckbox.setState(
            instrument.sample.loop.enabled,
            true,
          );

          if (instrument.sample.bits === 8) {
            this.bit8Button.setActive(true);
            this.bit16Button.setActive(false);
          } else {
            this.bit8Button.setActive(false);
            this.bit16Button.setActive(true);
          }
        }

        this.waveForm.setInstrument(instrument);
        this.volumeEnvelope.setInstrument(instrument);
        this.panningEnvelope.setInstrument(instrument);
      } else {
        this.waveForm.setInstrument();
        this.volumeEnvelope.setInstrument();
        this.panningEnvelope.setInstrument();
        this.instrumentName.setValue("", true);
        this.volumeSlider.setValue(0, true);
        this.panningSlider.setValue(0, true);
        this.fineTuneSlider.setValue(0, true);
        this.repeatSpinbox.setValue(0, true);
        this.repeatLengthSpinbox.setValue(0, true);
        this.spinBoxRelativeNote.setValue(0, true);
        this.fadeOutSlider.setValue(0, true);
      }
    });

    EventBus.on(EVENT.samplePlay, (context: NoteInfo) => {
      if (!this.visible) return;
      if (context && context.instrumentIndex === this.currentInstrumentIndex) {
        const offset =
          context.effects && context.effects.offset
            ? context.effects.offset.value
            : 0;
        this.waveForm.play(context.startPeriod, offset);
      }
    });

    EventBus.on(EVENT.songPropertyChange, (song: Song) => {
      const max = song.instruments.length > 0 ? song.instruments.length - 1 : 1;
      this.spinBoxInstrument.setMax(max);
    });

    EventBus.on(EVENT.trackerModeChanged, (mode: TRACKERMODE) => {
      this.fineTuneSlider.setMax(
        mode === TRACKERMODE.PROTRACKER ? 7 : 127,
        true,
      );
      this.fineTuneSlider.setMin(
        mode === TRACKERMODE.PROTRACKER ? -8 : -128,
        true,
      );

      const instrument =
        this.currentInstrumentIndex === null
          ? null
          : Tracker.getInstrument(this.currentInstrumentIndex);
      if (instrument) {
        this.fineTuneSlider.setValue(instrument.getFineTune(), true);
      }

      this.volumeEnvelope.setDisabled(!Tracker.inFTMode());
      this.panningEnvelope.setDisabled(!Tracker.inFTMode());
      this.spinBoxRelativeNote.setDisabled(!Tracker.inFTMode());
      this.spinBoxVibratoSpeed.setDisabled(!Tracker.inFTMode());
      this.spinBoxVibratoDepth.setDisabled(!Tracker.inFTMode());
      this.spinBoxVibratoSweep.setDisabled(!Tracker.inFTMode());
      this.fadeOutSlider.setDisabled(!Tracker.inFTMode());
      this.panningSlider.setDisabled(!Tracker.inFTMode());
      this.spinBoxInstrument.setMax(Tracker.getMaxInstruments());

      if (mode === TRACKERMODE.PROTRACKER) {
        this.repeatSpinbox.setProperties({ step: 2 });
        this.repeatLengthSpinbox.setProperties({ step: 2 });
        if (instrument) {
          instrument.sample.loop.start =
            Math.floor(instrument.sample.loop.start / 2) * 2;
          instrument.sample.loop.length =
            Math.floor(instrument.sample.loop.length / 2) * 2;
          this.repeatSpinbox.setValue(instrument.sample.loop.start, true);
          this.repeatLengthSpinbox.setValue(
            instrument.sample.loop.length,
            true,
          );
        }
        this.setSubPanel("loop");
      } else {
        this.repeatSpinbox.setProperties({ step: 1 });
        this.repeatLengthSpinbox.setProperties({ step: 1 });
      }
      this.onResize();
    });

    EventBus.on(
      EVENT.samplePropertyChange,
      (newProps: SamplePropertyChangeData) => {
        const instrument =
          this.currentInstrumentIndex === null
            ? null
            : Tracker.getInstrument(this.currentInstrumentIndex);
        if (instrument) {
          if (typeof newProps.loopStart !== "undefined")
            this.repeatSpinbox.setValue(newProps.loopStart, newProps.internal);
          if (typeof newProps.loopLength !== "undefined")
            this.repeatLengthSpinbox.setValue(
              newProps.loopLength,
              newProps.internal,
            );
        }
      },
    );

    EventBus.on(EVENT.sampleIndexChange, (instrumentIndex: number) => {
      if (!this.visible) return;
      if (instrumentIndex === this.currentInstrumentIndex) {
        //const instrument = Tracker.getInstrument(this.currentInstrumentIndex);
        EventBus.trigger(EVENT.instrumentChange, this.currentInstrumentIndex);
      }
    });
  }

  onShow() {
    Input.setFocusElement(this);
    this.onResize();
  }

  onKeyDown(keyCode: number) {
    if (!this.visible) return;
    switch (keyCode) {
      case 37: // left
        this.waveForm.scroll(-1);
        return true;
      case 39: // right
        this.waveForm.scroll(1);
        return true;
      case 46: // delete
        UI.deleteSelection();
        return true;
    }
  }

  onResize() {
    if (!this.isVisible()) return;
    this.clearCanvas();

    const envelopeHeight = 130;
    const spinButtonHeight = 28;
    let sliderHeight = this.sideButtonPanel.height - envelopeHeight - 10;
    let sliderWidth = Math.ceil(this.sideButtonPanel.width / 4);
    let sliderRow2Top = 0;
    let sliderRow2Left = sliderWidth * 2;

    if (this.sideButtonPanel.width < 170) {
      sliderWidth = Math.ceil(this.sideButtonPanel.width / 2);
      sliderHeight = Math.floor(sliderHeight / 2);
      sliderRow2Top = sliderHeight;
      sliderRow2Left = 0;
    }

    this.waveForm.setPosition(
      Layout.col2X,
      this.inputboxHeight + Layout.defaultMargin + 8,
    );
    this.waveForm.setSize(
      Layout.col4W,
      this.height - this.waveForm.top - envelopeHeight - spinButtonHeight - 8,
    );

    this.volumeEnvelope.setPosition(
      Layout.col2X,
      this.waveForm.top + this.waveForm.height + Layout.defaultMargin + 30,
    );
    this.volumeEnvelope.setSize(Layout.col2W, envelopeHeight);

    this.panningEnvelope.setPosition(Layout.col4X, this.volumeEnvelope.top);
    this.panningEnvelope.setSize(Layout.col2W, envelopeHeight);

    this.sampleEditPanel.setSize(Layout.col1W, envelopeHeight);
    this.sampleDisplayPanel.setSize(Layout.col1W, envelopeHeight);
    this.sampleSelectPanel.setSize(Layout.col1W, envelopeHeight);
    this.sampleVolumePanel.setSize(Layout.col1W, envelopeHeight);

    this.sampleDisplayPanel.setPosition(
      Layout.col2X,
      this.waveForm.top + this.waveForm.height + Layout.defaultMargin + 30,
    );
    this.sampleSelectPanel.setPosition(
      Layout.col3X,
      this.sampleDisplayPanel.top,
    );
    this.sampleEditPanel.setPosition(Layout.col4X, this.sampleDisplayPanel.top);
    this.sampleVolumePanel.setPosition(
      Layout.col5X,
      this.sampleDisplayPanel.top,
    );

    let bitButtonSpace = 0;
    let bitButtonOffScreen = 100;
    if (Tracker.inFTMode()) {
      bitButtonSpace = 40;
      bitButtonOffScreen = 0;
    }

    this.instrumentName.setProperties({
      top: Layout.defaultMargin,
      left: Layout.col2X + 71,
      width: Layout.col4W - 71 - 25 - Layout.defaultMargin - bitButtonSpace,
    });

    this.closeButton.setProperties({
      top: Layout.defaultMargin,
      left:
        this.instrumentName.left +
        this.instrumentName.width +
        Layout.defaultMargin +
        bitButtonSpace,
    });

    this.bit8Button.setProperties({
      top: Layout.defaultMargin,
      width: 20,
      height: 20,
      left:
        this.instrumentName.left +
        this.instrumentName.width +
        Layout.defaultMargin -
        2 +
        bitButtonOffScreen,
    });
    this.bit16Button.setProperties({
      top: Layout.defaultMargin,
      width: 20,
      height: 20,
      left:
        this.instrumentName.left +
        this.instrumentName.width +
        Layout.defaultMargin +
        18 +
        bitButtonOffScreen,
    });

    this.sideButtonPanel.setProperties({
      left: 0,
      top: 0,
      width: Layout.col1W,
      height: this.height,
    });

    this.spinBoxInstrument.setProperties({
      left: Layout.col2X,
      top: 1,
      width: 68,
      height: spinButtonHeight,
    });

    this.volumeSlider.setProperties({
      left: 0,
      top: 0,
      width: sliderWidth,
      height: sliderHeight,
    });

    this.fineTuneSlider.setProperties({
      left: sliderWidth,
      top: 0,
      width: sliderWidth,
      height: sliderHeight,
    });

    this.fadeOutSlider.setProperties({
      left: sliderRow2Left,
      top: sliderRow2Top,
      width: sliderWidth,
      height: sliderHeight,
    });

    this.panningSlider.setProperties({
      left: sliderRow2Left + sliderWidth,
      top: sliderRow2Top,
      width: sliderWidth,
      height: sliderHeight,
    });

    const BottomPanelTop =
      this.waveForm.top + this.waveForm.height + Layout.defaultMargin;

    const buttonWidth = Layout.col4W / this.buttons.length;
    this.buttons.forEach((button, index) => {
      button.setProperties({
        width: buttonWidth,
        height: spinButtonHeight,
        left: Layout.col2X + buttonWidth * index,
        top: BottomPanelTop,
      });
    });

    this.loopTitleBar.setProperties({
      width: Layout.col1W / 2,
      height: 18,
      left: 2,
      top: this.volumeEnvelope.top,
    });

    this.loopEnabledCheckbox.setPosition(
      this.loopTitleBar.left + 2,
      this.loopTitleBar.top + 2,
    );

    this.vibratoTitleBar.setProperties({
      width: this.loopTitleBar.width,
      height: this.loopTitleBar.height,
      left: this.loopTitleBar.left + this.loopTitleBar.width,
      top: this.loopTitleBar.top,
    });

    const loopSpinnerHeight = 34;
    const vibratoSpinnerHeight = 30;

    this.repeatSpinbox.setProperties({
      left: 0,
      top: this.loopTitleBar.top + 24,
      width: Layout.col1W,
      height: loopSpinnerHeight,
    });

    this.repeatLengthSpinbox.setProperties({
      left: 0,
      top: this.loopTitleBar.top + 24 + loopSpinnerHeight,
      width: Layout.col1W,
      height: loopSpinnerHeight,
    });

    this.spinBoxRelativeNote.setProperties({
      left: 0,
      top: this.loopTitleBar.top + 24 + loopSpinnerHeight * 2,
      width: Layout.col1W,
      height: loopSpinnerHeight,
    });

    this.spinBoxVibratoSpeed.setProperties({
      left: 0,
      top: this.vibratoTitleBar.top + 22,
      width: Layout.col1W,
      height: vibratoSpinnerHeight,
    });

    this.spinBoxVibratoDepth.setProperties({
      left: 0,
      top: this.vibratoTitleBar.top + 22 + vibratoSpinnerHeight,
      width: Layout.col1W,
      height: vibratoSpinnerHeight,
    });

    this.spinBoxVibratoSweep.setProperties({
      left: 0,
      top: this.vibratoTitleBar.top + 22 + vibratoSpinnerHeight * 2,
      width: Layout.col1W,
      height: vibratoSpinnerHeight,
    });

    const waveButtonWidth = Math.floor((Layout.col1W - 4) / 4);
    const marginLeft = Layout.col1W - waveButtonWidth * 4;
    this.waveButtons.forEach((button, index) => {
      button.setProperties({
        left: marginLeft + index * waveButtonWidth,
        top: this.vibratoTitleBar.top + 22 + vibratoSpinnerHeight * 3,
        width: waveButtonWidth,
        height: 17,
      });
    });
  }

  private changeSampleBit(amount: number) {
    const instrument = Tracker.getCurrentInstrument();
    if (instrument) {
      if (amount === 16) {
        instrument.sample.bits = 16;
        this.bit8Button.setActive(false);
        this.bit16Button.setActive(true);
      } else {
        for (let i = 0, max = instrument.sample.data.length; i < max; i++) {
          instrument.sample.data[i] =
            Math.round(instrument.sample.data[i] * 127) / 127;
        }
        instrument.sample.bits = 8;
        this.bit8Button.setActive(true);
        this.bit16Button.setActive(false);
      }
    }
  }

  private setSubPanel(panel: string) {
    if (panel === "loop") {
      this.spinBoxRelativeNote.show();
      this.repeatLengthSpinbox.show();
      this.repeatSpinbox.show();
      this.spinBoxVibratoSpeed.hide();
      this.spinBoxVibratoDepth.hide();
      this.spinBoxVibratoSweep.hide();
      this.loopTitleBar.setActive();
      this.vibratoTitleBar.setActive(false);
      this.waveButtons.forEach((button) => {
        button.hide();
      });
    } else {
      this.spinBoxRelativeNote.hide();
      this.repeatLengthSpinbox.hide();
      this.repeatSpinbox.hide();
      this.spinBoxVibratoSpeed.show();
      this.spinBoxVibratoDepth.show();
      this.spinBoxVibratoSweep.show();
      this.loopTitleBar.setActive(false);
      this.vibratoTitleBar.setActive();
      this.waveButtons.forEach((button) => {
        button.show();
      });
    }
    //this.subPanel = panel;
    this.onResize();
  }

  private setVibratoWave(index: number) {
    this.waveButtons.forEach((button, i) => {
      button.setActive(index === i);
    });

    const instrument = Tracker.getCurrentInstrument();
    if (instrument) {
      instrument.vibrato.type = index;
    }
  }
}
