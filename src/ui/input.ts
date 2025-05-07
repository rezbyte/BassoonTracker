import EventBus from "../eventBus";
import Tracker, { Effects } from "../tracker";
import { FTNotes } from "../tracker";
import Editor from "../editor";
import { EVENT, KEYBOARDTABLE, NOTEPERIOD, OCTAVENOTES } from "../enum";
import { NoteInfo } from "../models/note";
import Audio from "../audio";
import Element from "./components/element";
import { canvas, UI } from "./main";
import App from "../app";
import Menu from "./components/menu";
import Settings from "../settings";

export interface Touch {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  globalX: number;
  globalY: number;
  globalStartX: number;
  globalStartY: number;
  UIobject: Element | undefined;
  isMeta: boolean;
}

export interface Drag extends Touch {
  deltaX: number;
  deltaY: number;
  dragX: number;
  dragY: number;
}

export interface TouchData {
  touches: (Touch | Drag)[];
  mouseWheels: number[];
  currentMouseX: number | undefined;
  currentMouseY: number | undefined;
  mouseMoved: number | undefined;
  isTouchDown: boolean;
}

export const DEFAULT_OCTAVE = 2;

class Input {
  private touchData: TouchData = {
    touches: [],
    mouseWheels: [],
    currentMouseX: undefined,
    currentMouseY: undefined,
    mouseMoved: undefined,
    isTouchDown: false,
  };
  private focusElement: Element | undefined;
  private currentEventTarget: Element | undefined;
  private resizeTimer = 0;
  private isTouched = false;
  private inputNotes: NoteInfo[] = []; // keep track of notes played through keyboard input
  private keyDown: Record<number, NoteInfo | false> = {};
  private _isMetaKeyDown = false;

  private currentOctave = DEFAULT_OCTAVE;
  private maxOctave = 3;
  private minOctave = 1;

  private prevHoverTarget: Element | undefined;
  private prevIndex = 13;

  constructor() {
    EventBus.on(EVENT.second, () => {
      // check for looping parameters on playing input notes
      if (!Audio.context) return;
      const time = Audio.context.currentTime;
      const delay = 2;

      this.inputNotes.forEach(function (note: NoteInfo) {
        if (note && note.time && note.scheduled) {
          if (note.scheduled.volume && note.volumeEnvelope) {
            if (time + delay >= note.scheduled.volume) {
              if (note.instrument) {
                const scheduledtime = note.instrument.scheduleEnvelopeLoop(
                  note.volumeEnvelope,
                  note.scheduled.volume,
                  2,
                );
                note.scheduled.volume += scheduledtime;
              }
            }
          }

          if (note.scheduled.panning && note.panningEnvelope) {
            if (time + delay >= note.scheduled.panning) {
              if (note.instrument) {
                const scheduledtime = note.instrument.scheduleEnvelopeLoop(
                  note.panningEnvelope,
                  note.scheduled.panning,
                  2,
                );
                note.scheduled.panning += scheduledtime;
              }
            }
          }

          if (note.scheduled.vibrato) {
            if (time + delay >= note.scheduled.vibrato) {
              if (note.instrument) {
                const scheduledtime = note.instrument.scheduleAutoVibrato(
                  note,
                  2,
                );
                note.scheduled.vibrato += scheduledtime;
              }
            }
          }
        }
      });
    });

    EventBus.on(EVENT.trackerModeChanged, () => {
      if (Tracker.inFTMode()) {
        this.maxOctave = 7;
        this.minOctave = 0;
        this.setCurrentOctave(this.currentOctave + 2);
      } else {
        this.maxOctave = 3;
        this.minOctave = 1;
        this.setCurrentOctave(
          Math.min(
            Math.max(this.currentOctave - 2, this.minOctave),
            this.maxOctave,
          ),
        );
      }
    });
  }

