import { Y } from "../yascal/yascal";
import AppPanelContainer from "./panelContainer";
import Assets from "../assets";
import Button from "../components/button";
import SpinBox from "../spinBox";
import { COMMAND, EVENT, TRACKERMODE } from "../../enum";
import EventBus from "../../eventBus";
import App from "../../app";
import Tracker from "../../tracker";
import Input, { DEFAULT_OCTAVE, Touch } from "../input";
import { UI } from "../main";

export default class AppPianoView extends AppPanelContainer {
  private keyWidth: number;
  private keyOverlap: number;
  private keySizeX: number;
  private keyDown: boolean[];
  private prevDown: number | null;
  private keyMapWhite: number[];
  private keyMapBlack: number[];
  private keyImg: HTMLCanvasElement;
  private keyImgDown: HTMLCanvasElement;
  private bKeyImg: HTMLCanvasElement;
  private bKeyImgDown: HTMLCanvasElement;
  private keyTop: number;
  private bKeyHeight: number;
  private octave: number;
  private maxOctave: number;
  private minOctave: number;
  private closeButton: Button;
  private octaveBox: SpinBox;
  //private innerHeight: number;
  constructor() {
    // UI.app_pianoView
    super(200);
    this.name = "pianoViewPanel";

    this.keyWidth = 64;
    this.keyOverlap = 4;

    this.keySizeX = this.keyWidth - this.keyOverlap;

    this.keyDown = [];
    this.prevDown = null;
    this.keyMapWhite = [0, 2, 4, 5, 7, 9, 11];
    this.keyMapBlack = [-1, 1, 0, 3, 0, -1, 0, 6, 0, 8, 0, 10, 0, -1];

    this.keyImg = AppPianoView.getImage("pianokey_white");
    this.keyImgDown = AppPianoView.getImage("pianokey_white_down");
    this.bKeyImg = AppPianoView.getImage("pianokey_black");
    this.bKeyImgDown = AppPianoView.getImage("pianokey_black_down");

    this.keyTop = 30;
    this.bKeyHeight = 0;
    this.octave = DEFAULT_OCTAVE;
    this.maxOctave = 3;
    this.minOctave = 1;

    this.closeButton = Assets.generate("button20_20");
    this.closeButton.setLabel("x");
    this.closeButton.onClick = () => {
      App.doCommand(COMMAND.togglePiano);
    };
    this.addChild(this.closeButton);

    this.octaveBox = new SpinBox();
    this.octaveBox.setProperties({
      name: "Octave",
      label: "Octave",
      value: 1,
      max: this.maxOctave,
      min: this.minOctave,
      left: 4,
      top: 2,
      height: 28,
      width: 150,
      font: UI.fontMed,
      onChange: (value) => {
        Input.setCurrentOctave(value);
      },
    });
    this.addChild(this.octaveBox);

    this.onPanelResize();

    EventBus.on(EVENT.pianoNoteOn, (index: number) => {
      if (!this.isVisible()) return;
      this.keyDown[index] = true;
      this.refresh();
    });

    EventBus.on(EVENT.pianoNoteOff, (index: number) => {
      if (!this.isVisible()) return;
      this.keyDown[index] = false;
      this.refresh();
    });

    EventBus.on(EVENT.octaveChanged, (value: number) => {
      this.octave = value;
      this.octaveBox.setValue(this.octave, true);
    });

    EventBus.on(EVENT.trackerModeChanged, (mode: TRACKERMODE) => {
      this.maxOctave = Tracker.inFTMode() ? 7 : 3;
      this.minOctave = Tracker.inFTMode() ? 0 : 1;
      this.octaveBox.setMax(this.maxOctave, true);
      this.octaveBox.setMin(this.minOctave); // this.octaveBox.setMin(this.minOctave,true);
    });
  }

  onShow() {
    this.onPanelResize();
  }

  onPanelResize() {
    //this.innerHeight = this.height - (Layout.defaultMargin*2);
    this.closeButton.setProperties({
      top: 4,
      left: this.width - 24,
    });
  }

  private static getImage(imageName: string): HTMLCanvasElement {
    const image = Y.getImage(imageName);
    if (image == null) {
      throw new Error(`AppPianoView could not get image: ${imageName}!`);
    }
    return image;
  }

