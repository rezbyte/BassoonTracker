import EventBus from "../eventBus";
import { SELECTION, EVENT } from "../enum";
import Element from "./components/element";
import Scale9Panel from "./components/scale9";
import { Y } from "./yascal/yascal";
import Audio from "../audio";
import type { Drag, Touch } from "./input";
import Instrument from "../models/instrument";
import Tracker from "../tracker";
import StateManager, { SampleUndo } from "./stateManager";
import Input from "./input";
import { UI } from "./main";

const enum MARKERTYPE {
  loopStart = 1,
  loopEnd = 2,
  rangeStart = 3,
  rangeEnd = 4,
}

export const enum RANGE {
  none = "none",
  all = "all",
  loop = "loop",
  start = "start",
  end = "end",
  range = "range",
}

interface SplitSample {
  tail: number[];
  range: number[];
  head: number[];
}

export interface SamplePropertyChangeData {
  loopStart?: number;
  loopLength?: number;
  sampleLength?: number;
  internal?: boolean;
  interal_loopLength?: number;
  rangeLength?: number;
}

export default class WaveForm extends Element {
  private currentSampleData: number[] | null;
  private currentInstrument: Instrument | null;
  private isPlaying: boolean;
  private isDraggingRange: boolean;
  //private hasRange;
  private startPlayTime: number | null;
  private sampleRate: number | null;
  private dragRangeEnd: number | null;
  private rangeStart: number;
  private rangeEnd: number;
  private rangeLength: number;
  private dragMarker: number;
  private activeDragMarker: number;
  private dragMarkerStart: number;
  private isDown: boolean;
  private zoomAmount: number;
  private zoomStart: number;
  private zoomEnd: number;
  private zoomLength: number;
  private hasHorizontalScrollBar: boolean;
  private ignoreInstrumentChange: boolean;
  private rangeCache: number[];
  private playingOffset: number;
  private waveformDisplay: Element; // TODO: Make an Element for waveformDisplay
  private background: Scale9Panel;
  private scrollBar: Scale9Panel;

  constructor() {
    // UI.WaveForm
    super();
    this.name = "Waveform";
    this.currentSampleData = null;
    this.currentInstrument = null;
    this.isPlaying = false;
    this.isDraggingRange = false;
    this.startPlayTime = null;
    this.sampleRate = null;
    this.dragRangeEnd = null;
    this.rangeStart = -1;
    this.rangeEnd = -1;
    this.rangeLength = 0;
    this.dragMarker = 0;
    this.activeDragMarker = 0;
    this.dragMarkerStart = 0;
    this.isDown = false;
    this.zoomAmount = 1;
    this.zoomStart = 0;
    this.zoomEnd = 0;
    this.zoomLength = 0;
    this.hasHorizontalScrollBar = false;
    this.ignoreInstrumentChange = false;
    this.rangeCache = [];
    this.playingOffset = 0;

    this.waveformDisplay = new Element();

    this.background = new Scale9Panel(0, 0, this.width, this.height, {
      img: Y.getImage("panel_dark"),
      left: 3,
      top: 3,
      right: 2,
      bottom: 2,
    });
    this.background.ignoreEvents = true;

    this.scrollBar = new Scale9Panel(1, 0, 100, 18, {
      img: Y.getImage("bar"),
      left: 2,
      top: 2,
      right: 3,
      bottom: 3,
    });

    this.scrollBar.onDragStart = () => {
      //if (Tracker.isPlaying()) return;
      this.scrollBar.startDragIndex = this.zoomStart;
      this.scrollBar.startLeft = this.scrollBar.left;
    };

    this.scrollBar.onDrag = (touchData) => {
      if (this.scrollBar.startLeft === undefined) {
        console.error(
          "WaveForm.onDrag() expected startLeft to be set in WaveForm.onDragStart()!",
        );
        return;
      }
      let newPos = this.scrollBar.startLeft + touchData.deltaX;
      const min = 1;
      const max = this.width - this.scrollBar.width - 1;

      newPos = Math.max(newPos, min);
      newPos = Math.min(newPos, max);

      this.scrollBar.setPosition(newPos, this.scrollBar.top);

      const range = newPos / (max - min);
      this.zoomLength = this.zoomEnd - this.zoomStart;
      this.zoomStart = Math.floor(
        (this.sampleLength - this.zoomLength) * range,
      );
      this.zoomEnd = this.zoomStart + this.zoomLength;
      this.waveformDisplay.refresh();
    };
    this.addChild(this.scrollBar);

    EventBus.on(EVENT.screenRefresh, () => {
      if (!this.isRefreshing()) return;
      if (!this.isVisible()) return;
      this.refresh();
    });
    EventBus.on(EVENT.commandSelectAll, () => {
      if (this.isVisible()) {
        this.select(RANGE.all);
      }
    });
    EventBus.on(EVENT.commandProcessSample, (action: SampleUndo) => {
      if (this.isVisible()) {
        if (action.undo) {
          let data: SplitSample;
          switch (action.action) {
            case SELECTION.CUT:
              this.select(RANGE.range, action.from, 0);
              data = this.splitRange(true);
              data.range = action.data;
              this.joinRange(data);
              this.restoreLoop(action);
              this.select(RANGE.range, action.from, action.data.length);
              break;
            case SELECTION.PASTE:
              this.select(RANGE.range, action.from, action.to);
              data = this.splitRange(true);
              data.range = action.data;
              this.joinRange(data);
              this.restoreLoop(action);
              this.select(RANGE.range, action.from, action.data.length);
              break;
            case SELECTION.REPLACE:
              this.select(RANGE.range, action.from, action.to);
              data = this.splitRange();
              data.range = action.data;
              this.joinRange(data);
              if (action.to) {
                this.select(RANGE.range, action.from, action.data.length);
              }
              break;
          }
        }

        if (action.redo) {
          let data: SplitSample;
          switch (action.action) {
            case SELECTION.CUT:
              this.select(RANGE.range, action.from, action.data.length);
              data = this.splitRange();
              data.range = [];
              this.joinRange(data);
              this.select(RANGE.range, action.from, 0);
              break;
            case SELECTION.PASTE:
              this.select(RANGE.range, action.from, action.data.length || 0);
              data = this.splitRange(true);
              data.range = action.dataTo;
              this.joinRange(data);
              this.checkLoop();
              this.select(RANGE.range, action.from, action.dataTo.length);
              break;
            case SELECTION.REPLACE:
              this.select(RANGE.range, action.from, action.to);
              data = this.splitRange();
              data.range = action.dataTo;
              this.joinRange(data);
              if (action.to) {
                this.select(RANGE.range, action.from, action.data.length);
              }
              break;
          }
        }
      }
    });
  }