  init() {
    // mouse, touch and key handlers

    canvas.addEventListener("mousedown", handleTouchDown, false);
    canvas.addEventListener("mousemove", handleTouchMove, false);
    canvas.addEventListener("mouseup", handleTouchUp, false);
    canvas.addEventListener("mouseout", handleTouchOut, false);

    canvas.addEventListener("touchstart", handleTouchDown, false);
    canvas.addEventListener("touchmove", handleTouchMove, false);
    canvas.addEventListener("touchend", handleTouchUp, false);

    if (window.navigator.msPointerEnabled) {
      canvas.addEventListener("MSPointerDown", handleTouchDown, false);
      canvas.addEventListener("MSPointerMove", handleTouchMove, false);
      canvas.addEventListener("MSPointerEnd", handleTouchUp, false);
    }

    canvas.addEventListener("mousewheel", handleMouseWheel, false);
    canvas.addEventListener("DOMMouseScroll", handleMouseWheel, false);
    canvas.addEventListener("wheel", handleMouseWheel, false);

    window.addEventListener("keydown", handleKeyDown, false);
    window.addEventListener("keyup", handleKeyUp, false);

    canvas.addEventListener("dragenter", handleDragenter, false);
    canvas.addEventListener("dragover", handleDragover, false);
    canvas.addEventListener("drop", handleDrop, false);

    window.addEventListener("paste", handlePaste, false);
    window.addEventListener("copy", handleCopy, false);
    window.addEventListener("cut", handleCut, false);
    window.addEventListener("undo", handleUndo, false);
    window.addEventListener("delete", handleDelete, false);

    if (!App.isPlugin) window.addEventListener("resize", handleResize, false);

    const me = this;
    function handleTouchDown(event: TouchEvent | MouseEvent) {
      event.preventDefault();
      window.focus();

      if (!me.isTouched) {
        // first touch - init media on IOS and Android
        // note: audioContext.resume must be called on touchup, touchdown is too soon.

        if (typeof Audio !== "undefined" && Audio.playSilence) {
          if (Audio.context && Audio.context.state !== "suspended") {
            Audio.playSilence();
            me.isTouched = true;
          }
        }
      }

      if (
        window.TouchEvent &&
        event instanceof TouchEvent &&
        event.touches.length > 0
      ) {
        const touches = event.changedTouches;
        for (const touch of touches) {
          initTouch(touch.identifier.toString(), touch.pageX, touch.pageY);
        }
      } else if (event instanceof MouseEvent) {
        const touchIndex = me.getTouchIndex("notouch");
        if (touchIndex >= 0) me.touchData.touches.splice(touchIndex, 1);
        initTouch("notouch", event.pageX, event.pageY);
        //initTouch("notouch",event.clientX,event.clientY);
      }

      function initTouch(id: string, x: number, y: number) {
        me.touchData.isTouchDown = true;

        const rect = canvas.getBoundingClientRect();
        x -= rect.left + window.pageXOffset;
        y -= rect.top + window.pageYOffset;

        me.currentEventTarget = UI.getModalElement();
        if (me.currentEventTarget) {
          me.currentEventTarget.eventX = x;
          me.currentEventTarget.eventY = y;
        } else {
          me.currentEventTarget = UI.getEventElement(x, y);
        }

        if (
          me.currentEventTarget &&
          me.focusElement &&
          me.focusElement.deActivate &&
          me.focusElement.name !== me.currentEventTarget.name
        ) {
          me.focusElement.deActivate(me.currentEventTarget);
        }

        const touchX = me.currentEventTarget
          ? (me.currentEventTarget.eventX ?? x)
          : x;
        const touchY = me.currentEventTarget
          ? (me.currentEventTarget.eventY ?? y)
          : y;

        const thisTouch: Touch = {
          id: id,
          x: touchX,
          y: touchY,
          startX: touchX,
          startY: touchY,
          globalX: x,
          globalY: y,
          globalStartX: x,
          globalStartY: y,
          UIobject: me.currentEventTarget,

          isMeta:
            event.shiftKey || event.metaKey || event.ctrlKey || event.altKey,
        };

        me.touchData.touches.push(thisTouch);

        if (thisTouch.UIobject) {
          if (thisTouch.UIobject.onDragStart)
            thisTouch.UIobject.onDragStart(thisTouch);
          if (thisTouch.UIobject.onDown) thisTouch.UIobject.onDown(thisTouch);

          //console.log(thisTouch.UIobject);
        }
      }
    }

    function handleTouchMove(event: TouchEvent | MouseEvent) {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();

      if (
        window.TouchEvent &&
        event instanceof TouchEvent &&
        event.touches.length > 0
      ) {
        const touches = event.changedTouches;

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          updateTouch(
            me.getTouchIndex(touch.identifier.toString()),
            touch.pageX - rect.left,
            touch.pageY - rect.top,
          );
        }
      } else if (event instanceof MouseEvent) {
        const _x = event.pageX - rect.left;
        const _y = event.pageY - rect.top;
        updateTouch(me.getTouchIndex("notouch"), _x, _y);
        me.touchData.currentMouseX = _x;
        me.touchData.currentMouseY = _y;
        me.touchData.mouseMoved = new Date().getTime();

        if (Settings.useHover) {
          const hoverEventTarget = UI.getEventElement(_x, _y);
          if (hoverEventTarget && hoverEventTarget.onHover)
            hoverEventTarget.onHover(me.touchData);

          if (me.prevHoverTarget && me.prevHoverTarget != hoverEventTarget) {
            if (me.prevHoverTarget.onHoverExit)
              me.prevHoverTarget.onHoverExit(me.touchData, hoverEventTarget);
          }
          me.prevHoverTarget = hoverEventTarget;
        }
      }

      function updateTouch(touchIndex: number, x: number, y: number) {
        if (touchIndex >= 0) {
          const thisTouch = me.touchData.touches[touchIndex] as Drag;

          thisTouch.globalX = x - window.pageXOffset;
          thisTouch.globalY = y - window.pageYOffset;

          thisTouch.deltaX = thisTouch.globalX - thisTouch.globalStartX;
          thisTouch.deltaY = thisTouch.globalY - thisTouch.globalStartY;

          thisTouch.x = thisTouch.startX + thisTouch.deltaX;
          thisTouch.y = thisTouch.startY + thisTouch.deltaY;

          me.touchData.touches.splice(touchIndex, 1, thisTouch);

          if (me.touchData.isTouchDown && thisTouch.UIobject) {
            if (thisTouch.UIobject.onDrag) {
              thisTouch.dragX = x;
              thisTouch.dragY = y;
              thisTouch.UIobject.onDrag(thisTouch);
            }
          }
        }
      }
    }

