import { EDITACTION, EVENT, SELECTION, VIEW } from "../enum";
import EventBus from "../eventBus";
import Note from "../models/note";
import Tracker from "../tracker";
import { UI } from "./main";

export interface Control<T> {
  setValue: (v: T, internal?: boolean) => void,
  getValue: () => T,
  getPrevValue: () => T,
  name?: string
}

interface ActionData {
  position: {
    row: number,
    track: number
  }
  from?: Note,
  to?: Note
}

interface Action<T> {
  target: EDITACTION | Control<T>,
  type: EDITACTION,
  id: number | string,
  name?: string
}

interface NoteUndo extends Action<number> {
  target: EDITACTION.PATTERN,
  type: EDITACTION.NOTE,
  id: number,
  data: ActionData[]
}

interface TrackUndo extends Action<number> {
  target: EDITACTION.PATTERN,
  type: EDITACTION.TRACK,
  id: number,
  data: ActionData[]
}

interface PatternUndo extends Action<number> {
  target: EDITACTION.PATTERN,
  type: EDITACTION.PATTERN,
  id: number,
  data: ActionData[]
}

interface ValueUndo<T> extends Action<T> {
  target: Control<T>,
  type: EDITACTION.VALUE,
  id: number,
  from: T,
  to: T,
  instrument?: number
}

export interface SampleUndo extends Action<number> {
  data: number[],
  dataTo: number[],
  loopStart: number | null,
  loopLength: number | null,
  target: EDITACTION.SAMPLE,
  type: EDITACTION.DATA,
  id: string,
  instrument: number,
  from: number,
  to: number,
  action: SELECTION,
  redo?: boolean,
  undo?: boolean
}

interface RangeUndo extends Action<number> {
  target: EDITACTION.PATTERN,
  type: EDITACTION.RANGE,
  id: number,
  data: ActionData[],
}

export type UndoWithValue = NoteUndo | TrackUndo | PatternUndo | RangeUndo;
type UndoAction<T> = NoteUndo | TrackUndo | PatternUndo | ValueUndo<T> | SampleUndo | RangeUndo
type ActionList<T> = UndoAction<T>[]

class StateManager {
  private history: {undo: ActionList<any>, redo: ActionList<any>} = { undo: [], redo: [] };
  private locked: boolean = false;

  contructor() {
    EventBus.on(EVENT.commandUndo, this.undo);
    EventBus.on(EVENT.commandRedo, this.redo);
  }

  registerEdit<T>(action: UndoAction<T>) {
    if (this.locked) {
      // we're already in a UNDO/REDO action, or in a init state action
      return;
    }

    let doRegister = true;

    if (this.history.undo.length) {
      switch (action.type) {
        case EDITACTION.VALUE:
          const lastAction = this.history.undo[this.history.undo.length - 1];
          if (
            lastAction &&
            lastAction.type === action.type &&
            lastAction.id === action.id
          ) {
            doRegister = false;
            lastAction.to = action.to;
            console.log("Ignoring sequential Undo, to: " + action.to);
          } else {
            console.log("Add Value Undo");
          }
          break;
      }
    }

    if (doRegister) {
      const maxHistory = 100;
      this.history.undo.push(action);
      if (this.history.undo.length > maxHistory) this.history.undo.shift();
      this.history.redo = [];
    }
  };

  undo() {
    const action = this.history.undo.pop();
    if (action) {
      this.locked = true;

      if (
        "instrument" in action &&
        action.instrument !== undefined &&
        action.instrument !== Tracker.getCurrentInstrumentIndex()
      )
        Tracker.setCurrentInstrumentIndex(action.instrument);

      switch (action.type) {
        case EDITACTION.NOTE:
        case EDITACTION.RANGE:
        case EDITACTION.TRACK:
        case EDITACTION.PATTERN:
          const song = Tracker.getSong();
          if (song == null) return;
          const patternData = song.patterns[action.id];
          if (action.id !== Tracker.getCurrentPattern()) {
            Tracker.setCurrentPattern(action.id);
          }
          action.data.forEach(function (item) {
            //console.error(item);
            if (patternData) {
              const note =
                patternData[item.position.row][item.position.track] ||
                new Note();
              note.populate(item.from);
            }
          });
          EventBus.trigger(EVENT.patternChange, action.id);
          break;
        case EDITACTION.VALUE:
          action.target.setValue(action.from);
          break;
        case EDITACTION.DATA:
          if (action.target === EDITACTION.SAMPLE) {
            action.undo = true;
            action.redo = false;
            EventBus.trigger(EVENT.showView, VIEW.sampleEditor);
            EventBus.trigger(EVENT.commandProcessSample, action);
          }
          break;
        default:
          console.warn("Unknown UNDO action");
          console.warn(action);
      }

      this.history.redo.push(action);
      this.locked = false;

      if (action.name) {
        UI.setStatus("Undo " + action.name);
      }
    }
  };