  private get sampleLength(): number {
    return this.currentSampleData?.length ?? 0;
  }

  private isRefreshing() {
    return this.isPlaying || this.isDraggingRange;
  }

  scroll(delta: number) {
    let newPos = this.scrollBar.left + delta;
    const min = 1;
    const max = this.width - this.scrollBar.width - 1;

    newPos = Math.max(newPos, min);
    newPos = Math.min(newPos, max);

    this.scrollBar.setPosition(newPos, this.scrollBar.top);

    const range = newPos / (max - min);
    this.zoomLength = this.zoomEnd - this.zoomStart;
    this.zoomStart = Math.floor((this.sampleLength - this.zoomLength) * range);
    this.zoomEnd = this.zoomStart + this.zoomLength;
    this.waveformDisplay.refresh();
  }

  onDragStart(touchData: Touch) {
    if (this.currentInstrument === null) return;

    const x = touchData.startX;

    if (this.currentInstrument.sample.loop.enabled) {
      let markerX = this.getLoopMarkerPos(MARKERTYPE.loopEnd);
      if (Math.abs(x - markerX) < 5) {
        this.dragMarker = MARKERTYPE.loopEnd;
        this.dragMarkerStart = this.currentInstrument.sample.loop.length;
        return;
      }

      markerX = this.getLoopMarkerPos(MARKERTYPE.loopStart);
      if (Math.abs(x - markerX) < 5) {
        this.dragMarker = MARKERTYPE.loopStart;
        this.dragMarkerStart = this.currentInstrument.sample.loop.start;
        return;
      }
    }

    if (this.rangeLength) {
      const markerX = this.getRangeMarkerPos(MARKERTYPE.rangeEnd);
      if (Math.abs(x - markerX) < 5) {
        this.dragMarker = MARKERTYPE.rangeEnd;
        this.dragMarkerStart = this.rangeLength;
        return;
      }
    }

    if (this.rangeStart >= 0) {
      const markerX = this.getRangeMarkerPos(MARKERTYPE.rangeStart);
      if (Math.abs(x - markerX) < 5) {
        this.dragMarker = MARKERTYPE.rangeStart;
        this.dragMarkerStart = this.rangeStart;
        return;
      }
    }

    this.isDraggingRange = true;
    const dragRangeStart = (this.dragRangeEnd = touchData.startX);

    const pixelValue =
      this.currentInstrument.sample.length / this.width / this.zoomAmount;
    this.rangeStart = this.rangeEnd = Math.round(
      this.zoomStart + dragRangeStart * pixelValue,
    );
    this.rangeLength = 0;
    EventBus.trigger(EVENT.samplePropertyChange, {
      rangeLength: this.rangeLength,
    });
  }