    function handleTouchUp(event: TouchEvent | MouseEvent) {
      if (!me.isTouched) {
        if (Audio && Audio.checkState) Audio.checkState();
      }

      me.touchData.isTouchDown = false;

      if (event && window.TouchEvent && event instanceof TouchEvent) {
        const touches = event.changedTouches;

        for (let i = 0; i < touches.length; i++) {
          const touch = touches[i];
          endTouch(me.getTouchIndex(touch.identifier.toString()));
        }

        if (event.touches.length === 0) {
          resetInput();
        }
      } else {
        endTouch(me.getTouchIndex("notouch"));
        resetInput();
      }

      function endTouch(touchIndex: number) {
        if (touchIndex >= 0) {
          const thisTouch = me.touchData.touches[touchIndex];
          const deltaX = thisTouch.startX - thisTouch.x;
          const deltaY = thisTouch.startY - thisTouch.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          let clearSelection = true;
          if (thisTouch.UIobject) {
            const elm = thisTouch.UIobject;
            if (elm instanceof Menu && elm.keepSelection)
              clearSelection = false;

            if (distance < 8 && elm.onClick) {
              elm.onClick(thisTouch);
            }

            if (elm.onTouchUp) elm.onTouchUp(thisTouch);
          }

          if (clearSelection && distance < 8) UI.clearSelection();

          me.touchData.touches.splice(touchIndex, 1);
        }
      }

      function resetInput() {
        //Input.isDown(false);
        //Input.isUp(false);
        //Input.isLeft(false);
        //Input.isRight(false);
      }
    }

    function handleTouchOut(event: MouseEvent) {
      if (me.touchData.isTouchDown) {
        handleTouchUp(event);
      }
    }

