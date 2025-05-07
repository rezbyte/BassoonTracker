import Audio from "../audio";
import Tracker, { Effects } from "../tracker";
import { FTNotes } from "../tracker";
import EventBus from "../eventBus";
import { EVENT } from "../enum";
import Sample from "./sample";
import { NoteInfo, Scheduled } from "./note";
import waveFormFunction, { WaveFormGenerator } from "../audio/waveFormFunction";

export interface Envelope {
  type: number;
  raw: number[];
  enabled: boolean;
  points: [number, number][];
  count: number;
  loop: boolean;
  loopStartPoint: number;
  loopEndPoint: number;
  sustain: boolean;
  sustainPoint: number;
}

interface NoteEnvelopes {
  volume?: GainNode;
  panning?: StereoPannerNode;
  scheduled: Scheduled;
}

export default class Instrument {
  type: number = 0; // type = "sample";
  name = "";
  instrumentIndex = 0;
  sampleIndex = -1;
  fadeout = 128;
  data = [];
  samples = [new Sample()];
  sample = this.samples[0];
  pointer: number | undefined;

  // TODO: Check adding type did not break fasttracker import
  volumeEnvelope: Envelope = {
    type: 0,
    raw: [],
    enabled: false,
    points: [
      [0, 48],
      [10, 64],
      [20, 40],
      [30, 18],
      [40, 28],
      [50, 18],
    ],
    count: 6,
    loop: false,
    loopStartPoint: 0,
    loopEndPoint: 0,
    sustain: false,
    sustainPoint: 0,
  };
  panningEnvelope: Envelope = {
    type: 0,
    raw: [],
    enabled: false,
    points: [
      [0, 32],
      [20, 40],
      [40, 24],
      [60, 32],
      [80, 32],
    ],
    count: 5,
    loop: false,
    loopStartPoint: 0,
    loopEndPoint: 0,
    sustain: false,
    sustainPoint: 0,
  };
  vibrato = { type: 0, depth: 0, rate: 0, sweep: 0 };

  sampleNumberForNotes: number[] = [];
  realLen: number | undefined;
  filePosition: number = 0;
  headerSize: number = 0;
  numberOfSamples: number = 1;
  sampleHeaderSize: number = 0;
  reserved: number = 0;

  play(
    noteIndex: number,
    notePeriod: number,
    volume?: number,
    track?: number,
    trackEffects?: Effects,
    time?: number,
  ): NoteInfo | null {
    if (Tracker.inFTMode()) {
      notePeriod = this.getPeriodForNote(noteIndex);
    }
    return Audio.playSample(
      this.instrumentIndex,
      notePeriod,
      volume,
      track,
      trackEffects,
      time,
      noteIndex,
    );
  }

  noteOn(time: number): NoteEnvelopes {
    let volumeEnvelope;
    let panningEnvelope;
    const scheduled: Scheduled = {
      volume: undefined,
      panning: undefined,
      ticks: undefined,
      vibrato: undefined,
      vibratoFunction: undefined,
    };

    if (this.volumeEnvelope.enabled) {
      volumeEnvelope = Audio.context.createGain();
      const envelope = this.volumeEnvelope;
      const scheduledTime = this.processEnvelop(envelope, volumeEnvelope, time);
      if (scheduledTime) scheduled.volume = time + scheduledTime;
    }

    if (this.panningEnvelope.enabled && Audio.canUsePanning) {
      panningEnvelope = Audio.context.createStereoPanner();
      const envelope = this.panningEnvelope;
      const scheduledTime = this.processEnvelop(
        envelope,
        panningEnvelope,
        time,
      );
      if (scheduledTime) scheduled.panning = time + scheduledTime;
    }

    if (this.vibrato.rate && this.vibrato.depth) {
      scheduled.ticks = 0;
      scheduled.vibrato = time;
      scheduled.vibratoFunction = this.getAutoVibratoFunction();
    }

    return {
      volume: volumeEnvelope,
      panning: panningEnvelope,
      scheduled: scheduled,
    };
  }

  noteOff(time: number, noteInfo: NoteInfo): 0 | 100 {
    //if (!noteInfo || !noteInfo.volume) return;

    function cancelScheduledValues() {
      // Note: we should cancel Volume and Panning scheduling independently ...
      noteInfo.volume.gain.cancelScheduledValues(time);
      noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);

      if (noteInfo.volumeEnvelope)
        noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
      if (noteInfo.panningEnvelope)
        noteInfo.panningEnvelope.pan.cancelScheduledValues(time);
      noteInfo.scheduled = undefined;
    }