  onDrag(touchData: Drag) {
    if (this.currentInstrument === null) return;
    const pixelValue =
      this.currentInstrument.sample.length / this.width / this.zoomAmount;

    if (
      this.dragMarker &&
      (this.dragMarker === MARKERTYPE.loopStart ||
        this.dragMarker === MARKERTYPE.loopEnd)
    ) {
      this.activeDragMarker = this.dragMarker;
      let value =
        this.dragMarkerStart + Math.round(pixelValue * touchData.deltaX);
      if (!Tracker.inFTMode()) value -= value % 2;

      const newProps: Partial<SamplePropertyChangeData> = {};

      if (this.dragMarker === MARKERTYPE.loopStart) {
        value = Math.min(value, this.sampleLength - 2);
        value = Math.max(value, 0);
        newProps.loopStart = value;

        if (
          newProps.loopStart + this.currentInstrument.sample.loop.length >
          this.sampleLength
        ) {
          newProps.loopLength = this.sampleLength - newProps.loopStart;
        }
      } else {
        value = Math.max(value, 2);
        value = Math.min(
          value,
          this.sampleLength - this.currentInstrument.sample.loop.start,
        );

        newProps.loopLength = value;
      }

      EventBus.trigger(EVENT.samplePropertyChange, newProps);
      this.refresh();
      return;
    }

    if (
      this.dragMarker &&
      (this.dragMarker === MARKERTYPE.rangeStart ||
        this.dragMarker === MARKERTYPE.rangeEnd)
    ) {
      this.activeDragMarker = this.dragMarker;
      let value =
        this.dragMarkerStart + Math.round(pixelValue * touchData.deltaX);

      if (this.dragMarker === MARKERTYPE.rangeStart) {
        value = Math.min(value, this.sampleLength - 2);
        value = Math.max(value, 0);
        this.rangeStart = value;

        if (this.rangeStart + this.rangeLength > this.sampleLength) {
          this.rangeLength = this.sampleLength - this.rangeStart;
        }
      } else {
        value = Math.max(value, 2);
        value = Math.min(value, this.sampleLength - this.rangeStart);
        this.rangeLength = value;
      }

      EventBus.trigger(EVENT.samplePropertyChange, {
        rangeLength: this.rangeLength,
      });
      this.refresh();
      return;
    }

    this.dragRangeEnd = touchData.x;
    this.rangeEnd = Math.round(this.zoomStart + this.dragRangeEnd * pixelValue);
    this.rangeEnd = Math.max(this.rangeEnd, 0);
    this.rangeLength = this.rangeEnd - this.rangeStart;

    EventBus.trigger(EVENT.samplePropertyChange, {
      rangeLength: Math.abs(this.rangeLength),
    });
  }

  onTouchUp() {
    if (this.isDraggingRange) {
      if (this.rangeStart > this.rangeEnd) {
        this.rangeLength = this.rangeStart - this.rangeEnd;
        this.rangeStart = this.rangeEnd;
        this.rangeEnd = this.rangeStart + this.rangeLength;
        this.refresh();
      }
    }

    this.isDraggingRange = false;
    this.dragMarker = 0;
    this.isDown = false;

    if (this.rangeLength) UI.setSelection(this.processSelection.bind(this));
  }

  onDown() {
    this.isDown = true;
  }

  onHover() {
    if (!this.isDraggingRange && !this.dragMarker && !this.isDown) {
      const prevDragMarker = this.activeDragMarker;
      if (!this.isDown) this.activeDragMarker = 0;

      const x = this.eventX;
      if (x === undefined) {
        console.error("Waveform.onHover() expected eventX to be processed!");
        return;
      }
      //const y = this.eventY;

      if (this.rangeStart >= 0) {
        const markerX = this.getRangeMarkerPos(MARKERTYPE.rangeStart);
        if (Math.abs(x - markerX) < 5) {
          this.activeDragMarker = MARKERTYPE.rangeStart;
          if (prevDragMarker !== this.activeDragMarker) this.refresh();
          return;
        }
      }

      if (this.rangeEnd >= 0) {
        const markerX = this.getRangeMarkerPos(MARKERTYPE.rangeEnd);
        if (Math.abs(x - markerX) < 5) {
          this.activeDragMarker = MARKERTYPE.rangeEnd;
          if (prevDragMarker !== this.activeDragMarker) this.refresh();
          return;
        }
      }

      if (this.currentInstrument?.sample.loop.enabled) {
        let markerX = this.getLoopMarkerPos(MARKERTYPE.loopEnd);
        if (Math.abs(x - markerX) < 5) {
          this.activeDragMarker = MARKERTYPE.loopEnd;
          if (prevDragMarker !== this.activeDragMarker) this.refresh();
          return;
        }

        markerX = this.getLoopMarkerPos(MARKERTYPE.loopStart);
        if (Math.abs(x - markerX) < 5) {
          this.activeDragMarker = MARKERTYPE.loopStart;
          if (prevDragMarker !== this.activeDragMarker) this.refresh();
          return;
        }
      }

      if (prevDragMarker !== this.activeDragMarker) {
        this.refresh();
      }
    }
  }

  onResize() {
    this.waveformDisplay.setPosition(0, 0);
    this.waveformDisplay.setSize(this.width, this.height);

    this.scrollBar.setPosition(this.scrollBar.left, this.height - 18);
    if (this.zoomAmount > 1) {
      this.scrollBar.setSize(Math.floor(this.width / this.zoomAmount), 18);
    }
  }

