import Panel from "../../components/panel";
import Scale9Panel from "../../components/scale9";
import { Y } from "../../yascal/yascal";
import Tracker, { FTNotes, FTPeriods, periodNoteTable } from "../../../tracker";
import EventBus, { PatternPosChangeValue } from "../../../eventBus";
import { cachedAssets, EVENT, NOTEOFF, SELECTION } from "../../../enum";
import FxPanel from "../../fxpanel";
import BitmapFont from "../../components/bitmapfont";
import { Pattern } from "../../../models/song";
import Editor from "../../../editor";
import Layout from "../layout";
import { UI } from "../../main";
import StateManager from "../../stateManager";
import Note from "../../../models/note";
import Input, { Drag, Touch, TouchData } from "../../input";
import Settings from "../../../settings";

export default class AppPatternView extends Panel {
  private visibleLines: number;
  private visibleTracks: number;
  private lineHeight: number;
  private centerLineTop: number;
  private scrollBarItemOffset: number;
  private startTrack: number;
  private max: number;
  private font: BitmapFont;
  private displayVolume: boolean;
  private hasVU: boolean;
  private noteCache: Record<string, HTMLCanvasElement>;
  private noteParamCache: Record<string, HTMLCanvasElement>;
  private lineNumberCache: Record<string, HTMLCanvasElement>;
  private range: { start: number[]; end: number[]; top: number; left: number };
  private rangeNormalized: { start: number[]; end: number[] };
  private rangeCopy: Pattern;
  private hasRange: boolean;
  private trackLeft: number;
  private margin: number;
  private scrollBar: Scale9Panel;
  private scrollBarHor: Scale9Panel;
  private fxPanels: FxPanel[];
  private trackVULevel: number[];
  private trackVUHistory: string[];
  private trackVULevelDecay: number;
  private trackVULevelMax: number;
  private startDragPos: number | null;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    // UI.app_patternView
    super(x, y, w, h);
    this.visibleLines = 0;
    this.visibleTracks = 8;
    this.lineHeight = 13;
    this.centerLineTop = 0;
    this.scrollBarItemOffset = 0;
    this.startTrack = 0;
    this.max = 0;
    this.font = Layout.trackFont!; // TODO: Initalize Layout before Assets
    this.displayVolume = false;
    this.hasVU = false;
    this.noteCache = {};
    this.noteParamCache = {};
    this.lineNumberCache = {};

    this.range = { start: [], end: [], top: 0, left: 0 };
    this.rangeNormalized = { start: [], end: [] };
    this.rangeCopy = [];
    this.hasRange = false;

    this.trackLeft = 0;
    this.margin = 0;

    const width = w ?? this.width;

    this.scrollBar = new Scale9Panel(
      width - 28,
      18,
      16,
      (h ?? this.height) - 3,
      {
        img: Y.getImage("bar"),
        left: 2,
        top: 2,
        right: 3,
        bottom: 3,
      },
    );

    this.scrollBar.onDragStart = () => {
      if (Tracker.isPlaying()) return;
      this.scrollBar.startDragIndex = Tracker.getCurrentPatternPos();
    };

    this.scrollBar.onDrag = (touchData) => {
      if (Tracker.isPlaying()) return;
      if (this.visibleLines && this.scrollBarItemOffset) {
        if (this.scrollBar.startDragIndex === undefined) {
          console.error(
            "Pattern view scroll bar onDrag() expected startDragIndex!",
          );
          return;
        }
        const delta = touchData.deltaY;
        let pos = Math.floor(
          this.scrollBar.startDragIndex + delta / this.scrollBarItemOffset,
        );
        pos = Math.min(pos, this.max - 1);
        pos = Math.max(pos, 0);
        Tracker.setCurrentPatternPos(pos);
        //setScrollBarPosition();
      }
    };

    this.addChild(this.scrollBar);
    this.setScrollBarPosition();

    this.scrollBarHor = new Scale9Panel(width - 28, 18, 16, 16, {
      img: Y.getImage("bar"),
      left: 2,
      top: 2,
      right: 3,
      bottom: 3,
    });

    this.scrollBarHor.onDragStart = () => {
      this.scrollBarHor.startDragIndex = this.startTrack;
    };

    this.scrollBarHor.onDrag = (touchData) => {
      if (this.scrollBarHor.startDragIndex === undefined) {
        console.error(
          "Pattern view horizontal scroll bar onDrag() expected startDragIndex!",
        );
        return;
      }
      const maxSteps = Tracker.getTrackCount() - this.visibleTracks;
      const delta = touchData.deltaX;
      const rest = this.width - this.scrollBarHor.width;
      const step = Math.floor(delta / (rest / maxSteps));
      this.setHorizontalScroll(this.scrollBarHor.startDragIndex + step);
      this.onResize();
    };
    this.addChild(this.scrollBarHor);