  private getKeyAtPoint(x: number, y: number): number {
    let key = -1;

    const octaveWidth = this.keySizeX * 7;

    const keyX = x % octaveWidth;
    const keyOctave = Math.floor(x / octaveWidth);

    if (y >= 0) {
      if (y > this.bKeyHeight + this.keyTop) {
        // white key
        const keyIndex = Math.floor(keyX / this.keySizeX);
        key = this.keyMapWhite[keyIndex] + keyOctave * 12;
      } else {
        const subKeyWidth = this.keySizeX / 2;
        const margin = subKeyWidth / 2;
        let subKey = Math.floor((keyX - margin) / subKeyWidth);
        if (subKey < 0) subKey = 0;
        if (subKey > 12) subKey = 12;

        if (subKey % 2 === 0) {
          // white key
          const keyIndex = subKey / 2;
          key = this.keyMapWhite[keyIndex];
        } else {
          // black key
          key = this.keyMapBlack[subKey];
          if (key < 0) {
            // no black key
            const keyIndex = Math.floor(keyX / this.keySizeX);
            key = this.keyMapWhite[keyIndex];
          }
        }
        key += keyOctave * 12;
      }
    }
    return key + 1;
  }

  onDown(data: Touch) {
    const x = data.x;
    const y = data.y;
    //const y = data.y - this.top - keyTop;

    const key = this.getKeyAtPoint(x, y);
    if (key) {
      if (key !== this.prevDown) {
        Input.handleNoteOn(key + this.octave * 12);
        if (this.prevDown)
          Input.handleNoteOff(this.prevDown + this.octave * 12);
        this.prevDown = key;
      }
    }
  }

  onTouchUp(data: Touch) {
    const x = data.x;
    const y = data.y;

    let key: number | null = this.getKeyAtPoint(x, y);
    if (!key) key = this.prevDown;
    if (key) {
      Input.handleNoteOff(key + this.octave * 12);
      this.prevDown = null;
    }

    if (this.prevDown) Input.handleNoteOff(this.prevDown + this.octave * 12);
    this.prevDown = null;
  }

  onDrag(data: Touch) {
    // todo: multitouch?
    const x = data.x;
    const y = data.y;

    const key = this.getKeyAtPoint(x, y);
    if (key) {
      if (key !== this.prevDown) {
        Input.handleNoteOn(key + this.octave * 12);
        if (this.prevDown)
          Input.handleNoteOff(this.prevDown + this.octave * 12);
        this.prevDown = key;
      }
    }
  }

  renderInternal(internal?: boolean) {
    if (!this.isVisible()) return;

    internal = !!internal;

    if (this.needsRendering) {
      // draw white keys
      const keyHeight = this.height - this.keyTop;

      let keyX = 0;

      let counter = 0;
      while (keyX < this.width) {
        const thisOctave = Math.floor(counter / 7);
        const octaveIndex = counter % 7;

        const keyIndex =
          (this.octave + thisOctave) * 12 + this.keyMapWhite[octaveIndex] + 1;

        const img = this.keyDown[keyIndex] ? this.keyImgDown : this.keyImg;
        this.ctx.drawImage(img, keyX, this.keyTop, this.keyWidth, keyHeight);

        counter++;
        keyX += this.keyWidth - this.keyOverlap;
      }

      // draw black keys
      const bKeyWidth = 48;
      this.bKeyHeight = Math.floor(keyHeight / 1.7);
      let bkeyX = this.keyWidth - bKeyWidth / 2 - 2;
      counter = 0;
      let keyCounter = 0;

      while (bkeyX < this.width) {
        const thisOctave = Math.floor(counter / 7);
        const octaveIndex = counter % 7;

        if (octaveIndex !== 2 && octaveIndex !== 6) {
          const keyIndex =
            (this.octave + thisOctave) * 12 +
            this.keyMapBlack[octaveIndex * 2 + 1] +
            1;
          const bImg = this.keyDown[keyIndex] ? this.bKeyImgDown : this.bKeyImg;
          this.ctx.drawImage(
            bImg,
            bkeyX,
            this.keyTop,
            bKeyWidth,
            this.bKeyHeight,
          );
          keyCounter++;
        }
        counter++;

        bkeyX += this.keyWidth - this.keyOverlap;
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