    if (Tracker.inFTMode()) {
      const tickTime = Tracker.getProperties().tickTime;

      if (this.volumeEnvelope.enabled) {
        if (this.volumeEnvelope.sustain && noteInfo.volumeEnvelope) {
          cancelScheduledValues();
          const startPoint =
            this.volumeEnvelope.points[this.volumeEnvelope.sustainPoint];
          const timeOffset = startPoint ? startPoint[0] * tickTime : 0;
          for (
            let p = this.volumeEnvelope.sustainPoint;
            p < this.volumeEnvelope.count;
            p++
          ) {
            const point = this.volumeEnvelope.points[p];
            if (point)
              noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(
                point[1] / 64,
                time + point[0] * tickTime - timeOffset,
              );
          }
        }

        if (this.fadeout) {
          const fadeOutTime = ((65536 / this.fadeout) * tickTime) / 2;
          noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(
            0,
            time + fadeOutTime,
          );
        }
      } else {
        cancelScheduledValues();
        noteInfo.volumeFadeOut.gain.linearRampToValueAtTime(0, time + 0.1);
      }

      if (
        this.panningEnvelope.enabled &&
        Audio.canUsePanning &&
        noteInfo.panningEnvelope
      ) {
        const startPoint =
          this.panningEnvelope.points[this.panningEnvelope.sustainPoint];
        const timeOffset = startPoint ? startPoint[0] * tickTime : 0;
        for (
          let p = this.panningEnvelope.sustainPoint;
          p < this.panningEnvelope.count;
          p++
        ) {
          const point = this.panningEnvelope.points[p];
          if (point)
            noteInfo.panningEnvelope.pan.linearRampToValueAtTime(
              (point[1] - 32) / 32,
              time + point[0] * tickTime - timeOffset,
            );
        }
      }

      return 100;
    } else {
      cancelScheduledValues();
      if (noteInfo.isKey && noteInfo.volume) {
        noteInfo.volume.gain.linearRampToValueAtTime(0, time + 0.5);
      } // TODO: Check whether moving noteOff outside else is fine
      return 0;
    }
  }

  private processEnvelop(
    envelope: Envelope,
    audioNode: GainNode | StereoPannerNode,
    time: number,
  ): number | false {
    const tickTime = Tracker.getProperties().tickTime;
    let maxPoint = envelope.sustain
      ? envelope.sustainPoint + 1
      : envelope.count;

    // some XM files seem to have loop points outside the range.
    // e.g. springmellow_p_ii.xm - instrument 15;
    envelope.loopStartPoint = Math.min(
      envelope.loopStartPoint,
      envelope.count - 1,
    );
    envelope.loopEndPoint = Math.min(envelope.loopEndPoint, envelope.count - 1);

    let doLoop =
      envelope.loop && envelope.loopStartPoint < envelope.loopEndPoint;
    if (envelope.sustain && envelope.sustainPoint <= envelope.loopStartPoint)
      doLoop = false;

    if (doLoop) maxPoint = envelope.loopEndPoint + 1;
    let scheduledTime = 0;

    let audioParam;
    let center;
    let max;
    if (audioNode instanceof GainNode) {
      // volume
      audioParam = audioNode.gain;
      center = 0;
      max = 64;
    } else {
      // panning node
      audioParam = audioNode.pan;
      center = 32;
      max = 32;
    }

    audioParam.setValueAtTime((envelope.points[0][1] - center) / max, time);

    for (let p = 1; p < maxPoint; p++) {
      const point = envelope.points[p];
      const lastX = point[0];
      scheduledTime = lastX * tickTime;
      audioParam.linearRampToValueAtTime(
        (point[1] - center) / max,
        time + scheduledTime,
      );
    }

    if (doLoop) {
      return this.scheduleEnvelopeLoop(audioNode, time, 2, scheduledTime);
    }

    return false;
  }

  scheduleEnvelopeLoop(
    audioNode: GainNode | StereoPannerNode,
    startTime: number,
    seconds: number,
    scheduledTime: number = 0,
  ): number {
    // note - this is not 100% accurate when the ticktime would change during the scheduled ahead time
    const tickTime = Tracker.getProperties().tickTime;

    let envelope;
    let audioParam;
    let center;
    let max;
    if (audioNode instanceof GainNode) {
      // volume
      envelope = this.volumeEnvelope;
      audioParam = audioNode.gain;
      center = 0;
      max = 64;
    } else {
      // panning node
      envelope = this.panningEnvelope;
      audioParam = audioNode.pan;
      center = 32;
      max = 32;
    }
    let point = envelope.points[envelope.loopStartPoint];
    const loopStartX = point[0];

    const doLoop =
      envelope.loop && envelope.loopStartPoint < envelope.loopEndPoint;
    if (doLoop) {
      while (scheduledTime < seconds) {
        const startScheduledTime = scheduledTime;
        for (let p = envelope.loopStartPoint; p <= envelope.loopEndPoint; p++) {
          point = envelope.points[p];
          scheduledTime =
            startScheduledTime + (point[0] - loopStartX) * tickTime;
          audioParam.linearRampToValueAtTime(
            (point[1] - center) / max,
            startTime + scheduledTime,
          );
        }
      }
    }

    return scheduledTime;
  }

  scheduleAutoVibrato(note: NoteInfo, seconds: number): number {
    // this is only used for keyboard notes as in the player the main playback timer is used for this
    if (!note.scheduled) {
      throw "Attempted to apply vibrato to unscheduled note!";
    }
    let scheduledTime = 0;
    note.scheduled.ticks = note.scheduled.ticks || 0;
    const tickTime = Tracker.getProperties().tickTime;

    const freq = -this.vibrato.rate / 40;
    let amp = this.vibrato.depth / 8;
    if (Tracker.useLinearFrequency) amp *= 4;

    let currentPeriod;
    let vibratoFunction: WaveFormGenerator = waveFormFunction.sine;
    let time = 0;
    let tick = 0;
    if (note.source) {
      currentPeriod = note.startPeriod;
      vibratoFunction = note.scheduled.vibratoFunction || waveFormFunction.sine;
      time = note.scheduled.vibrato || Audio.context.currentTime;
    }

    while (scheduledTime < seconds) {
      scheduledTime += tickTime;

      if (currentPeriod) {
        let sweepAmp = 1;
        if (this.vibrato.sweep && note.scheduled.ticks < this.vibrato.sweep) {
          sweepAmp =
            1 -
            (this.vibrato.sweep - note.scheduled.ticks) / this.vibrato.sweep;
        }

        const targetPeriod = vibratoFunction(
          currentPeriod,
          note.scheduled.ticks,
          freq,
          amp * sweepAmp,
        );
        Tracker.setPeriodAtTime(note, targetPeriod, time + tick * tickTime);
        tick++;
      }
      note.scheduled.ticks++;
    }

    return scheduledTime;
  }

  getAutoVibratoFunction(): WaveFormGenerator {
    switch (this.vibrato.type) {
      case 1:
        return waveFormFunction.square;
      case 2:
        return waveFormFunction.saw;
      case 3:
        return waveFormFunction.sawInverse;
    }
    return waveFormFunction.sine;
  }

  resetVolume(time: number, noteInfo: NoteInfo) {
    if (noteInfo.volumeFadeOut) {
      noteInfo.volumeFadeOut.gain.cancelScheduledValues(time);
      noteInfo.volumeFadeOut.gain.setValueAtTime(1, time);
    }

    if (noteInfo.volumeEnvelope) {
      noteInfo.volumeEnvelope.gain.cancelScheduledValues(time);
      const tickTime = Tracker.getProperties().tickTime;

      const maxPoint = this.volumeEnvelope.sustain
        ? this.volumeEnvelope.sustainPoint + 1
        : this.volumeEnvelope.count;
      noteInfo.volumeEnvelope.gain.setValueAtTime(
        this.volumeEnvelope.points[0][1] / 64,
        time,
      );
      for (let p = 1; p < maxPoint; p++) {
        const point = this.volumeEnvelope.points[p];
        noteInfo.volumeEnvelope.gain.linearRampToValueAtTime(
          point[1] / 64,
          time + point[0] * tickTime,
        );
      }
    }
  }

  getFineTune() {
    return Tracker.inFTMode() ? this.sample.finetuneX : this.sample.finetune;
  }

  setFineTune(finetune: number) {
    if (Tracker.inFTMode()) {
      this.sample.finetuneX = finetune;
      this.sample.finetune = finetune >> 4;
    } else {
      if (finetune > 7) finetune = finetune - 16;
      this.sample.finetune = finetune;
      this.sample.finetuneX = finetune << 4;
    }
  }

  // in FT mode
  getPeriodForNote(noteIndex: number, withFineTune?: boolean): number {
    let result = 0;

    if (Tracker.useLinearFrequency) {
      result = 7680 - (noteIndex - 1) * 64;
      if (withFineTune) result -= this.getFineTune() / 2;
    } else {
      result = FTNotes[noteIndex].period;
      if (withFineTune && this.getFineTune()) {
        result = Audio.getFineTuneForNote(noteIndex, this.getFineTune());
      }
    }

    return result;
  }

  setSampleForNoteIndex(noteIndex: number) {
    const sampleIndex = this.sampleNumberForNotes[noteIndex - 1];
    if (sampleIndex !== this.sampleIndex && typeof sampleIndex === "number") {
      this.setSampleIndex(sampleIndex);
    }
  }

  setSampleIndex(index: number) {
    if (this.sampleIndex !== index) {
      this.sample = this.samples[index];
      this.sampleIndex = index;

      EventBus.trigger(EVENT.sampleIndexChange, this.instrumentIndex);
    }
  }

  hasSamples(): boolean {
    for (let i = 0, max = this.samples.length; i < max; i++) {
      if (this.samples[i].length) return true;
    }
    return false;
  }

  hasVibrato(): boolean {
    return this.vibrato.rate > 0 && this.vibrato.depth > 0;
  }
}