    this.fxPanels = [];
    for (let i = 0, len = Tracker.getTrackCount(); i < len; i++) {
      const fxPanel = new FxPanel(i);
      this.fxPanels.push(fxPanel);
      this.addChild(fxPanel);
    }

    this.trackVULevel = [];
    this.trackVUHistory = [];
    this.trackVULevelDecay = 5;
    this.trackVULevelMax = 70;

    this.startDragPos = null;

    EventBus.on(EVENT.patternPosChange, (positions: PatternPosChangeValue) => {
      //if (Input.isMetaKeyDown() && !Tracker.getIsRecording() && !Tracker.isPlaying()){
      if (Input.isMetaKeyDown() && !Tracker.isPlaying()) {
        this.initRange(positions);
      }
    });
    EventBus.on(EVENT.cursorPositionChange, (pos: number) => {
      //if (Input.isMetaKeyDown() && !Tracker.getIsRecording() && !Tracker.isPlaying()){
      if (Input.isMetaKeyDown() && !Tracker.isPlaying()) {
        this.initRange({
          current: Tracker.getCurrentPatternPos(),
          prev: Tracker.getCurrentPatternPos(),
        });
      }
    });

    EventBus.on(EVENT.trackCountChange, (trackCount: number) => {
      if (this.visibleTracks < trackCount) this.visibleTracks = trackCount;
      this.startTrack = Math.min(
        this.startTrack,
        trackCount - this.visibleTracks,
      );
      this.startTrack = Math.max(this.startTrack, 0);
      for (let i = this.fxPanels.length, len = trackCount; i < len; i++) {
        const fxPanel = new FxPanel(i);
        this.fxPanels.push(fxPanel);
        this.addChild(fxPanel);
      }
      this.onResize();
      this.refresh();
    });

    EventBus.on(EVENT.songLoaded, () => {
      this.setHorizontalScroll(0);
    });

    EventBus.on(EVENT.visibleTracksCountChange, () => {
      this.startTrack = 0;
      this.onResize();
      this.refresh();
    });

    EventBus.on(EVENT.trackerModeChanged, () => {
      this.refresh();
    });

    EventBus.on(EVENT.fxPanelToggle, (track: number) => {
      const fxPanel = this.fxPanels[track];

      if (fxPanel.visible) {
        fxPanel.hide();
      } else {
        let visibleHeight = this.height;
        const hasHorizontalScrollBar =
          this.visibleTracks < Tracker.getTrackCount();
        if (hasHorizontalScrollBar) visibleHeight -= 24;

        fxPanel.setPosition(fxPanel.left, 0);
        fxPanel.setSize(Layout.trackWidth, visibleHeight);
        fxPanel.setLayout();
        fxPanel.show();
      }

      this.refresh();
    });

    EventBus.on(EVENT.skipFrameChanged, (value: number) => {
      this.trackVULevelDecay = 5 * (value + 1);
    });