  redo() {
    const action = this.history.redo.pop();
    if (action) {
      this.locked = true;

      if (
        "instrument" in action &&
        action.instrument !== undefined &&
        action.instrument !== Tracker.getCurrentInstrumentIndex()
      )
        Tracker.setCurrentInstrumentIndex(action.instrument);

      switch (action.type) {
        case EDITACTION.NOTE:
        case EDITACTION.RANGE:
        case EDITACTION.TRACK:
        case EDITACTION.PATTERN:
          const song = Tracker.getSong();
          if (song == null) {
            Tracker.new();
            if (song == null) {
              console.error("StateManager tried to initalize a new song to redo a pattern unsuccessfuly!")
              return;
            }
          }
          const patternData = song.patterns[action.id];
          if (action.id !== Tracker.getCurrentPattern()) {
            Tracker.setCurrentPattern(action.id);
          }
          action.data.forEach(function (item) {
            if (patternData) {
              const note =
                patternData[item.position.row][item.position.track] ||
                new Note();
              item.to ? note.populate(item.to) : note.clear();
            }
          });
          EventBus.trigger(EVENT.patternChange, action.id);
          break;
        case EDITACTION.VALUE:
          action.target.setValue(action.to);
          break;
        case EDITACTION.DATA:
          if (action.target === EDITACTION.SAMPLE) {
            action.undo = false;
            action.redo = true;
            EventBus.trigger(EVENT.showView, VIEW.sampleEditor);
            EventBus.trigger(EVENT.commandProcessSample, action);
          }
          break;
        default:
          console.warn("Unknown UNDO action");
          console.warn(action);
      }

      this.history.undo.push(action);
      this.locked = false;

      if (action.name) {
        UI.setStatus("Redo " + action.name);
      }
    }
  };

  createNoteUndo(pattern: number, track: number, row: number, note: Note): NoteUndo {
    return {
      target: EDITACTION.PATTERN,
      type: EDITACTION.NOTE,
      id: pattern,
      data: [
        {
          position: {
            track: track,
            row: row,
          },
          from: note.duplicate(),
        },
      ],
    };
  };

  createTrackUndo(pattern: number): TrackUndo {
    return {
      target: EDITACTION.PATTERN,
      type: EDITACTION.TRACK,
      id: pattern,
      data: [],
    };
  };

  createPatternUndo(pattern: number): PatternUndo {
    return {
      target: EDITACTION.PATTERN,
      type: EDITACTION.PATTERN,
      id: pattern,
      data: [],
    };
  };

  createRangeUndo(pattern: number): RangeUndo {
    return {
      target: EDITACTION.PATTERN,
      type: EDITACTION.RANGE,
      id: pattern,
      data: [],
    };
  };

  createValueUndo<T extends string | number>(control: Control<T>): ValueUndo<T> {
    return {
      target: control,
      type: EDITACTION.VALUE,
      id: Number(control.name),
      from: control.getPrevValue(),
      to: control.getValue(),
    };
  };

  createSampleUndo(action: SELECTION, rangeStart?: number, rangeLength?: number): SampleUndo {
    return {
      data: [],
      dataTo: [],
      loopStart: null,
      loopLength: null,
      target: EDITACTION.SAMPLE,
      type: EDITACTION.DATA,
      id: "sample" + Tracker.getCurrentInstrumentIndex(),
      instrument: Tracker.getCurrentInstrumentIndex(),
      from: rangeStart || 0,
      to: rangeLength || 0,
      action: action,
    };
  };

  addNote(actionList: UndoWithValue, track: number, row: number, note: Note) {
    const noteInfo: ActionData = {
      position: {
        track: track,
        row: row,
      },
      from: note ? note.duplicate() : undefined,
    };
    actionList.data.push(noteInfo);
    return noteInfo;
  };

  getHistory() {
    return history;
  };

  clear() {
    this.history = { undo: [], redo: [] };
  };

  lock() {
    this.locked = true;
  };

  unLock() {
    this.locked = false;
  };

  canUndo(): boolean {
    return this.history.undo.length > 0;
  };

  canRedo(): boolean {
    return this.history.redo.length > 0;
  };

  getUndoLabel(): string {
    let name = "";
    if (this.history.undo.length) {
      name = this.history.undo[this.history.undo.length - 1].name || "";
    }
    return "Undo " + name;
  };

  getRedoLabel(): string {
    let name = "";
    if (this.history.redo.length) {
      name = this.history.redo[this.history.redo.length - 1].name || "";
    }
    return "Redo " + name;
  };
};

export default new StateManager();