    function handleKeyDown(event: KeyboardEvent & { keyIdentifier?: string }) {
      event.preventDefault();

      const keyboardTable =
        KEYBOARDTABLE[Settings.keyboardTable] || KEYBOARDTABLE.azerty;

      const keyCode = event.keyCode;
      let key = event.key;
      //console.error(event.code);
      //TODO use event.code as this is device independent.

      const meta = {
        shift: event.shiftKey,
        control: event.ctrlKey,
        alt: event.altKey,
        command: event.metaKey,
      };
      me._isMetaKeyDown =
        meta.command || meta.control || meta.alt || meta.shift;

      if (!key && event.keyIdentifier) {
        // safari on osX ...
        let id = event.keyIdentifier;
        id = id.replace("U+", "");
        key = String.fromCharCode(parseInt(id, 16)).toLowerCase();
      }

      //console.log(keyCode);
      //ole.log(prevHoverTarget);
      if (me.focusElement && me.focusElement.onKeyDown) {
        const handled = me.focusElement.onKeyDown(keyCode, event);
        if (handled) return;
      }

      switch (keyCode) {
        case 8: // backspace
          if (Tracker.getIsRecording()) {
            if (me._isMetaKeyDown) {
              Editor.removeNote();
              Tracker.moveCurrentPatternPos(-1);
            } else {
              const pos = Editor.getCurrentTrackPosition();
              if (pos === 0) {
                Editor.putNote(0, 0);
              } else {
                if (Tracker.inFTMode() && (pos === 3 || pos === 4)) {
                  Editor.putNoteParam(pos, -1);
                } else {
                  Editor.putNoteParam(pos, 0);
                }
              }
              Tracker.moveCurrentPatternPos(1);
            }
            return;
          } else {
            Tracker.playPatternStep(Editor.getCurrentTrackPosition());
            Tracker.moveCurrentPatternPos(-1);
            // on Mac this should probably be delete ...
          }

          return;
        case 9: // tab
          event.stopPropagation();
          event.preventDefault();
          if (me._isMetaKeyDown) {
            Editor.moveCursorPosition(-Editor.getStepsPerTrack());
          } else {
            Editor.moveCursorPosition(Editor.getStepsPerTrack());
          }
          return;
        case 13: // enter
          if (Tracker.getIsRecording() && me._isMetaKeyDown) {
            Editor.insertNote();
            Tracker.moveCurrentPatternPos(1);
          } else {
            Tracker.togglePlay();
          }
          return;
        case 16: // shift
          //Tracker.playPattern();
          break;
        case 27: // esc
          UI.clearSelection();
          break;
        case 32: // space
          Tracker.toggleRecord();
          return;
        case 33: {
          // pageup
          let step = Math.floor(Tracker.getPatternLength() / 4);
          if (step === 0) step = 1;
          let pos = Math.floor(Tracker.getCurrentPatternPos() / step) * step;
          if (Tracker.getCurrentPatternPos() === pos) pos -= step;
          if (pos < 0) pos = 0;
          Tracker.setCurrentPatternPos(pos);
          return;
        }
        case 34: {
          // pagedown
          let step = Math.floor(Tracker.getPatternLength() / 4);
          if (step === 0) step = 1;
          let pos = Math.ceil(Tracker.getCurrentPatternPos() / step) * step;
          if (Tracker.getCurrentPatternPos() === pos) pos += step;
          if (pos >= Tracker.getPatternLength() - 1)
            pos = Tracker.getPatternLength() - 1;
          Tracker.setCurrentPatternPos(pos);
          return;
        }
        case 35: // end
          Tracker.setCurrentPatternPos(Tracker.getPatternLength() - 1);
          return;
        case 36: // home
          Tracker.setCurrentPatternPos(0);
          return;
        case 37: // left
          Editor.moveCursorPosition(-1);
          return;
        case 38: // up
          Tracker.moveCurrentPatternPos(-1);
          return;
        case 39: // right
          Editor.moveCursorPosition(1);
          return;
        case 40: // down
          Tracker.moveCurrentPatternPos(1);
          return;
        case 46: {
          // delete
          if (Tracker.getIsRecording()) {
            const pos = Editor.getCurrentTrackPosition();
            if (pos === 0) {
              Editor.putNote(0, 0);
            } else {
              Editor.putNoteParam(pos, 0);
            }
            Tracker.moveCurrentPatternPos(1);
          }
          return;
        }
        case 112: //F1
        case 113: //F2
        case 114: //F3
        case 115: //F4
        case 116: //F5
        case 117: //F6
        case 118: //F7
          me.setCurrentOctave(keyCode - 111);
          return;
        case 119: //F8
        case 120: //F9
        case 121: //F10
        case 122: //F11
        case 123: //F12
          return;
        case 221: // ¨^
          return;
      }

      if (key && keyCode > 40 && keyCode < 230) {
        if (me._isMetaKeyDown && keyCode >= 65 && keyCode <= 90) {
          // A-Z with shift key
          //console.log("meta " + keyCode);

          event.stopPropagation();
          event.preventDefault();

          switch (keyCode) {
            case 65: //a - select all
              EventBus.trigger(EVENT.commandSelectAll);
              return;
            case 67: //c - copy
              UI.copySelection(true);
              return;
            case 86: //v - paste
              UI.pasteSelection(true);
              return;
            case 88: //x - cut
              UI.cutSelection(true);
              return;
            case 89: //y - redo
              EventBus.trigger(EVENT.commandRedo);
              return;
            case 90: //z - undo
              EventBus.trigger(EVENT.commandUndo);
              return;
          }

          return;
        }

        let index = -1;
        const keyboardNote = keyboardTable[key];

        if (typeof keyboardNote === "number") {
          index = me.currentOctave * 12 + keyboardNote;
          if (keyboardNote === 0) index = 0;
        }

        me.handleNoteOn(index, key);
      }
    }

