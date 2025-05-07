import { FILETYPE, MODULETYPE, EVENT, SAMPLETYPE } from "../enum";
import EventBus from "../eventBus";
import Panel from "./components/panel";
import Scale9Panel from "./components/scale9";
import Assets from "./assets";
import RadioGroup, { RadioGroupItem } from "./components/radiogroup";
import Button from "./components/button";
import InputBox from "./components/inputbox";
import BassoonProvider from "../provider/bassoon";
import Dropbox from "../provider/dropbox";
import Editor from "../editor";
import { UI } from "./main";
import Tracker from "../tracker";
import { BinaryStream } from "../filesystem";
import { encodeRIFFsample } from "../audio/riffWave";
import type Song from "../models/song";
import saveAs from "file-saver";
import { Size, TextAlignment } from "./basetypes";

export default class DiskOperationSave extends Panel {
  private fileName: string;
  private selectionType: RadioGroup;
  private fileNameInput: InputBox;
  private background: Scale9Panel;
  private saveButton: Button;
  private saveAsFileType: FILETYPE;
  private mainFileType: FILETYPE;
  private saveAsFileFormat: MODULETYPE | SAMPLETYPE;
  private saveTarget: string;

  constructor() {
    // UI.DiskOperationSave
    super();
    this.fileName = "";
    this.saveAsFileType = FILETYPE.module;
    this.mainFileType = FILETYPE.module;
    this.saveAsFileFormat = MODULETYPE.mod;
    this.saveTarget = "local";

    this.background = new Scale9Panel(
      0,
      0,
      20,
      20,
      Assets.panelDarkInsetScale9,
    );
    this.background.ignoreEvents = true;
    this.addChild(this.background);

    const selectTypes: RadioGroupItem[][] = [];
    selectTypes[FILETYPE.module] = [
      {
        label: "module",
        active: true,
        extention: ".mod",
        fileType: FILETYPE.module,
      },
      {
        label: "wav",
        active: false,
        extention: ".wav",
        fileType: FILETYPE.sample,
        fileFormat: SAMPLETYPE.WAVE_PCM,
      },
      {
        label: "mp3",
        active: false,
        extention: ".mp3",
        fileType: FILETYPE.sample,
        fileFormat: SAMPLETYPE.MP3,
      },
    ];
    selectTypes[FILETYPE.sample] = [
      {
        label: "wav 16 bit",
        active: false,
        extention: ".wav",
        fileType: FILETYPE.sample,
        fileFormat: SAMPLETYPE.RIFF_16BIT,
      },
      {
        label: "wav 8 bit",
        active: true,
        extention: ".wav",
        fileType: FILETYPE.sample,
        fileFormat: SAMPLETYPE.RIFF_8BIT,
      },
      {
        label: "RAW 8 bit",
        active: false,
        extention: ".sample",
        fileType: FILETYPE.sample,
        fileFormat: SAMPLETYPE.RAW_8BIT,
      },
    ];

    this.selectionType = new RadioGroup();
    this.selectionType.setProperties({
      align: TextAlignment.right,
      size: Size.medium,
      divider: "line",
      highLightSelection: true,
    });
    this.selectionType.setItems(selectTypes[FILETYPE.module]);
    this.selectionType.onChange = () => {
      const item = this.selectionType.getSelectedItem();
      this.saveAsFileType =
        item && item.fileType ? item.fileType : FILETYPE.module;
      this.saveAsFileFormat =
        item && item.fileFormat ? item.fileFormat : MODULETYPE.mod;
      this.setFileName();
    };
    this.addChild(this.selectionType);

    this.saveButton = new Button();
    this.saveButton.setProperties({
      label: "Export",
      textAlign: TextAlignment.center,
      background: Assets.buttonLightScale9,
      font: UI.fontMed,
    });
    this.saveButton.onClick = () => {
      if (this.mainFileType == FILETYPE.module) {
        if (this.saveAsFileType == FILETYPE.module) {
          Editor.save(this.fileName, this.saveTarget);
        }
        if (this.saveAsFileType == FILETYPE.sample) {
          //Editor.renderTrackToBuffer(fileName,saveTarget);
          BassoonProvider.renderFile(
            this.fileName,
            this.saveAsFileFormat === SAMPLETYPE.MP3,
          );
        }
      }
      if (this.mainFileType == FILETYPE.sample) {
        const sample = Tracker.getCurrentInstrument().sample;

        if (sample) {
          console.error(this.saveAsFileFormat);

          let file: BinaryStream;
          if (this.saveAsFileFormat === SAMPLETYPE.RAW_8BIT) {
            const fileSize = sample.length; // x2 ?
            const arrayBuffer = new ArrayBuffer(fileSize);
            file = new BinaryStream(arrayBuffer, true);

            file.clear(2);
            let d;
            // sample length is in word
            for (let i = 0; i < sample.length - 2; i++) {
              d = sample.data[i] || 0;
              file.writeByte(Math.round(d * 127));
            }
          } else {
            file = encodeRIFFsample(
              sample.data,
              this.saveAsFileFormat === SAMPLETYPE.RIFF_16BIT ? 16 : 8,
            );
          }

          const b = new Blob([file.buffer], {
            type: "application/octet-stream",
          });

          if (this.saveTarget === "dropbox") {
            Dropbox.putFile("/" + this.fileName, b);
          } else {
            saveAs(b, this.fileName);
          }

          console.error("write sample with " + sample.length + " length");
        }
      }
    };
    this.addChild(this.saveButton);

    this.fileNameInput = new InputBox({
      name: "fileNameInput",
      height: 20,
      onChange: (value) => {
        this.fileName = value;
      },
      backgroundImage: "panel_mid",
    });
    this.addChild(this.fileNameInput);

    EventBus.on(EVENT.songPropertyChange, (song: Song) => {
      this.fileName = song.filename || "";
      this.setFileName();
    });

    EventBus.on(EVENT.diskOperationTargetChange, (item?: RadioGroupItem) => {
      //this.saveTarget = item;
      if (item?.target) this.saveTarget = item.target; //if (this.saveTarget?.target) this.saveTarget = this.saveTarget.target;
      if (item && item.fileType !== undefined) {
        this.mainFileType = item.fileType;
        if (this.mainFileType == FILETYPE.sample) {
          this.fileName = Tracker.getCurrentInstrument()
            .name.replace(/ /g, "-")
            .replace(/\W/g, "");
        }
        if (this.mainFileType == FILETYPE.module) {
          this.fileName = Tracker.getFileName();
        }

        if (selectTypes[this.mainFileType]) {
          this.selectionType.setItems(selectTypes[this.mainFileType]);
          if (this.selectionType.onChange) this.selectionType.onChange(0);
        }
      }
    });

    EventBus.on(EVENT.instrumentChange, () => {
      if (this.isVisible() && this.mainFileType == FILETYPE.sample) {
        this.fileName =
          Tracker.getCurrentInstrument()
            .name.replace(/ /g, "-")
            .replace(/\W/g, "") ||
          "Sample-" + Tracker.getCurrentInstrumentIndex();
        this.setFileName();
      }
    });

    EventBus.on(EVENT.trackerModeChanged, () => {
      if (this.isVisible() && this.mainFileType == FILETYPE.module) {
        this.fileName = Tracker.getSong()?.filename || "";
        this.setFileName();
      }
    });
  }
  private setFileName() {
    let thisFilename = this.fileName;
    const p = this.fileName.lastIndexOf(".");
    let extention = "";
    if (p >= 0) {
      thisFilename = this.fileName.substr(0, p);
      extention = this.fileName.substr(p);
    }
    const type = this.selectionType.getSelectedItem();
    if (type && type.extention) extention = type.extention;
    if (extention === ".mod" && Tracker.inFTMode()) extention = ".xm";
    this.fileNameInput.setValue(thisFilename + extention);
  }

  setLayout() {
    const innerWidth = this.width - 2;

    if (!UI.mainPanel) return;
    this.clearCanvas();

    this.background.setProperties({
      left: 0,
      top: 0,
      height: this.height,
      width: this.width,
    });

    this.fileNameInput.setProperties({
      left: 4,
      width: innerWidth - 6,
      top: 4,
    });

    this.saveButton.setProperties({
      left: 2,
      width: innerWidth,
      height: 28,
      top: this.height - 27,
    });

    this.selectionType.setProperties({
      left: 4,
      width: innerWidth - 4,
      height: this.height - this.saveButton.height - 30,
      top: 30,
    });
  }
}