  setInstrument(instrument?: Instrument) {
    this.currentInstrument = instrument ?? null;
    if (this.currentInstrument) {
      this.currentSampleData = this.currentInstrument.sample.data;
    } else {
      this.currentSampleData = null;
    }

    EventBus.trigger(EVENT.samplePropertyChange, {
      sampleLength: this.sampleLength,
      loopLength: instrument ? instrument.sample.loop.length : 0,
      internal: true,
    });

    if (this.ignoreInstrumentChange) return;

    this.isPlaying = false;
    this.zoom(1);
    this.rangeStart = -1;
    this.rangeEnd = -1;
    this.rangeLength = 0;
    this.refresh();
  }

  play(period: number, offset = 0) {
    if (this.zoomAmount > 1) return;

    this.playingOffset = offset;
    this.isPlaying = true;
    this.startPlayTime = new Date().getTime();
    this.sampleRate = Audio.getSampleRateForPeriod(period);
    this.refresh();
  }

  playSection(section: RANGE.range | RANGE.loop) {
    if (section === RANGE.range && this.rangeStart >= 0) {
      Input.keyboard.handleNoteOn(
        Input.keyboard.getPrevIndex(),
        undefined,
        this.rangeStart,
      );
    }
    if (section === RANGE.loop) {
      if (this.currentInstrument === null) {
        console.error("Cannot play loop section without an instrument loaded!");
        return;
      }
      Input.keyboard.handleNoteOn(
        Input.keyboard.getPrevIndex(),
        undefined,
        this.currentInstrument.sample.loop.start,
      );
    }
  }

  stop() {
    this.isPlaying = false;
    this.refresh();
  }

  zoom(amount: RANGE.range | RANGE.loop | RANGE.all | number) {
    let handled = false;
    if (amount === RANGE.range) {
      if (this.rangeLength) {
        // zoom to range
        this.zoomStart = this.rangeStart;
        this.zoomLength = this.rangeLength;
        this.zoomEnd = this.zoomStart + this.zoomLength;
        this.zoomAmount = this.sampleLength / this.zoomLength;

        const sWidth = this.width / this.zoomAmount;
        const sMax = this.width - sWidth - 2;
        this.scrollBar.setPosition(
          Math.floor(
            (this.zoomStart / (this.sampleLength - this.zoomLength)) * sMax,
          ),
          this.scrollBar.top,
        );
        handled = true;
      } else {
        // zoom to entire sample
        amount = RANGE.all;
      }
    }

    if (amount === RANGE.loop) {
      if (this.currentInstrument?.sample.loop.enabled) {
        this.zoomStart = this.currentInstrument.sample.loop.start;
        this.zoomLength = this.currentInstrument.sample.loop.length;
        this.zoomEnd = this.zoomStart + this.zoomLength;
        this.zoomAmount = this.sampleLength / this.zoomLength;

        const sWidth = this.width / this.zoomAmount;
        const sMax = this.width - sWidth - 2;
        this.scrollBar.setPosition(
          Math.floor(
            (this.zoomStart / (this.sampleLength - this.zoomLength)) * sMax,
          ),
          this.scrollBar.top,
        );
      }
      handled = true;
    }

    if (amount === RANGE.all || this.zoomAmount === 1) {
      this.zoomAmount = 1;
      this.zoomStart = 0;
    }

    if (!handled) {
      this.zoomAmount *= amount as number;
      this.zoomAmount = Math.max(this.zoomAmount, 1);

      this.zoomLength = Math.floor(this.sampleLength / this.zoomAmount);
      this.zoomEnd = this.zoomStart + this.zoomLength;
    }

    this.scrollBar.setSize(Math.floor(this.width / this.zoomAmount), 18);
    this.hasHorizontalScrollBar = this.zoomAmount > 1;

    if (this.hasHorizontalScrollBar) {
      if (this.zoomEnd > this.sampleLength) {
        this.zoomStart = this.sampleLength - this.zoomLength;
        this.zoomEnd = this.sampleLength;
        this.scrollBar.setPosition(
          this.width - this.scrollBar.width - 1,
          this.scrollBar.top,
        );
      }
    }
    this.waveformDisplay.refresh();
    this.refresh();
  }

  select(range: RANGE, start?: number, length?: number): void {
    if (this.currentSampleData === null) {
      console.error(
        "Cannot select a range in the loaded sample without a sample loaded!",
      );
      return;
    }
    switch (range) {
      case RANGE.all:
        this.rangeStart = 0;
        this.rangeEnd = this.currentSampleData.length;
        this.rangeLength = this.currentSampleData.length;
        this.refresh();
        break;
      case RANGE.none:
        this.rangeStart = -1;
        this.rangeEnd = -1;
        this.rangeLength = 0;
        this.refresh();
        break;
      case RANGE.loop:
        if (
          this.currentInstrument &&
          this.currentInstrument.sample.loop.length > 2
        ) {
          this.rangeStart = this.currentInstrument.sample.loop.start;
          this.rangeLength = this.currentInstrument.sample.loop.length;
          this.rangeEnd = this.rangeStart + this.rangeLength;
          this.refresh();
        }
        break;
      case RANGE.start:
        this.rangeStart = 0;
        this.rangeLength = this.rangeEnd - this.rangeStart;
        this.refresh();
        break;
      case RANGE.end:
        this.rangeEnd = this.currentSampleData.length;
        this.rangeLength = this.rangeEnd - this.rangeStart;
        this.refresh();
        break;
      case RANGE.range:
        this.rangeStart = start as number;
        this.rangeLength = length as number;
        this.rangeEnd = this.rangeStart + this.rangeLength;
        this.refresh();
        break;
    }

    EventBus.trigger(EVENT.samplePropertyChange, {
      rangeLength: this.rangeLength,
    });

    UI.setSelection(this.processSelection.bind(this));
  }