    EventBus.on(EVENT.commandSelectAll, () => {
      const currentPattern = Tracker.getCurrentPatternData();
      if (this.isVisible() && currentPattern !== undefined) {
        UI.clearSelection();
        this.range.start = [0, Editor.getCurrentTrack()];
        this.range.end = [currentPattern.length - 1, Editor.getCurrentTrack()];
        this.normalizeRange();
        this.hasRange = true;
        this.range.top = this.range.left = 100000;
        this.showSelectionUI();
        this.refresh();
      }
    });
  }

  setHorizontalScroll(newStartTrack: number) {
    const maxSteps = Tracker.getTrackCount() - this.visibleTracks;
    if (
      newStartTrack != this.startTrack &&
      newStartTrack >= 0 &&
      newStartTrack <= maxSteps
    ) {
      //const delta = newStartTrack-startTrack;
      //Editor.setCurrentTrack(Editor.getCurrentTrack() + delta);
      this.startTrack = newStartTrack;
      EventBus.trigger(EVENT.patternHorizontalScrollChange, this.startTrack);
      this.setScrollBarHorPosition();
    }
  }

  onResize() {
    this.trackLeft = Layout.firstTrackOffsetLeft;
    this.margin = Layout.trackMargin;
    this.visibleTracks = Layout.visibleTracks;

    const hasHorizontalScrollBar = this.visibleTracks < Tracker.getTrackCount();
    const visibleHeight = hasHorizontalScrollBar
      ? this.height - 24
      : this.height;

    for (let i = 0; i < this.visibleTracks; i++) {
      const trackIndex = this.startTrack + i;
      const fxPanel = this.fxPanels[trackIndex];
      if (fxPanel && fxPanel.visible) {
        const trackX = this.trackLeft + i * (Layout.trackWidth + this.margin);

        fxPanel.setPosition(trackX, 0);
        fxPanel.setSize(Layout.trackWidth, visibleHeight);
        fxPanel.setLayout();
        fxPanel.show();
      }
    }
  }

  render(internal?: boolean) {
    if (!this.isVisible()) return;

    if (this.needsRendering) {
      this.clearCanvas();

      const index = Tracker.getCurrentPattern() || 0;
      const patternPos = Tracker.getCurrentPatternPos() || 0;
      const song = Tracker.getSong();
      if (!song) return;

      if (Layout.trackFont) this.font = Layout.trackFont;
      this.max = Tracker.getPatternLength();

      const hasHorizontalScrollBar =
        this.visibleTracks < Tracker.getTrackCount();
      let visibleHeight = this.height - 30;

      this.displayVolume = Tracker.inFTMode();
      let textWidth = this.displayVolume ? 92 : 72;
      let cursorWidth1 = 9;
      let cursorWidth3 = 28;

      if (Layout.useCondensedTrackFont) {
        textWidth = this.displayVolume ? 46 : 36;
        cursorWidth1 = 5;
        cursorWidth3 = 15;
      }

      // used to center text in Column;

      let patternNumberLeft = 10;
      let initialTrackTextOffset =
        Math.floor((Layout.trackWidth - textWidth) / 2) + patternNumberLeft;
      let lineNumbersToTheLeft = false;

      if (this.trackLeft) {
        patternNumberLeft = 0;
        initialTrackTextOffset = 0;
        lineNumbersToTheLeft = true;
      }

      if (hasHorizontalScrollBar) {
        visibleHeight -= 24;
      }

      this.visibleLines = Math.ceil(visibleHeight / this.lineHeight);
      if (this.visibleLines % 2 == 0) this.visibleLines--;

      const topLines = Math.floor(this.visibleLines / 2);

      const visibleStart = patternPos - topLines;
      const visibleEnd = visibleStart + this.visibleLines;

      const centerLineHeight = this.lineHeight + 2;
      this.centerLineTop = Math.floor((visibleHeight + centerLineHeight) / 2);

      const baseY = this.centerLineTop - topLines * this.lineHeight + 4;

      const panelHeight = this.centerLineTop;
      const panelTop2 = this.centerLineTop + centerLineHeight;

      let darkPanel = cachedAssets.darkPanel;
      if (!darkPanel && Y.getImage("panel_dark")) {
        const p = new Scale9Panel(0, 0, Layout.trackWidth, panelHeight, {
          img: Y.getImage("panel_dark"),
          left: 3,
          top: 3,
          right: 2,
          bottom: 2,
        });
        cachedAssets.darkPanel = p.render(true);
        darkPanel = cachedAssets.darkPanel;
      }
      const isTrackVisible = [];
      this.hasVU = false;

      if (this.trackVULevelMax > panelHeight) {
        this.trackVULevelMax = panelHeight;
        this.trackVULevelDecay = this.trackVULevelMax / 10;
      }

      for (let i = 0; i < this.visibleTracks; i++) {
        const trackIndex = this.startTrack + i;
        isTrackVisible[trackIndex] = !(
          this.fxPanels[trackIndex] && this.fxPanels[trackIndex].visible
        );

        if (darkPanel && isTrackVisible[trackIndex]) {
          const trackX = this.trackLeft + i * (Layout.trackWidth + this.margin);
          this.ctx.drawImage(
            darkPanel,
            trackX,
            0,
            Layout.trackWidth,
            panelHeight,
          );
          this.ctx.drawImage(
            darkPanel,
            trackX,
            panelTop2,
            Layout.trackWidth,
            panelHeight,
          );
          if (this.fxPanels[trackIndex])
            this.fxPanels[trackIndex].left = trackX;
        }
      }

      //const patternIndex = song.patternTable[index];
      //const pattern = song.patterns[patternIndex];
      const pattern = song.patterns[index];

      if (pattern) {
        if (Tracker.getIsRecording()) {
          this.ctx.fillStyle = "#A50B0F";
        } else {
          this.ctx.fillStyle = "#202E58";
        }

        this.ctx.fillRect(
          0,
          this.centerLineTop,
          this.width - 0 * 2,
          centerLineHeight,
        );

        // draw cursor
        const cursorPos = Editor.getCurrentTrackPosition();
        let cursorWidth = cursorWidth1;

        let cursorX;
        if (lineNumbersToTheLeft) {
          // center text in pattern
          const trackX =
            this.trackLeft +
            (Editor.getCurrentTrack() - this.startTrack) *
              (Layout.trackWidth + this.margin);
          cursorX =
            trackX +
            Math.floor((Layout.trackWidth - textWidth) / 2) +
            cursorPos * cursorWidth -
            1;
        } else {
          cursorX =
            this.trackLeft +
            initialTrackTextOffset +
            (Editor.getCurrentTrack() - this.startTrack) * Layout.trackWidth +
            cursorPos * cursorWidth -
            1;
        }

        if (cursorPos > 0) {
          cursorX += cursorWidth * 2 + 1;
          if (cursorPos > 2) cursorX += 2;
          if (cursorPos > 4 && this.displayVolume) cursorX += 2;
        } else {
          cursorWidth = cursorWidth3;
        }

        //this.ctx.fillStyle = "rgba(231,198,46,.5)";
        this.ctx.fillStyle = "rgba(220,220,220,.3)";
        this.ctx.fillRect(
          cursorX,
          this.centerLineTop,
          cursorWidth,
          this.lineHeight + 2,
        );

        this.ctx.fillStyle = "rgba(200,150,70,.3)";
        const charWidth = this.font.getCharWidthAsFixed();
        let noteWidth = charWidth * 8 + 14;
        if (this.displayVolume) noteWidth += charWidth * 2 + 2;

        for (let i = visibleStart; i < visibleEnd; i++) {
          if (i >= 0 && i < Tracker.getPatternLength()) {
            const step = pattern[i];
            let y = baseY + (i - visibleStart) * this.lineHeight;

            let isCenter = true;
            if (y < this.centerLineTop) {
              y -= 3;
              isCenter = false;
            }
            if (y > this.centerLineTop + this.lineHeight) {
              y += 3;
              isCenter = false;
            }

            this.renderLineNumber(i, patternNumberLeft, y);
            if (isCenter) {
              this.renderLineNumber(i, patternNumberLeft, y);
              this.renderLineNumber(i, patternNumberLeft, y);
            }

            for (let j = 0; j < this.visibleTracks; j++) {
              const trackIndex = j + this.startTrack;
              if (
                isTrackVisible[trackIndex] &&
                trackIndex < Tracker.getTrackCount()
              ) {
                const note = step[trackIndex] || new Note();
                let x;
                if (lineNumbersToTheLeft) {
                  // center text in pattern
                  const trackX =
                    this.trackLeft + j * (Layout.trackWidth + this.margin);
                  x = trackX + ((Layout.trackWidth - textWidth) >> 1);
                } else {
                  x =
                    this.trackLeft +
                    initialTrackTextOffset +
                    j * Layout.trackWidth;
                }

                if (
                  this.hasRange &&
                  i >= this.rangeNormalized.start[0] &&
                  i <= this.rangeNormalized.end[0] &&
                  trackIndex >= this.rangeNormalized.start[1] &&
                  trackIndex <= this.rangeNormalized.end[1]
                ) {
                  this.range.top = Math.min(this.range.top, y - 2);
                  this.range.left = Math.min(this.range.left, x - 2);
                  this.ctx.fillRect(x - 2, y - 2, noteWidth, this.lineHeight);
                }

                if (isCenter) {
                  this.renderNote(note, x, y);
                  this.renderNote(note, x, y);

                  if (
                    Tracker.isPlaying() ||
                    (this.trackVULevel[j] && Settings.vubars !== "none")
                  ) {
                    // draw VU of center note
                    this.renderVU(
                      note,
                      x - 12,
                      this.centerLineTop,
                      j,
                      index + "." + patternPos,
                    );
                  }
                }

                this.renderNote(note, x, y);
                this.renderNoteParam(note, x, y);
              }
            }

            if (this.hasVU) {
              setTimeout(() => {
                this.refresh();
              }, 20);
            }
          }
        }
      }

      for (let j = 0; j < this.visibleTracks; j++) {
        const trackIndex = j + this.startTrack;
        if (!isTrackVisible[trackIndex]) {
          this.fxPanels[trackIndex].render();
        }
      }

      this.setScrollBarPosition();
      this.scrollBar.render();
      if (hasHorizontalScrollBar) {
        this.setScrollBarHorPosition();
        this.scrollBarHor.render();
      }

      // tracknumbers
      for (let j = 0; j < this.visibleTracks; j++) {
        const trackIndex = j + this.startTrack;
        if (isTrackVisible[trackIndex]) {
          const trackX =
            this.trackLeft + j * (Layout.trackWidth + this.margin) + 2;
          this.drawText("" + (trackIndex + 1), trackX, 2);
        }
      }
    }
    this.needsRendering = false;

    this.parentCtx.drawImage(
      this.canvas,
      this.left,
      this.top,
      this.width,
      this.height,
    );
    return undefined;
  }

  private renderNote(note: Note, x: number, y: number) {
    let id: string;
    if (Tracker.inFTMode()) {
      id = "i" + note.index + "." + this.font.getCharWidthAsFixed();
    } else {
      id = "p" + note.period + "." + this.font.getCharWidthAsFixed();
    }

    if (!this.noteCache[id]) {
      //console.log("Caching note " + id);

      const canvas = document.createElement("canvas");
      canvas.height = this.lineHeight;
      canvas.width = this.font.getCharWidthAsFixed() * 3 + 2;
      const c = canvas.getContext("2d");
      if (c === null) {
        console.error(
          "Failed to get a canvas 2D context to render a note in the pattern view!",
        );
        return;
      }

      let noteString: string;
      if (Tracker.inFTMode()) {
        if (note.index) {
          let ftNote = FTNotes[note.index];
          if (note.index === 97) ftNote = FTNotes[NOTEOFF];

          noteString = ftNote ? ftNote.name : "???";
        } else {
          noteString = "---";
          const baseNote = FTPeriods[note.period];
          if (baseNote) {
            const ftNote = FTNotes[baseNote];
            if (ftNote) noteString = ftNote.name;
          } else {
            if (note.period > 0)
              console.error("no basenote for " + note.period);
          }
        }
      } else {
        let baseNotePeriod = periodNoteTable[note.period];
        noteString = baseNotePeriod ? baseNotePeriod.name : "---";
      }

      this.font.write(c, noteString, 0, 0, 0);

      this.noteCache[id] = canvas;
    }

    this.ctx.drawImage(this.noteCache[id], x, y);
  }

  private renderNoteParam(note: Note, x: number, y: number) {
    const charWidth = this.font.getCharWidthAsFixed();
    x += charWidth * 3 + 4;

    const id =
      "n" +
      note.instrument +
      "." +
      (this.displayVolume ? note.volumeEffect : "") +
      "." +
      note.effect +
      "." +
      note.param +
      "." +
      charWidth;

    if (!this.noteParamCache[id]) {
      //console.log("Caching note param " + id);

      const canvas = document.createElement("canvas");
      canvas.height = this.lineHeight;
      canvas.width = charWidth * 7 + 10;
      const c = canvas.getContext("2d");
      if (c === null) {
        console.error(
          "Failed to get a canvas 2D context to render a pattern view note parameter!",
        );
        return;
      }

      let noteString = this.formatHex(note.instrument, 2, "0");
      if (noteString == "00") noteString = "..";
      let nx = 0;
      this.font.write(c, noteString, nx, 0, 0, "green");

      if (this.displayVolume) {
        nx += charWidth * 2 + 4;
        let value = note.volumeEffect || 0;
        if (value) value -= 16;

        if (value < 80) {
          noteString = this.formatHex(value, 2, "0");
        } else {
          let vuX = (value >> 4).toString(16).toUpperCase();
          let vuY = (value & 0x0f).toString(16).toUpperCase();

          const mapping: Record<string, string> = {
            5: "-",
            6: "+",
            7: "↓",
            8: "↑",
            9: "S",
            A: "V",
            B: "P",
            C: "<",
            D: ">",
            E: "M",
          };
          vuX = mapping[vuX] || vuX;
          noteString = vuX + vuY;
        }

        if (!note.volumeEffect) noteString = "..";
        this.font.write(c, noteString, nx, 0, 0);
      }

      nx += charWidth * 2 + 4;

      if (note.effect > 15) {
        noteString = this.formatHexExtended(note.effect);
      } else {
        noteString = this.formatHex(note.effect);
      }

      noteString += this.formatHex(note.param, 2, "0");
      if (noteString === "000") noteString = "...";
      this.font.write(c, noteString, nx, 0, 0, "orange");

      this.noteParamCache[id] = canvas;
    }

    this.ctx.drawImage(this.noteParamCache[id], x, y);
  }

  private renderVU(
    note: Note,
    x: number,
    y: number,
    track: number,
    index: string,
  ) {
    if (
      Tracker.isPlaying() &&
      note &&
      note.period &&
      this.trackVUHistory[track] !== index
    ) {
      let vu = 100;
      if (note.effect === 12) {
        vu = (note.param * 100) / 64;
      } else {
        const instrument = Tracker.getInstrument(note.instrument);
        if (instrument) vu = (instrument.sample.volume * 100) / 64;
      }
      this.trackVULevel[track] = vu;
      this.trackVUHistory[track] = index;
    }

    if (this.trackVULevel[track]) {
      this.hasVU = true;
      const vuHeight = (this.trackVULevel[track] * this.trackVULevelMax) / 100;
      const sHeight = (vuHeight * 100) / this.trackVULevelMax;

      if (Settings.vubars === "colour") {
        const bar = Y.getImage("vubar");
        if (bar) {
          this.ctx.drawImage(
            bar,
            0,
            100 - sHeight,
            26,
            sHeight,
            x,
            y - vuHeight,
            10,
            vuHeight,
          );
        } else {
          console.error("Failed to get vubar image for a VU bar!");
        }
      } else if (Settings.vubars === "trans") {
        this.ctx.fillStyle = "rgba(120,190,255,0.3)";
        this.ctx.fillRect(x, y - vuHeight, 10, vuHeight);
      }

      this.trackVULevel[track] -= this.trackVULevelDecay;
      if (this.trackVULevel[track] < 0) {
        this.trackVULevel[track] = 0;
      }
    }
  }

  private renderLineNumber(nr: number, x: number, y: number) {
    let ti = "" + nr;
    if (nr < 10) ti = "0" + ti;
    const charWidth = this.font.getCharWidthAsFixed();
    let id = ti + "." + charWidth;

    if (!this.lineNumberCache[id]) {
      const canvas = document.createElement("canvas");
      canvas.height = this.lineHeight;
      canvas.width = charWidth * 3;
      const c = canvas.getContext("2d");
      if (c === null) {
        console.error(
          "Failed to get a canvas 2D context to render a pattern view line number!",
        );
        return;
      }

      let color = undefined;
      if (nr % 4 === 0) color = "orange";

      this.font.write(c, ti, 0, 0, 0, color);
      this.lineNumberCache[id] = canvas;
    }

    this.ctx.drawImage(this.lineNumberCache[id], x, y);
  }

  private drawText(t: string, x: number, y: number, color?: string) {
    this.font.write(this.ctx, t, x, y, 0, color);
  }

  private formatHex(i: number, length?: number, padString?: string): string {
    let h = i.toString(16).toUpperCase();
    if (length && h.length < length) {
      padString = padString || "0";
      while (h.length < length) {
        h = padString + h;
      }
    }
    return h;
  }

  private formatHexExtended(
    i: number,
    length?: number,
    padString?: string,
  ): string {
    let h = i.toString(36).toUpperCase();
    if (length && h.length < length) {
      padString = padString || "0";
      while (h.length < length) {
        h = padString + h;
      }
    }
    return h;
  }

  private setScrollBarPosition() {
    const patternPos = Tracker.getCurrentPatternPos() || 0;
    if (this.visibleLines) {
      const startTop = 1;
      let top = startTop;
      const startHeight = this.height - 2;
      let height = startHeight;
      this.scrollBarItemOffset = 0;

      if (this.max > 1) {
        height = Math.floor((this.visibleLines / this.max) * startHeight);
        if (height < 12) height = 12;
        this.scrollBarItemOffset = (startHeight - height) / (this.max - 1);
      }

      if (patternPos && this.scrollBarItemOffset) {
        top = Math.floor(startTop + this.scrollBarItemOffset * patternPos);
      }

      this.scrollBar.setProperties({
        left: this.width - 16,
        top: top,
        width: 16,
        height: height,
      });
    }
  }

  private setScrollBarHorPosition() {
    const max = this.width;
    const width = Math.floor(
      (max / Tracker.getTrackCount()) * this.visibleTracks,
    );
    const step = (max - width) / (Tracker.getTrackCount() - this.visibleTracks);

    const top =
      this.visibleTracks >= Tracker.getTrackCount() ? -200 : this.height - 20;

    this.scrollBarHor.setProperties({
      top: top,
      width: width,
      left: 0 + Math.floor(this.startTrack * step),
    });
  }

  onMouseWheel(touchData: TouchData) {
    if (Tracker.isPlaying()) return;
    const pos = Tracker.getCurrentPatternPos();
    if (touchData.mouseWheels[0] > 0) {
      if (pos) Tracker.moveCurrentPatternPos(-1);
    } else {
      if (pos < this.max - 1) Tracker.moveCurrentPatternPos(1);
    }
  }

  onDragStart(touchData: Touch) {
    this.scrollBarHor.startDragIndex = this.startTrack;
    if (Tracker.isPlaying()) return;
    this.startDragPos = Tracker.getCurrentPatternPos();

    if (touchData.isMeta || Tracker.getIsRecording()) {
      const track = Math.floor(
        (touchData.x - Layout.firstTrackOffsetLeft) /
          (Layout.trackWidth + Layout.trackMargin),
      );
      const stepsPerTrack = Editor.getStepsPerTrack();
      Editor.setCurrentCursorPosition(
        (this.startTrack + track) * stepsPerTrack,
      );

      UI.clearSelection();
      const startDragTrackX =
        track * (Layout.trackWidth + Layout.trackMargin) +
        Layout.firstTrackOffsetLeft;
      const offsetY = Math.floor(
        (touchData.y - this.centerLineTop) / this.lineHeight,
      );
      this.range.start = [
        Tracker.getCurrentPatternPos() + offsetY,
        Editor.getCurrentTrack(),
      ];
      this.range.end = this.range.start;
      this.range.top = this.range.left = 100000;
      this.refresh();
    }
  }

  onDrag(touchData: Drag) {
    if (this.startDragPos === null) {
      console.error("Pattern view onDrag() expected startDragPos!");
      return;
    }
    if (
      this.visibleTracks < Tracker.getTrackCount() &&
      !(touchData.isMeta || Tracker.getIsRecording())
    ) {
      if (this.scrollBarHor.startDragIndex === undefined) {
        console.error(
          "Pattern view onDrag() expected scrollBarHor.startDragIndex!",
        );
        return;
      }
      const maxSteps = Tracker.getTrackCount() - this.visibleTracks;
      const delta = touchData.deltaX;
      const rest = this.width - this.scrollBarHor.width;
      const step = Math.floor(delta / (rest / maxSteps));
      this.setHorizontalScroll(this.scrollBarHor.startDragIndex - step);
    }

    if (Tracker.isPlaying()) return;

    let delta = Math.round(touchData.deltaY / this.lineHeight);
    let targetPos = this.startDragPos - delta;
    targetPos = Math.max(targetPos, 0);
    targetPos = Math.min(targetPos, this.max - 1);

    if (touchData.isMeta || Tracker.getIsRecording()) {
      this.hasRange = true;
      delta = Math.floor(touchData.deltaY / this.lineHeight);
      const deltaX = Math.floor(touchData.deltaX / Layout.trackWidth);
      this.range.end = [
        this.range.start[0] + delta,
        Editor.getCurrentTrack() + deltaX,
      ];
      this.normalizeRange();
      this.refresh();
    } else {
      Tracker.setCurrentPatternPos(targetPos);
    }
  }

  onTouchUp() {
    if (this.hasRange) {
      this.showSelectionUI();
    }
  }

  onClick(touchData: Touch) {
    const track = Math.floor(
      (touchData.x - Layout.firstTrackOffsetLeft) /
        (Layout.trackWidth + Layout.trackMargin),
    );
    const stepsPerTrack = Editor.getStepsPerTrack();
    Editor.setCurrentCursorPosition((this.startTrack + track) * stepsPerTrack);
  }

  getStartTrack(): number {
    return this.startTrack;
  }

  processSelection(state: SELECTION) {
    if (!this.isVisible()) return;
    switch (state) {
      case SELECTION.RESET:
        this.hasRange = false;
        UI.hideContextMenu();
        this.refresh();
        return true;
      case SELECTION.CLEAR: {
        const pattern = Tracker.getCurrentPatternData();
        if (pattern && this.hasRange) {
          const editAction = StateManager.createRangeUndo(
            Tracker.getCurrentPattern(),
          );
          editAction.name = "Clear Selection";
          for (
            let i = this.rangeNormalized.start[0];
            i <= this.rangeNormalized.end[0];
            i++
          ) {
            const step = pattern[i];
            for (
              let j = this.rangeNormalized.start[1];
              j <= this.rangeNormalized.end[1];
              j++
            ) {
              const note = step[j];
              if (note) {
                StateManager.addNote(editAction, j, i, note);
                note.clear();
              }
            }
          }
          StateManager.registerEdit(editAction);
        }
        this.refresh();
        break;
      }
      case SELECTION.COPY:
      case SELECTION.CUT: {
        this.rangeCopy = [];
        const pattern = Tracker.getCurrentPatternData();
        if (pattern && this.hasRange) {
          for (
            let i = this.rangeNormalized.start[0];
            i <= this.rangeNormalized.end[0];
            i++
          ) {
            const step = pattern[i];
            if (step) {
              const stepCopy = [];
              for (
                let j = this.rangeNormalized.start[1];
                j <= this.rangeNormalized.end[1];
                j++
              ) {
                const note = step[j] || new Note();
                if (note) stepCopy.push(note.duplicate());
              }
              this.rangeCopy.push(stepCopy);
            }
          }
        }
        if (state === SELECTION.CUT) {
          if (this.hasRange && pattern) {
            // really Cut or just Clear?
            // cut:
            /*
						for(let j = rangeNormalized.start[1]; j <= rangeNormalized.end[1]; j++){
							for(let i = rangeNormalized.end[0]+1; i > rangeNormalized.start[0]; i--){
								Editor.removeNote(j,i);
							}
						}*/

            // clear
            const editAction = StateManager.createRangeUndo(
              Tracker.getCurrentPattern(),
            );
            editAction.name = "Cut Selection";
            for (
              let i = this.rangeNormalized.start[0];
              i <= this.rangeNormalized.end[0];
              i++
            ) {
              const step = pattern[i];
              if (step) {
                for (
                  let j = this.rangeNormalized.start[1];
                  j <= this.rangeNormalized.end[1];
                  j++
                ) {
                  const note = step[j];
                  StateManager.addNote(editAction, j, i, note);
                  if (note) note.clear();
                }
              }
            }
            StateManager.registerEdit(editAction);
          }
        }
        this.refresh();
        break;
      }
      case SELECTION.PASTE:
        const pattern = Tracker.getCurrentPatternData();
        if (pattern && this.hasRange && this.rangeCopy.length) {
          const editAction = StateManager.createRangeUndo(
            Tracker.getCurrentPattern(),
          );
          editAction.name = "Paste Selection";
          for (let i = 0; i < this.rangeCopy.length; i++) {
            const step = pattern[this.rangeNormalized.start[0] + i];
            const stepCopy = this.rangeCopy[i];
            if (step) {
              for (let j = 0; j < stepCopy.length; j++) {
                const trackIndex = this.rangeNormalized.start[1] + j;
                let note = step[trackIndex];
                if (!note && trackIndex < Tracker.getTrackCount()) {
                  note = new Note();
                  step[trackIndex] = note;
                }

                if (note) {
                  StateManager.addNote(
                    editAction,
                    trackIndex,
                    this.rangeNormalized.start[0] + i,
                    note,
                  );
                  note.populate(stepCopy[j]);
                }
              }
            }
          }
          StateManager.registerEdit(editAction);
        }
        this.refresh();
        break;
      case SELECTION.POSITION:
        this.range.start = this.range.end = [
          Tracker.getCurrentPatternPos(),
          Editor.getCurrentTrack(),
        ];
        this.normalizeRange();
        this.hasRange = true;
        this.refresh();
        break;
    }
  }

  showSelectionUI() {
    UI.setSelection(this.processSelection.bind(this));

    UI.showContextMenu({
      name: "patternActions",
      items: [
        {
          label: "Clear",
          onClick: () => {
            this.processSelection(SELECTION.CLEAR);
          },
        },
        {
          label: "Cut",
          onClick: () => {
            this.processSelection(SELECTION.CUT);
          },
        },
        {
          label: "Copy",
          onClick: () => {
            this.processSelection(SELECTION.COPY);
          },
        },
        {
          label: "Paste",
          onClick: () => {
            this.processSelection(SELECTION.PASTE);
          },
        },
      ],
      x: this.range.left + this.left + (this.parent?.left ?? 0),
      y: this.range.top + this.top + (this.parent?.top ?? 0),
    });
  }

  private normalizeRange() {
    this.rangeNormalized = {
      start: [this.range.start[0], this.range.start[1]],
      end: [this.range.end[0], this.range.end[1]],
    };
    for (let i = 0; i < 2; i++) {
      if (this.range.start[i] > this.range.end[i]) {
        this.rangeNormalized.start[i] = this.range.end[i];
        this.rangeNormalized.end[i] = this.range.start[i];
      }
    }
  }

  private initRange(positions: PatternPosChangeValue) {
    if (!this.hasRange) {
      this.range.start = [positions.prev || 0, Editor.getCurrentTrack()];
      this.range.end = [positions.current, Editor.getCurrentTrack()];
      this.range.top = this.range.left = 100000;
      this.normalizeRange();
      this.hasRange = true;
      this.showSelectionUI();
      this.refresh();
    } else {
      this.range.end = [
        Tracker.getCurrentPatternPos(),
        Editor.getCurrentTrack(),
      ];
      this.normalizeRange();
      this.refresh();
    }
  }
}