    function handleKeyUp(event: KeyboardEvent & { keyIdentifier?: string }) {
      let key = event.key;

      if (!key && event.keyIdentifier) {
        // safari on osX ...
        let id = event.keyIdentifier;
        id = id.replace("U+", "");
        key = String.fromCharCode(parseInt(id, 16)).toLowerCase();
      }

      const keyCode = event.keyCode;

      if (isMetaKeyCode(keyCode)) me._isMetaKeyDown = false;

      if (key && keyCode > 40 && keyCode < 200) {
        const keyboardTable =
          KEYBOARDTABLE[Settings.keyboardTable] || KEYBOARDTABLE.azerty;
        const keyboardNote = keyboardTable[key];

        if (typeof keyboardNote === "number") {
          return me.handleNoteOff(me.currentOctave * 12 + keyboardNote);
        }
      }
    }

    function handleMouseWheel(event: WheelEvent) {
      event.preventDefault();
      const x = me.touchData.currentMouseX;
      const y = me.touchData.currentMouseY;
      if (x && y) {
        const target = UI.getEventElement(x, y);

        if (target && target.onMouseWheel) {
          const deltaY: number = event.deltaY || -event.detail;
          //const deltaX = event.deltaX || 0;

          me.touchData.mouseWheels.unshift(deltaY);
          if (me.touchData.mouseWheels.length > 10)
            me.touchData.mouseWheels.pop();

          target.onMouseWheel(me.touchData);
        }
      }
    }

    function handleDragenter(e: DragEvent) {
      e.stopPropagation();
      e.preventDefault();
    }

    function handleDragover(e: DragEvent) {
      e.stopPropagation();
      e.preventDefault();
    }

    function handleDrop(e: DragEvent) {
      e.stopPropagation();
      e.preventDefault();

      const dt = e.dataTransfer;
      if (dt == null) return;

      const files = dt.files;

      Tracker.handleUpload(files);
    }

    function handleResize() {
      if (!App.isPlugin) {
        // throttle resize events - resizing is expensive as all the canvas cache needs to be regenerated
        clearTimeout(me.resizeTimer);
        me.resizeTimer = setTimeout(function () {
          UI.setSize(window.innerWidth, window.innerHeight);
        }, 100);
      }
    }

    function handlePaste() {
      UI.pasteSelection(true);
    }

    function handleCopy() {
      UI.copySelection(true);
    }

