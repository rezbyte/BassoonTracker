import { Effects, FTNotes, FTPeriods } from "../tracker";
import { WaveFormGenerator } from "../audio/waveFormFunction";
import Instrument from "./instrument";

export interface Scheduled {
  volume?: number;
  panning?: number;
  ticks?: number;
  vibrato?: number;
  vibratoFunction?: WaveFormGenerator;
}

export interface NoteInfo {
  source: AudioBufferSourceNode;
  volume: GainNode;
  panning?: StereoPannerNode;
  volumeEnvelope?: GainNode;
  panningEnvelope?: StereoPannerNode;
  volumeFadeOut: GainNode;
  startVolume: number;
  currentVolume: number;
  startPeriod: number;
  basePeriod: number;
  noteIndex: number;
  startPlaybackRate: number;
  sampleRate: number;
  instrumentIndex: number;
  effects?: Effects;
  track?: number;
  time: number;
  isKey?: boolean;
  scheduled?: Scheduled;
  instrument?: Instrument;
  currentPeriod: number;
  //note: Note,
  vibratoTimer: number;
  startVibratoTimer?: number;
  tremoloTimer: number;
  hasAutoVibrato: boolean;
  resetPeriodOnStep?: boolean;
}

interface NoteProperties {
  instrument: number;
  period: number;
  effect: number;
  param: number;
  volumeEffect?: number;
  note?: number;
  index?: number;
}
export default class Note {
  period = 0;
  index = 0;
  effect = 0;
  instrument = 0;
  param = 0;
  volumeEffect = 0;
  note = 0;

  setPeriod(period: number) {
    this.period = period;
    this.index = FTPeriods[period] || 0;
  }

  setIndex(index: number) {
    this.index = index;
    const ftNote = FTNotes[index];
    if (ftNote) {
      this.period = ftNote.modPeriod || ftNote.period;
      if (this.period === 1) this.period = 0;
    } else {
      console.warn("No note for index " + index);
      this.period = 0;
    }
  }

  clear() {
    this.instrument = 0;
    this.period = 0;
    this.effect = 0;
    this.param = 0;
    this.index = 0;
    this.volumeEffect = 0;
  }

  duplicate(): Note {
    const newNote = new Note();
    newNote.populate({
      instrument: this.instrument,
      period: this.period,
      effect: this.effect,
      param: this.param,
      volumeEffect: this.volumeEffect,
      note: this.index,
    });
    return newNote;
  }

  populate(data?: NoteProperties) {
    this.instrument = data?.instrument || 0;
    this.period = data?.period || 0;
    this.effect = data?.effect || 0;
    this.param = data?.param || 0;
    this.volumeEffect = data?.volumeEffect || 0;
    this.index = data?.note || data?.index || 0;
  }
}