  render() {
    //   TODO: put wave on separate canvas
    if (this.needsRendering) {
      if (this.waveformDisplay.needsRendering) {
        console.log("updating wave");

        this.waveformDisplay.clearCanvas();

        this.waveformDisplay.ctx.fillStyle = "rgb(13, 19, 27)";
        this.waveformDisplay.ctx.fillRect(0, 0, this.width, this.height);
        this.waveformDisplay.ctx.strokeStyle = "rgba(120, 255, 50, 0.5)";

        if (this.background.width !== this.width)
          this.background.setSize(this.width, this.height);
        this.waveformDisplay.ctx.drawImage(
          this.background.render(true),
          0,
          0,
          this.width,
          this.height,
        );

        if (
          this.currentSampleData &&
          this.currentSampleData.length &&
          this.width
        ) {
          if (this.zoomAmount === 1) {
            this.zoomStart = 0;
            this.zoomEnd = this.sampleLength;
          }

          this.zoomLength = this.zoomEnd - this.zoomStart;

          // instrument 1 value each pixel
          const step = this.zoomLength / this.width;
          const mid = this.height / 2;
          this.waveformDisplay.ctx.beginPath();

          const maxHeight = this.height / 2 - 2;

          for (let i = 0; i < this.width; i++) {
            const index = Math.floor(i * step);
            const peak =
              this.currentSampleData[this.zoomStart + index] * -maxHeight;

            if (i === 0) {
              this.waveformDisplay.ctx.moveTo(i, mid + peak);
            } else {
              this.waveformDisplay.ctx.lineTo(i, mid + peak);
            }
          }
          this.waveformDisplay.ctx.stroke();
        }
        this.waveformDisplay.needsRendering = false;
      }
      this.ctx.drawImage(this.waveformDisplay.canvas, 0, 0);

      if (
        this.isPlaying &&
        this.startPlayTime !== null &&
        this.sampleLength &&
        this.sampleRate &&
        this.currentInstrument
      ) {
        const now = new Date().getTime();
        const delta = now - this.startPlayTime;
        let index = this.playingOffset + (this.sampleRate * delta) / 1000;

        if (
          this.currentInstrument.sample.loop.enabled &&
          index > this.currentInstrument.sample.loop.start
        ) {
          index =
            this.currentInstrument.sample.loop.start +
            ((index - this.currentInstrument.sample.loop.start) %
              this.currentInstrument.sample.loop.length);
          //isPlaying=false;
          const pos = (index / this.sampleLength) * this.width;
          this.ctx.fillStyle = "rgb(241, 162, 71)";
          this.ctx.fillRect(pos, 0, 1, this.height);
        } else {
          if (index > this.sampleLength) {
            this.isPlaying = false;
          } else {
            const pos = (index / this.sampleLength) * this.width;
            this.ctx.fillStyle = "rgb(241, 162, 71)";
            this.ctx.fillRect(pos, 0, 1, this.height);
          }
        }
      }

      if (
        this.currentInstrument &&
        (this.currentInstrument.sample.loop.length > 2 ||
          this.currentInstrument.sample.loop.enabled)
      ) {
        const color = this.currentInstrument.sample.loop.enabled
          ? "rgb(241, 220, 71)"
          : "rgba(150, 150, 150,0.7)";

        this.ctx.fillStyle = color;
        if (this.activeDragMarker === MARKERTYPE.loopStart)
          this.ctx.fillStyle = "white";
        let lineX = this.getLoopMarkerPos(MARKERTYPE.loopStart);
        this.ctx.fillRect(lineX, 0, 1, this.height - 1);
        this.ctx.fillRect(lineX - 4, 0, 4, 10);

        this.ctx.fillStyle = color;
        if (this.activeDragMarker === MARKERTYPE.loopEnd)
          this.ctx.fillStyle = "white";
        lineX = this.getLoopMarkerPos(MARKERTYPE.loopEnd);
        this.ctx.fillRect(lineX, 0, 1, this.height - 1);
        this.ctx.fillRect(lineX + 1, 0, 4, 10);
      }

      let rangeLineX1 = -1;
      let rangeLineX2 = -1;

      if (this.rangeEnd >= 0) {
        const color = "rgb(241, 131, 71)";
        this.ctx.fillStyle = color;
        if (this.activeDragMarker === MARKERTYPE.rangeEnd)
          this.ctx.fillStyle = "white";
        rangeLineX2 = this.getRangeMarkerPos(MARKERTYPE.rangeEnd);
        this.ctx.fillRect(rangeLineX2, 0, 1, this.height - 1);
        this.ctx.fillRect(rangeLineX2 + 1, 11, 4, 10);
      }

      if (this.rangeStart >= 0) {
        if (this.rangeStart < this.zoomStart) {
          rangeLineX1 = 0;
        } else {
          const color = "rgb(241, 131, 71)";
          this.ctx.fillStyle = color;
          if (this.activeDragMarker === MARKERTYPE.rangeStart)
            this.ctx.fillStyle = "white";
          rangeLineX1 = this.getRangeMarkerPos(MARKERTYPE.rangeStart);
          this.ctx.fillRect(rangeLineX1, 0, 1, this.height - 1);
          this.ctx.fillRect(rangeLineX1 - 4, 11, 4, 10);
        }

        if (this.rangeStart + this.rangeLength < this.zoomStart) {
          rangeLineX1 = rangeLineX2 = -1;
        }
      }

      if (rangeLineX1 !== rangeLineX2) {
        if (rangeLineX1 >= 0) {
          rangeLineX2 = Math.min(rangeLineX2, this.width);
          if (rangeLineX2 <= 0) rangeLineX2 = this.width;
        }
        this.ctx.fillStyle = "rgba(241, 162, 71,0.1)";
        this.ctx.fillRect(
          rangeLineX1,
          0,
          rangeLineX2 - rangeLineX1,
          this.height,
        );
      }

      if (this.hasHorizontalScrollBar) {
        this.scrollBar.render();
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

  private getLoopMarkerPos(type: MARKERTYPE): number {
    const loopStart = this.currentInstrument?.sample.loop.start || 0;

    if (type === MARKERTYPE.loopStart) {
      if (loopStart < this.zoomStart) return -10;
      if (loopStart > this.zoomEnd) return -10;
      this.zoomLength = this.zoomEnd - this.zoomStart;

      const lineX = Math.floor(
        ((loopStart - this.zoomStart) / this.zoomLength) * this.width,
      );
      return Math.max(this.zoomStart > 5 ? 0 : 5, lineX);
    }

    const point = loopStart + (this.currentInstrument?.sample.loop.length ?? 0);
    if (point < this.zoomStart) return -10;
    if (point > this.zoomEnd) return -10;

    const lineX = Math.floor(
      ((point - this.zoomStart) / this.zoomLength) * this.width,
    );
    return Math.min(
      lineX,
      this.width - (this.zoomEnd > this.sampleLength - 6 ? 6 : 0),
    );
  }

  private getRangeMarkerPos(type: MARKERTYPE): number {
    if (type === MARKERTYPE.rangeStart) {
      if (this.rangeStart < this.zoomStart) return -10;
      if (this.rangeStart > this.zoomEnd) return -10;
      this.zoomLength = this.zoomEnd - this.zoomStart;

      const lineX = Math.floor(
        ((this.rangeStart - this.zoomStart) / this.zoomLength) * this.width,
      );
      return Math.max(this.zoomStart > 5 ? 0 : 5, lineX);
    }

    const point = this.rangeStart + this.rangeLength;
    if (point < this.zoomStart) return -10;
    if (point > this.zoomEnd) return -10;

    const lineX = Math.floor(
      ((point - this.zoomStart) / this.zoomLength) * this.width,
    );
    return Math.min(
      lineX,
      this.width - (this.zoomEnd > this.sampleLength - 6 ? 6 : 0),
    );
  }

  private xToZoomX(x: number): -1 | undefined {
    if (x < this.zoomStart) return -1;
  }

  // effects
  private splitRange(useEmptyRange = false): SplitSample {
    if (this.currentSampleData === null) {
      console.error("No sample to split range from!");
      return { tail: [], range: [], head: [] };
    }
    if (this.rangeLength) {
      const tail = this.currentSampleData.slice(
        this.rangeStart + this.rangeLength,
      );
      const range = this.currentSampleData.slice(
        this.rangeStart,
        this.rangeStart + this.rangeLength,
      );
      const head = this.currentSampleData.slice(0, this.rangeStart);
      return { tail, range, head };
    } else {
      if (useEmptyRange) {
        const range: [] = [];
        const tail = this.currentSampleData.slice(this.rangeStart);
        const head = this.currentSampleData.slice(0, this.rangeStart);
        return { tail, range, head };
      } else {
        const tail: [] = [];
        const range = this.currentSampleData.slice(
          0,
          this.currentSampleData.length,
        );
        const head: [] = [];
        return { tail, range, head };
      }
    }
  }

  private joinRange(parts: SplitSample) {
    if (this.currentInstrument === null) {
      console.error("Meed a instrument loaded to join range into!");
      return;
    }
    this.currentSampleData = parts.head.concat(parts.range).concat(parts.tail);
    this.currentInstrument.sample.data = this.currentSampleData;
    this.currentInstrument.sample.length = this.currentSampleData.length;
    this.ignoreInstrumentChange = true;
    EventBus.trigger(
      EVENT.instrumentChange,
      Tracker.getCurrentInstrumentIndex(),
    );
    this.ignoreInstrumentChange = false;
    this.waveformDisplay.refresh();
    this.refresh();
  }

  private checkLoop() {
    if (this.currentInstrument === null) {
      console.error("Meed a instrument loaded to check its loop!");
      return;
    }
    let ls = this.currentInstrument.sample.loop.start;
    let ll = this.currentInstrument.sample.loop.length;
    const sl = this.currentInstrument.sample.length;

    if (ls < 0) ls = 0;
    if (ll < 0) ll = 0;

    if (ls + ll > sl) {
      if (ls > sl) {
        ls = sl;
      }
      ll = sl - ls;
    }

    if (
      ls !== this.currentInstrument.sample.loop.start ||
      ll !== this.currentInstrument.sample.loop.length
    ) {
      this.currentInstrument.sample.loop.start = ls;
      this.currentInstrument.sample.loop.length = ll;

      this.ignoreInstrumentChange = true;
      EventBus.trigger(
        EVENT.instrumentChange,
        Tracker.getCurrentInstrumentIndex(),
      );
      this.ignoreInstrumentChange = false;
      this.waveformDisplay.refresh();
      this.refresh();
    }
  }

  private restoreLoop(action: SampleUndo) {
    if (this.currentInstrument === null) {
      console.error("Meed a instrument loaded to restore its loop!");
      return;
    }
    if (action.loopStart || action.loopLength) {
      this.currentInstrument.sample.loop.start = action.loopStart || 0;
      this.currentInstrument.sample.loop.length = action.loopLength || 0;

      this.ignoreInstrumentChange = true;
      EventBus.trigger(
        EVENT.instrumentChange,
        Tracker.getCurrentInstrumentIndex(),
      );
      this.ignoreInstrumentChange = false;
    }
  }

  adjustVolume(amount: "max" | "fadein" | "fadeout" | number) {
    const data = this.splitRange();

    //console.error(currentSampleData.length,data.range.length);
    let update = false;

    const editAction = StateManager.createSampleUndo(
      SELECTION.REPLACE,
      this.rangeStart,
      this.rangeLength,
    );
    editAction.data = data.range.slice(0);
    editAction.name = "Adjust Volume";

    if (amount === "max") {
      let min = 0;
      let max = 0;
      for (let i = 0, len = data.range.length; i < len; i++) {
        min = Math.min(min, data.range[i]);
        max = Math.max(max, data.range[i]);
      }
      const scale = 1 / Math.max(max, -min);
      if (scale > 1) {
        for (let i = 0, len = data.range.length; i < len; i++) {
          data.range[i] = data.range[i] * scale;
        }
        update = true;
      }
    }

    if (amount === "fadein") {
      for (let i = 0, len = data.range.length - 1; i <= len; i++) {
        const scale = i / len;
        data.range[i] = data.range[i] * scale;
      }
      update = true;
    }
    if (amount === "fadeout") {
      for (let i = 0, len = data.range.length - 1; i <= len; i++) {
        const scale = 1 - i / len;
        data.range[i] = data.range[i] * scale;
      }
      update = true;
    }

    if (!update) {
      if (typeof amount === "number") {
        const scale = 1 + 1 / amount;
        for (let i = 0, len = data.range.length - 1; i <= len; i++) {
          data.range[i] = Math.min(Math.max(data.range[i] * scale, -1), 1);
        }
      }
      update = true;
    }

    if (update) {
      editAction.dataTo = data.range.slice(0);
      StateManager.registerEdit(editAction);
      this.joinRange(data);
    }
  }

  reverse() {
    const data = this.splitRange();

    const editAction = StateManager.createSampleUndo(
      SELECTION.REPLACE,
      this.rangeStart,
      this.rangeLength,
    );
    editAction.data = data.range.slice(0);
    editAction.name = "Reverse Sample";

    data.range = data.range.reverse();

    editAction.dataTo = data.range.slice(0);
    StateManager.registerEdit(editAction);

    this.joinRange(data);
  }

  invert() {
    const data = this.splitRange();

    const editAction = StateManager.createSampleUndo(
      SELECTION.REPLACE,
      this.rangeStart,
      this.rangeLength,
    );
    editAction.data = data.range.slice(0);
    editAction.name = "Reverse Sample";

    for (let i = 0, len = data.range.length - 1; i <= len; i++) {
      data.range[i] = -data.range[i];
    }

    editAction.dataTo = data.range.slice(0);
    StateManager.registerEdit(editAction);

    this.joinRange(data);
  }

  resample(direction: "up" | string) {
    if (this.currentInstrument === null) {
      console.error("Cannot resample without a sample loaded!");
      return;
    }
    const data = this.splitRange();
    const newRange = [];

    const editAction = StateManager.createSampleUndo(
      SELECTION.REPLACE,
      this.rangeStart,
      this.rangeLength,
    );
    editAction.data = data.range.slice(0);
    editAction.name = "Resample Sample";
    editAction.loopStart = this.currentInstrument.sample.loop.start;
    editAction.loopLength = this.currentInstrument.sample.loop.length;

    if (direction === "up") {
      for (let i = 0, len = data.range.length; i < len; i++) {
        // should we interpolate?
        newRange.push(data.range[i]);
        newRange.push(data.range[i]);
      }
      this.currentInstrument.sample.loop.start = Math.floor(
        this.currentInstrument.sample.loop.start * 2,
      );
      this.currentInstrument.sample.loop.length = Math.floor(
        this.currentInstrument.sample.loop.length * 2,
      );
      this.rangeStart = this.rangeStart * 2;
      this.rangeLength = this.rangeLength * 2;
      this.rangeEnd = this.rangeStart + this.rangeLength;
    } else {
      for (let i = 0, len = data.range.length; i < len; i += 2) {
        newRange.push(data.range[i]);
      }
      this.currentInstrument.sample.loop.start = Math.floor(
        this.currentInstrument.sample.loop.start / 2,
      );
      this.currentInstrument.sample.loop.length = Math.floor(
        this.currentInstrument.sample.loop.length / 2,
      );
      this.rangeStart = Math.floor(this.rangeStart / 2);
      this.rangeLength = Math.floor(this.rangeLength / 2);
      this.rangeEnd = this.rangeStart + this.rangeLength;
    }
    if (!Tracker.inFTMode()) {
      this.currentInstrument.sample.loop.start =
        this.currentInstrument.sample.loop.start -
        (this.currentInstrument.sample.loop.start % 2);
      this.currentInstrument.sample.loop.length =
        this.currentInstrument.sample.loop.length -
        (this.currentInstrument.sample.loop.length % 2);
    }
    data.range = newRange;

    editAction.dataTo = newRange.slice(0);
    StateManager.registerEdit(editAction);

    this.joinRange(data);
  }

  processSelection(state: SELECTION): false | undefined {
    if (!this.isVisible()) return;
    if (this.currentInstrument === null) {
      console.error("Need an instrument loaded to paste process selection!");
      return;
    }
    if (this.currentSampleData === null) {
      console.error("Need an sample loaded to process selection!");
      return;
    }
    switch (state) {
      case SELECTION.RESET:
        // keep selection persistent
        return false;
      case SELECTION.CLEAR:
        this.adjustVolume(0);
        break;
      case SELECTION.COPY:
      case SELECTION.CUT:
        if (this.rangeLength > 0) {
          const data = this.splitRange();
          this.rangeCache = data.range.slice(0);

          if (state === SELECTION.CUT) {
            const editAction = StateManager.createSampleUndo(
              SELECTION.CUT,
              this.rangeStart,
              this.rangeLength,
            );
            editAction.data = data.range.slice(0);
            editAction.name = "cut sample";
            editAction.loopStart = this.currentInstrument.sample.loop.start;
            editAction.loopLength = this.currentInstrument.sample.loop.length;
            StateManager.registerEdit(editAction);

            data.range = [];
            this.joinRange(data);
            this.checkLoop();
            this.rangeLength = 0;
            this.rangeEnd = this.rangeStart + this.rangeLength;
            EventBus.trigger(EVENT.samplePropertyChange, {
              rangeLength: this.rangeLength,
            });
            this.refresh();
          }
        }
        break;
      case SELECTION.DELETE:
        if (this.rangeLength > 0) {
          const data = this.splitRange();
          data.range = [];
          this.joinRange(data);
          this.rangeLength = 0;
          this.rangeEnd = this.rangeStart + this.rangeLength;
          EventBus.trigger(EVENT.samplePropertyChange, {
            rangeLength: this.rangeLength,
          });
          this.refresh();
        }
        break;
      case SELECTION.PASTE: {
        //console.error(rangeCache.length,rangeStart)
        const data = this.splitRange(true);

        if (this.rangeStart < 0) {
          // no selection - paste at end of sample
          this.rangeStart = this.currentSampleData.length;
        }

        const editAction = StateManager.createSampleUndo(
          SELECTION.PASTE,
          this.rangeStart,
          this.rangeCache.length,
        );
        editAction.name = "paste sample";
        editAction.data = data.range.slice(0);
        editAction.dataTo = this.rangeCache.slice(0);
        editAction.loopStart = this.currentInstrument.sample.loop.start;
        editAction.loopLength = this.currentInstrument.sample.loop.length;

        StateManager.registerEdit(editAction);

        if (this.rangeStart >= 0) {
          data.range = this.rangeCache;
        } else {
          data.tail = data.tail.concat(this.rangeCache);
        }
        this.joinRange(data);
        this.checkLoop();

        // paste clears the selection by default
        setTimeout(() => {
          this.select(RANGE.range, this.rangeStart, this.rangeCache.length);
        }, 10);

        break;
      }
      case SELECTION.POSITION:
        break;
    }
  }
}