    function handleCut() {
      console.error("cut");
      UI.cutSelection(true);
    }
    function handleUndo() {
      console.error("undo");
    }

    function handleDelete() {
      console.error("delete");
    }

    function isMetaKeyCode(keyCode: number): boolean {
      return (
        keyCode === 16 ||
        keyCode === 17 ||
        keyCode === 18 ||
        keyCode === 91 ||
        keyCode === 93
      );
    }

    handleResize();
  }

  getTouchIndex(id: string): number {
    for (let i = 0; i < this.touchData.touches.length; i++) {
      if (this.touchData.touches[i].id === id) {
        return i;
      }
    }
    return -1;
  }

  setFocusElement(element: Element) {
    const name = element.name || element.type;
    if (this.focusElement) {
      const fName = this.focusElement.name || this.focusElement.type;
      if (fName === name) {
        console.log(name + " already has focus");
        return;
      } else {
        if (this.focusElement.deActivate) this.focusElement.deActivate();
      }
    }
    this.focusElement = element;
    if (name) {
      console.log("setting focus to " + name);
    } else {
      console.warn(
        "Warning: setting focus to an unnamed element can cause unexpected results",
      );
    }
    //if (element.activate) element.activate();
  }
  clearFocusElement(element?: Element) {
    if (element) {
      if (!element.name)
        console.warn(
          "Please specify a name for the target object when removing focus",
        );
      const name = element.name || element.type;
      if (name) console.log("removing focus from " + name);
      if (element.deActivate) element.deActivate();
      if (this.focusElement && this.focusElement.name === element.name) {
        this.focusElement = undefined;
      }
    } else {
      if (this.focusElement && this.focusElement.deActivate)
        this.focusElement.deActivate();
      this.focusElement = undefined;
    }
  }
  getFocusElement(): Element | undefined {
    return this.focusElement;
  }

  private clearInputNote() {
    // stops the oldest input note
    if (this.inputNotes.length) {
      const note = this.inputNotes.shift();
      if (note && note.source) {
        try {
          note.source.stop();
        } catch (e) {}
      }
    }
  }

  clearInputNotes() {
    while (this.inputNotes.length) this.clearInputNote();
  }

  getCurrentOctave(): number {
    return this.currentOctave;
  }

  setCurrentOctave(value: number) {
    if (value <= this.maxOctave && value >= this.minOctave) {
      this.currentOctave = value;
      EventBus.trigger(EVENT.octaveChanged, this.currentOctave);
    }
  }

  // handles the input for an indexed note
  handleNoteOn(index: number, key?: string, offset?: number, volume?: number) {
    let note: { period: number; index: number | null } | null = null;
    let doPlay = true;

    if (index >= 0) {
      this.prevIndex = index;
      UI.clearSelection();

      const noteOctave = Math.floor((index - 1) / 12) + 1;
      const noteIndex = ((index - 1) % 12) + 1;
      const baseNote = OCTAVENOTES[noteIndex];

      if (baseNote) {
        if (Tracker.inFTMode()) {
          // get FT note
          if (baseNote.name === "OFF") {
            note = {
              period: 1,
              index: 0,
            };
            doPlay = false;
          } else {
            const fNote = FTNotes[index];
            if (fNote) {
              note = {
                period: fNote.period,
                index: index,
              };
            }
          }
        } else {
          const noteName = baseNote.name + (noteOctave - 1);
          const notePeriod = NOTEPERIOD[noteName];
          if (notePeriod) {
            note = {
              period: notePeriod.period,
              index: null,
            };
          }
        }
      }
    }

    if (Tracker.getIsRecording()) {
      if (Editor.getCurrentTrackPosition() > 0) {
        // cursorPosition is not on note
        doPlay = false;
        let re = /[0-9A-Fa-f]/g;
        let value = -1;
        key = key || "";

        if (re.test(key)) {
          value = parseInt(key, 16);
        } else {
          if (Tracker.inFTMode() && Editor.getCurrentTrackPosition() === 5) {
            // Special Fasttracker commands // should we allow all keys ?
            re = /[0-9A-Za-z]/g;
            if (re.test(key)) value = parseInt(key, 36);
          }
        }

        if (Tracker.inFTMode() && Editor.getCurrentTrackPosition() === 3) {
          // Special Fasttracker volume commands
          value = -1;
          switch (key) {
            case "0":
              value = 0;
              break;
            case "1":
              value = 1;
              break;
            case "2":
              value = 2;
              break;
            case "3":
              value = 3;
              break;
            case "4":
              value = 4;
              break;
            case "-":
              value = 5;
              break;
            case "+":
              value = 6;
              break;
            case "d":
            case "D":
              value = 7;
              break;
            case "u":
            case "U":
              value = 8;
              break;
            case "s":
            case "S":
              value = 9;
              break;
            case "v":
            case "V":
              value = 10;
              break;
            case "p":
            case "P":
              value = 11;
              break;
            case "<":
              value = 12;
              break;
            case ">":
              value = 13;
              break;
            case "M":
              value = 14;
              break;
          }
        }

        if (value > 255) value = -1;

        if (value >= 0) {
          Editor.putNoteParam(Editor.getCurrentTrackPosition(), value);
          Tracker.moveCurrentPatternPos(1);
        }
      } else {
        if (this.keyDown[index]) return;
        if (note) {
          Editor.putNote(
            Tracker.getCurrentInstrumentIndex(),
            note.period,
            note.index ?? undefined,
            volume,
          );

          if (Tracker.isPlaying()) {
            //doPlay = false;
          } else {
            Tracker.moveCurrentPatternPos(1);
          }
        }
      }
    }

    if (doPlay && note) {
      if (this.keyDown[index]) return;

      const instrument = Tracker.getCurrentInstrument();

      if (instrument) {
        if (note.index !== null) {
          instrument.setSampleForNoteIndex(note.index);
          if (instrument.sample.relativeNote) {
            note.index += instrument.sample.relativeNote;
            const ftNote = FTNotes[note.index];
            if (ftNote) note.period = ftNote.period;
          }
        }

        Audio.checkState();
        let effects: Effects | undefined = undefined;

        if (offset) {
          effects = {
            offset: {
              value: offset,
            },
          };
        }

        // volume is 100 based here ... TODO: align volume to or 64 or 100 everywhere;
        if (typeof volume === "number") volume = (100 * volume) / 64;
        const playedNote = instrument.play(
          note.index ?? 0,
          note.period,
          volume,
          undefined,
          effects,
        );
        if (playedNote === null) {
          console.error("Failed to play note from input!");
          return;
        }
        playedNote.instrument = instrument;
        playedNote.isKey = true;

        this.keyDown[index] = playedNote;
        this.inputNotes.push(playedNote);

        if (playedNote.scheduled && playedNote.scheduled.vibrato) {
          const scheduledtime = instrument.scheduleAutoVibrato(playedNote, 2);
          playedNote.scheduled.vibrato += scheduledtime;
        }

        if (this.inputNotes.length > 64) {
          this.clearInputNote();
        }
        EventBus.trigger(EVENT.pianoNoteOn, index);
      }
    }
  }

  handleNoteOff(index: number, register = false) {
    if (
      !Settings.sustainKeyboardNotes &&
      this.keyDown[index] &&
      this.keyDown[index].source &&
      Audio.context
    ) {
      EventBus.trigger(EVENT.pianoNoteOff, index);
      try {
        if (this.keyDown[index].instrument) {
          this.keyDown[index].instrument.noteOff(
            Audio.context.currentTime,
            this.keyDown[index],
          );
        } else {
          this.keyDown[index].source.stop();
        }
      } catch (e) {}
    }
    this.keyDown[index] = false;

    if (
      register &&
      Tracker.inFTMode() &&
      Tracker.getIsRecording() &&
      Tracker.isPlaying()
    ) {
      // register Note-Off commands coming from midi
      Editor.putNoteParam(5, 20);
      Editor.putNoteParam(7, 1);
    }
  }

  isMetaKeyDown(): boolean {
    return this._isMetaKeyDown;
  }

  getPrevIndex(): number {
    return this.prevIndex;
  }
}

export default new Input();
