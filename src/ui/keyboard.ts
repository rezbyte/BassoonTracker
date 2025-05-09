import EventBus from "../eventBus";
import type Element from "./components/element";
import Tracker, { type Effects } from "../tracker";
import { FTNotes } from "../tracker";
import Audio from "../audio";
import Editor from "../editor";
import { EVENT, KEYBOARDTABLE, NOTEPERIOD, OCTAVENOTES } from "../enum";
import type { NoteInfo } from "../models/note";
import { UI } from "./main";
import Settings from "../settings";
import type Octave from "./octave";

export default class KeyboardInput {
  private readonly focusElementGetter: () => Element | undefined;
  private readonly octaveHandler: Octave;
  private readonly inputNotes: NoteInfo[] = []; // keep track of notes played through keyboard input
  private readonly keyDown: Record<number, NoteInfo | false> = {};
  private _isMetaKeyDown = false;
  private prevIndex = 13;

  constructor(
    focusElementGetter: () => Element | undefined,
    octaveHandler: Octave,
  ) {
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
    this.focusElementGetter = focusElementGetter;
    this.octaveHandler = octaveHandler;
  }

  addEventHandlers() {
    const handleKeyDown = this.handleKeyDown.bind(this);
    const handleKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener("keydown", handleKeyDown, false);
    window.addEventListener("keyup", handleKeyUp, false);
  }

  private handleKeyDown(event: KeyboardEvent & { keyIdentifier?: string }) {
    event.preventDefault();

    const keyCode = event.keyCode;
    const key = KeyboardInput.getKey(event);
    //console.error(event.code);
    //TODO use event.code as this is device independent.

    const meta = {
      shift: event.shiftKey,
      control: event.ctrlKey,
      alt: event.altKey,
      command: event.metaKey,
    };
    this._isMetaKeyDown =
      meta.command || meta.control || meta.alt || meta.shift;

    //console.log(keyCode);
    //ole.log(prevHoverTarget);
    const focusElement = this.focusElementGetter();
    if (focusElement && focusElement.onKeyDown) {
      const handled = focusElement.onKeyDown(keyCode, event);
      if (handled) return;
    }

    switch (keyCode) {
      case 8: // backspace
        if (Tracker.getIsRecording()) {
          if (this._isMetaKeyDown) {
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
        if (this._isMetaKeyDown) {
          Editor.moveCursorPosition(-Editor.getStepsPerTrack());
        } else {
          Editor.moveCursorPosition(Editor.getStepsPerTrack());
        }
        return;
      case 13: // enter
        if (Tracker.getIsRecording() && this._isMetaKeyDown) {
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
        this.octaveHandler.setCurrentOctave(keyCode - 111);
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
      if (this._isMetaKeyDown && keyCode >= 65 && keyCode <= 90) {
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
      const keyboardTable =
        KEYBOARDTABLE[Settings.keyboardTable] || KEYBOARDTABLE.azerty;
      const keyboardNote = keyboardTable[key];

      if (typeof keyboardNote === "number") {
        index = this.octaveHandler.getCurrentOctave() * 12 + keyboardNote;
        if (keyboardNote === 0) index = 0;
      }

      this.handleNoteOn(index, key);
    }
  }

  private handleKeyUp(event: KeyboardEvent & { keyIdentifier?: string }) {
    const key = KeyboardInput.getKey(event);
    const keyCode = event.keyCode;

    if (KeyboardInput.isMetaKeyCode(keyCode)) this._isMetaKeyDown = false;

    if (key && keyCode > 40 && keyCode < 200) {
      const keyboardTable =
        KEYBOARDTABLE[Settings.keyboardTable] || KEYBOARDTABLE.azerty;
      const keyboardNote = keyboardTable[key];

      if (typeof keyboardNote === "number") {
        return this.handleNoteOff(
          this.octaveHandler.getCurrentOctave() * 12 + keyboardNote,
        );
      }
    }
  }

  private static getKey(
    event: KeyboardEvent & { keyIdentifier?: string },
  ): string {
    if (!event.key && event.keyIdentifier) {
      // safari on osX ...
      const id = event.keyIdentifier.replace("U+", "");
      return String.fromCharCode(parseInt(id, 16)).toLowerCase();
    }
    return event.key;
  }

  private static isMetaKeyCode(keyCode: number): boolean {
    return (
      keyCode === 16 ||
      keyCode === 17 ||
      keyCode === 18 ||
      keyCode === 91 ||
      keyCode === 93
    );
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
      } catch (e) {
        // Ignore errors
      }
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

  private clearInputNote() {
    // stops the oldest input note
    if (this.inputNotes.length) {
      const note = this.inputNotes.shift();
      if (note && note.source) {
        try {
          note.source.stop();
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }

  clearInputNotes() {
    while (this.inputNotes.length) this.clearInputNote();
  }

  isMetaKeyDown(): boolean {
    return this._isMetaKeyDown;
  }

  getPrevIndex(): number {
    return this.prevIndex;
  }
}
