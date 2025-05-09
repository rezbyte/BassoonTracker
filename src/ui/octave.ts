import EventBus from "../eventBus";
import Tracker from "../tracker";
import { EVENT } from "../enum";

const DEFAULT_OCTAVE = 2;

export default class Octave {
  private currentOctave = DEFAULT_OCTAVE;
  private maxOctave = 3;
  private minOctave = 1;

  constructor() {
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

  getMaxOctave(): number {
    return this.maxOctave;
  }

  getMinOctave(): number {
    return this.minOctave;
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
}
