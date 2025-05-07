import {
  EVENT,
  STEREOSEPARATION,
  NotePeriod,
  NOTEPERIOD,
  NOTEOFF,
  PC_FREQUENCY_HALF,
  AMIGA_PALFREQUENCY_HALF,
} from "./enum";
import Tracker, {
  periodNoteTable,
  FTNotes,
  noteNames,
  Effects,
  periodFinetuneTable,
  nameNoteTable,
} from "./tracker";
import { saveAs } from "file-saver";
import EventBus, { TrackStateChangeValue } from "./eventBus";
import { NoteInfo } from "./models/note";
import Editor from "./editor";
import FilterChain from "./audio/filterChain";
import Settings from "./settings";

export interface Filters {
  volume: boolean;
  panning: boolean;
  high: boolean;
  mid: boolean;
  low: boolean;
  lowPass: boolean;
  reverb: boolean;
  distortion: boolean;
}

class Audio {
  private currentContext: BaseAudioContext = new AudioContext();
  private offlineContext: OfflineAudioContext | undefined;
  private onlineContext: AudioContext | undefined;
  private masterVolume: GainNode | undefined;
  private cutOffVolume: GainNode | undefined;
  private lowPassfilter: BiquadFilterNode | undefined;
  private filterChains: FilterChain[] = [];
  private cutOff = true;
  private isRecording = false;
  private mediaRecorder: MediaRecorder | undefined;
  private recordingChunks: Blob[] = [];
  private currentStereoSeparation = STEREOSEPARATION.BALANCED;
  private lastMasterVolume = 0;
  private usePanning = false;
  private hasUI: boolean = Editor !== undefined;
  private scheduledNotes: GainNode[][] = [[], [], []];
  private scheduledNotesBucket = 0;
  private prevSampleRate = 4143.569;
  private filters: Filters = {
    volume: true,
    panning: true,
    high: true,
    mid: true,
    low: true,
    lowPass: true,
    reverb: true,
    distortion: false,
  };
  private isRendering = false;

  createAudioConnections(
    audioContext: BaseAudioContext,
    destination?: AudioNode,
  ) {
    this.cutOffVolume = audioContext.createGain();
    this.cutOffVolume.gain.setValueAtTime(1, 0);

    // Haas effect stereo expander
    const useStereoExpander = false;
    if (useStereoExpander) {
      const splitter = audioContext.createChannelSplitter(2);
      const merger = audioContext.createChannelMerger(2);
      const haasDelay = audioContext.createDelay(1);
      this.cutOffVolume.connect(splitter);
      splitter.connect(haasDelay, 0);
      haasDelay.connect(merger, 0, 0);
      splitter.connect(merger, 1, 1);
      merger.connect(destination || audioContext.destination);
      // TODO Figure out what this was for
      //window.haasDelay = haasDelay;
    } else {
      this.cutOffVolume.connect(destination || audioContext.destination);
    }

    this.masterVolume = audioContext.createGain();
    this.masterVolume.connect(this.cutOffVolume);
    this.setMasterVolume(1);

    this.lowPassfilter = audioContext.createBiquadFilter();
    this.lowPassfilter.type = "lowpass";
    this.lowPassfilter.frequency.setValueAtTime(20000, 0);

    this.lowPassfilter.connect(this.masterVolume);
  }

  init(audioContext?: BaseAudioContext, destination?: AudioNode) {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    window.OfflineAudioContext =
      window.OfflineAudioContext || window.webkitOfflineAudioContext;

    audioContext = audioContext || this.currentContext;
    this.currentContext = audioContext;
    if (!audioContext) return;

    this.usePanning = !!this.currentContext.createStereoPanner;
    if (!this.usePanning) {
      console.warn(
        "Warning: Your browser does not support StereoPanners ... all mods will be played in mono!",
      );
    }
    this.hasUI = typeof Editor !== "undefined";

    this.createAudioConnections(audioContext, destination);

    const numberOfTracks = Tracker.getTrackCount();
    this.filterChains = [];
    for (let i = 0; i < numberOfTracks; i++) this.addFilterChain();

    if (!this.isRendering) {
      EventBus.on(EVENT.trackStateChange, (state: TrackStateChangeValue) => {
        if (
          typeof state.track != "undefined" &&
          this.filterChains[state.track]
        ) {
          this.filterChains[state.track].volumeValue(state.mute ? 0 : 70);
        }
      });

      const setStereoSeparation = this.setStereoSeparation.bind(this);
      const currentStereoSeparation = this.currentStereoSeparation;
      EventBus.on(EVENT.trackCountChange, (trackCount: number) => {
        for (let i = this.filterChains.length; i < trackCount; i++)
          this.addFilterChain();
        EventBus.trigger(EVENT.filterChainCountChange, trackCount);
        setStereoSeparation(currentStereoSeparation);
      });

      EventBus.on(EVENT.trackerModeChanged, () => {
        setStereoSeparation();
      });
    }
  }

  private addFilterChain() {
    if (this.lowPassfilter == null) {
      console.error("Need the low pass filter to add a filter chain!");
      return;
    }
    const filterChain = new FilterChain(this.filters);
    filterChain.output().connect(this.lowPassfilter);
    this.filterChains.push(filterChain);
  }

  getFilterChain(index: number): FilterChain {
    return this.filterChains[index];
  }

  get context() {
    return this.currentContext;
  }

  get canUsePanning() {
    return this.usePanning;
  }

  get hasVolume() {
    return !this.cutOff;
  }

  getCutOffVolume(): GainNode | undefined {
    return this.cutOffVolume;
  }

  enable() {
    if (this.cutOffVolume == null) {
      console.error("Cannot enable audio without cutOffVolume initialized!");
      return;
    }
    this.cutOffVolume.gain.setValueAtTime(1, 0);
    this.cutOff = false;
  }

  disable() {
    if (this.cutOffVolume) this.cutOffVolume.gain.setValueAtTime(0, 0);
    this.cutOff = true;

    let totalNotes = 0;
    this.scheduledNotes.forEach((bucket, index) => {
      totalNotes += bucket.length;
      bucket.forEach((volume) => {
        volume.gain.cancelScheduledValues(0);
        volume.gain.setValueAtTime(0, 0);
      });
      this.scheduledNotes[index] = [];
    });

    if (totalNotes) console.log(totalNotes + " cleared");
  }

  checkState() {
    if (this.currentContext) {
      if (
        this.currentContext.state === "suspended" &&
        Audio.isAudioContext(this.currentContext)
      ) {
        console.warn("Audio context is suspended - trying to resume");
        this.currentContext.resume();
      }
    }
  }

  private static isAudioContext(
    context: BaseAudioContext,
  ): context is AudioContext {
    return (
      (context as AudioContext).resume != null &&
      (context as AudioContext).createMediaStreamDestination != null
    );
  }

  playSample(
    index: number,
    period: number,
    volume: number | undefined,
    track: number | undefined,
    effects: Effects | undefined,
    time: number | undefined,
    noteIndex: number,
  ): NoteInfo | null {
    let audioContext: BaseAudioContext;
    if (this.isRendering) {
      if (this.offlineContext == null) {
        console.error(
          "Offline context is missing when playing a sample while rendering! Has rendering been started?",
        );
        return null;
      }
      audioContext = this.offlineContext;
    } else {
      audioContext = this.currentContext;
      this.enable();
    }

    period = period || 428; // C-3
    if (typeof track === "undefined")
      track = this.hasUI ? Editor.getCurrentTrack() : 0;
    time = time || this.currentContext.currentTime;

    if (noteIndex === NOTEOFF) {
      volume = 0; // note off
    }

    const instrument = Tracker.getInstrument(index);
    const basePeriod = period;
    let volumeEnvelope;
    let panningEnvelope;
    let scheduled;
    let pan = 0;

    if (instrument) {
      let sampleBuffer;
      let offset = 0;
      let sampleLength = 0;

      volume =
        typeof volume === "undefined"
          ? (100 * instrument.sample.volume) / 64
          : volume;

      pan = (instrument.sample.panning || 0) / 128;

      // apply finetune
      if (Tracker.inFTMode()) {
        if (Tracker.useLinearFrequency) {
          period -= instrument.getFineTune() / 2;
        } else {
          if (instrument.getFineTune()) {
            period = this.getFineTuneForNote(
              noteIndex,
              instrument.getFineTune(),
            );
          }
        }
      } else {
        // protracker frequency
        if (instrument.getFineTune()) {
          period = this.getFineTuneForPeriod(period, instrument.getFineTune());
        }
      }

      const sampleRate = this.getSampleRateForPeriod(period);
      let initialPlaybackRate = 1;

      if (instrument.sample.data.length) {
        sampleLength = instrument.sample.data.length;
        if (effects && effects.offset) {
          if (effects.offset.value >= sampleLength)
            effects.offset.value = sampleLength - 1;
          offset = effects.offset.value / audioContext.sampleRate; // in seconds
        }
        // note - on safari you can't set a different samplerate?
        sampleBuffer = audioContext.createBuffer(
          1,
          sampleLength,
          audioContext.sampleRate,
        );
        initialPlaybackRate = sampleRate / audioContext.sampleRate;
      } else {
        // empty samples are often used to cut of the previous instrument
        sampleBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
        offset = 0;
      }
      const buffering = sampleBuffer.getChannelData(0);
      for (let i = 0; i < sampleLength; i++) {
        buffering[i] = instrument.sample.data[i];
      }

      this.prevSampleRate = sampleRate;
      const source = audioContext.createBufferSource();
      source.buffer = sampleBuffer;

      const volumeGain = audioContext.createGain();
      volumeGain.gain.value = volume / 100;
      volumeGain.gain.setValueAtTime(volume / 100, time);

      if (instrument.sample.loop.enabled && instrument.sample.loop.length > 2) {
        if (!Settings.unrollLoops) {
          source.loop = true;
          // in seconds ...
          source.loopStart =
            instrument.sample.loop.start / audioContext.sampleRate;
          source.loopEnd =
            (instrument.sample.loop.start + instrument.sample.loop.length) /
            audioContext.sampleRate;
          //audioContext.sampleRate = samples/second
        }
      }

      if (
        instrument.volumeEnvelope.enabled ||
        instrument.panningEnvelope.enabled ||
        instrument.hasVibrato()
      ) {
        const envelopes = instrument.noteOn(time);
        let target: AudioNode = source;

        if (envelopes.volume) {
          volumeEnvelope = envelopes.volume;
          source.connect(volumeEnvelope);
          target = volumeEnvelope;
        }

        if (envelopes.panning) {
          panningEnvelope = envelopes.panning;
          target.connect(panningEnvelope);
          target = panningEnvelope;
        }

        scheduled = envelopes.scheduled;

        target.connect(volumeGain);
      } else {
        source.connect(volumeGain);
      }

      const volumeFadeOut = this.currentContext.createGain();
      volumeFadeOut.gain.setValueAtTime(0, time);
      volumeFadeOut.gain.linearRampToValueAtTime(1, time + 0.01);
      volumeGain.connect(volumeFadeOut);

      let panning;
      if (this.usePanning) {
        panning = this.currentContext.createStereoPanner();
        panning.pan.setValueAtTime(pan, time);
        volumeFadeOut.connect(panning);
        panning.connect(this.filterChains[track].input());
      } else {
        /* 
				Note: a pannernode would work too but this doesn't have a "setPositionInTime" method
				Making it a bit useless
				panning = this.context.createPanner();
				panning.panningModel = 'equalpower';
				panning.setPosition(pan, 0, 1 - Math.abs(pan));
				*/

        volumeFadeOut.connect(this.filterChains[track].input());
      }

      source.playbackRate.value = initialPlaybackRate;
      const sourceDelayTime = 0;
      const playTime = time + sourceDelayTime;

      source.start(playTime, offset);
      const result: NoteInfo = {
        source: source,
        volume: volumeGain,
        panning: panning,
        volumeEnvelope: volumeEnvelope,
        panningEnvelope: panningEnvelope,
        volumeFadeOut: volumeFadeOut,
        startVolume: volume,
        currentVolume: volume,
        startPeriod: period,
        basePeriod: basePeriod,
        noteIndex: noteIndex,
        startPlaybackRate: initialPlaybackRate,
        sampleRate: sampleRate,
        instrumentIndex: index,
        effects: effects,
        track: track,
        time: time,
        scheduled: scheduled,
        currentPeriod: period,
        vibratoTimer: 0,
        tremoloTimer: 0,
        hasAutoVibrato: instrument.hasVibrato(),
      };

      this.scheduledNotes[this.scheduledNotesBucket].push(volumeGain);

      if (!this.isRendering) EventBus.trigger(EVENT.samplePlay, result);

      return result;
    }

    return null;
  }

  playSilence() {
    // used to activate Audio engine on first touch in IOS and Android devices
    if (this.currentContext) {
      if (this.masterVolume == null) {
        console.error(
          "Need the master volume gain node to be initialized to play silence!",
        );
        return;
      }
      const source = this.currentContext.createBufferSource();
      source.connect(this.masterVolume);
      try {
        source.start();
      } catch (e) {
        console.error(e);
      }
    }
  }

  // used to loose snippets of samples (ranges etc)
  playRaw(data: { length: number }, sampleRate: number) {
    if (this.masterVolume == null) {
      console.error(
        "Need the master volume gain node to be initialized to play a raw sample!",
      );
      return;
    }
    if (this.currentContext && data && data.length) {
      const sampleBuffer = this.currentContext.createBuffer(
        1,
        data.length,
        this.currentContext.sampleRate,
      );
      const initialPlaybackRate = sampleRate / this.currentContext.sampleRate;
      const source = this.currentContext.createBufferSource();
      source.buffer = sampleBuffer;
      source.loop = true;
      source.playbackRate.value = initialPlaybackRate;
      source.connect(this.masterVolume);
      source.start();
    }
  }

  startRecording() {
    if (this.masterVolume == null) {
      console.error(
        "Need the master volume gain node to be initialized to start recording!",
      );
      return;
    }
    if (!this.isRecording) {
      if (this.currentContext && Audio.isAudioContext(this.currentContext)) {
        const dest = this.currentContext.createMediaStreamDestination();
        this.mediaRecorder = new MediaRecorder(dest.stream);
        this.mediaRecorder.ondataavailable = (evt) => {
          // push each chunk (blobs) in an array
          this.recordingChunks.push(evt.data);
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordingChunks, {
            type: "audio/ogg; codecs=opus",
          });
          saveAs(blob, "recording.opus");
          //document.querySelector("audio").src = URL.createObjectURL(blob);
        };

        this.masterVolume.connect(dest);
        this.mediaRecorder.start();
        this.isRecording = true;
      } else {
        console.error("recording is not supported on this browser");
      }
    }
  }

  stopRecording() {
    if (this.isRecording) {
      this.isRecording = false;
      if (this.mediaRecorder) this.mediaRecorder.stop();
    }
  }

  startRendering(length: number) {
    if (!Audio.isAudioContext(this.currentContext)) {
      console.error(
        "Main context is already the offline context while attempting to start rendering!",
      );
      return;
    }
    this.isRendering = true;

    console.log("startRendering " + length);
    this.offlineContext = new OfflineAudioContext(2, 44100 * length, 44100);
    this.onlineContext = this.currentContext;
    this.currentContext = this.offlineContext;
    this.init(this.offlineContext);
  }

  stopRendering(next: (renderedBuffer: AudioBuffer) => void) {
    this.isRendering = false;

    if (this.offlineContext == null) {
      console.error(
        "Offline context is missing when stoping rendering! Has rendering been started?",
      );
      return;
    }
    if (this.onlineContext == null) {
      console.error(
        "Online context is missing when stoping rendering! Has rendering been started?",
      );
      return;
    }

    this.offlineContext
      .startRendering()
      .then((renderedBuffer) => {
        console.log("Rendering completed successfully");
        if (next) next(renderedBuffer);
      })
      .catch((err: Error) => {
        console.log("Rendering failed: " + err);
        // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
      });

    // switch back to online Audio context;
    this.currentContext = this.onlineContext;
    this.createAudioConnections(this.onlineContext);
    this.init(this.onlineContext);
  }
  //-->

  setStereoSeparation(value?: STEREOSEPARATION) {
    let panAmount;
    const numberOfTracks = Tracker.getTrackCount();

    if (Tracker.inFTMode()) {
      panAmount = 0;
    } else {
      value = value || this.currentStereoSeparation;
      this.currentStereoSeparation = value;

      switch (value) {
        case STEREOSEPARATION.NONE:
          // mono, no panning
          panAmount = 0;
          Settings.stereoSeparation = STEREOSEPARATION.NONE;
          break;
        case STEREOSEPARATION.FULL:
          // Amiga style: pan even channels hard to the left, uneven to the right;
          panAmount = 1;
          Settings.stereoSeparation = STEREOSEPARATION.FULL;
          break;
        default:
          // balanced: pan even channels somewhat to the left, uneven to the right;
          panAmount = 0.5;
          Settings.stereoSeparation = STEREOSEPARATION.BALANCED;
          break;
      }
    }

    for (let i = 0; i < numberOfTracks; i++) {
      const filter = this.filterChains[i];
      if (filter)
        filter.panningValue(
          i % 4 === 0 || i % 4 === 3 ? -panAmount : panAmount,
        );
    }
  }

  getPrevSampleRate() {
    return this.prevSampleRate;
  }

  createPingPongDelay() {
    // example of delay effect.
    //Taken from http://stackoverflow.com/questions/20644328/using-channelsplitter-and-mergesplitter-nodes-in-web-audio-api

    const delayTime = 0.12;
    const feedback = 0.3;

    const merger = this.currentContext.createChannelMerger(2);
    const leftDelay = this.currentContext.createDelay();
    const rightDelay = this.currentContext.createDelay();
    const leftFeedback = this.currentContext.createGain();
    const rightFeedback = this.currentContext.createGain();
    const splitter = this.currentContext.createChannelSplitter(2);

    splitter.connect(leftDelay, 0);
    splitter.connect(rightDelay, 1);

    leftDelay.delayTime.value = delayTime;
    rightDelay.delayTime.value = delayTime;

    leftFeedback.gain.value = feedback;
    rightFeedback.gain.value = feedback;

    // Connect the routing - left bounces to right, right bounces to left.
    leftDelay.connect(leftFeedback);
    leftFeedback.connect(rightDelay);

    rightDelay.connect(rightFeedback);
    rightFeedback.connect(leftDelay);

    // Re-merge the two delay channels into stereo L/R
    leftFeedback.connect(merger, 0, 0);
    rightFeedback.connect(merger, 0, 1);

    // Now connect your input to "splitter", and connect "merger" to your output destination.

    return {
      splitter: splitter,
      merger: merger,
    };
  }

  /**

     get a new AudioNode playing at x semitones from the root note
     // used to create Chords and Arpeggio

     @param {audioNode} source: audioBuffer of the root note
     @param {Number} root: period of the root note
     @param {Number} semitones: amount of semitones from the root note
     @return {audioNode} audioBuffer of the new note
     */
  semiTonesFrom(
    source: AudioBufferSourceNode,
    root: number,
    semitones: number,
  ): AudioBufferSourceNode {
    const target = this.currentContext.createBufferSource();
    target.buffer = source.buffer;

    if (semitones) {
      const rootNote = periodNoteTable[root];
      const rootIndex = noteNames.indexOf(rootNote.name);
      const targetName = noteNames[rootIndex + semitones];
      if (targetName) {
        const targetNote = nameNoteTable[targetName];
        if (targetNote) {
          target.playbackRate.value =
            (rootNote.period / targetNote.period) * source.playbackRate.value;
        }
      }
    } else {
      target.playbackRate.value = source.playbackRate.value;
    }

    return target;
  }

  getSemiToneFrom(period: number, semitones: number, finetune: number): number {
    let result = period;
    if (finetune) {
      period = this.getFineTuneBasePeriod(period, finetune);
      if (!period) {
        period = result;
        console.error(
          "ERROR: base period for finetuned " +
            finetune +
            " period " +
            period +
            " not found",
        );
      }
    }

    if (semitones) {
      const rootNote: NotePeriod = periodNoteTable[period];
      if (rootNote) {
        const rootIndex = noteNames.indexOf(rootNote.name);
        const targetName = noteNames[rootIndex + semitones];
        if (targetName) {
          const targetNote = nameNoteTable[targetName];
          if (targetNote) {
            result = targetNote.period;
            if (finetune) {
              result = this.getFineTuneForPeriod(result, finetune);
            }
          }
        }
      } else {
        console.error("ERROR: note for period " + period + " not found");
        // note: this can happen when the note is in a period slide
        // FIXME
      }
    }
    return result;
  }

  getNearestSemiTone(period: number, instrumentIndex: number): number {
    let result = period;
    let minDelta = 100000;
    const instrument = Tracker.getInstrument(instrumentIndex);

    if (Tracker.inFTMode()) {
      let targetIndex = 0;
      FTNotes.forEach((note, index) => {
        const p = note.period;
        if (p) {
          const delta = Math.abs(p - period);
          if (delta < minDelta) {
            minDelta = delta;
            result = p;
            targetIndex = index;
          }
        }
      });
      if (targetIndex && instrument && instrument.getFineTune()) {
        if (Tracker.useLinearFrequency) {
          result -= instrument.getFineTune() / 2;
        } else {
          result = this.getFineTuneForNote(
            targetIndex,
            instrument.getFineTune(),
          );
        }
      }
    } else {
      let tuning = 8;
      if (instrumentIndex) {
        if (instrument && instrument.sample.finetune)
          tuning = tuning + instrument.sample.finetune;
      }

      for (const note in NOTEPERIOD) {
        if (NOTEPERIOD.hasOwnProperty(note)) {
          const p = NOTEPERIOD[note].tune[tuning];
          const delta = Math.abs(p - period);
          if (delta < minDelta) {
            minDelta = delta;
            result = p;
          }
        }
      }
    }
    return result;
  }

  // gives the finetuned period for a base period - protracker mode
  getFineTuneForPeriod(period: number, finetune: number): number {
    let result = period;
    const note = periodNoteTable[period];
    if (note && note.tune) {
      //const centerTune = 8;
      const tune = 8 + finetune;
      if (tune >= 0 && tune < note.tune.length) result = note.tune[tune];
    }

    return result;
  }

  // gives the finetuned period for a base note (Fast Tracker Mode)
  getFineTuneForNote(note: number, finetune: number): number {
    if (note === NOTEOFF) return 1;

    const ftNote1 = FTNotes[note];
    const ftNote2 = finetune > 0 ? FTNotes[note + 1] : FTNotes[note - 1];

    if (ftNote1 && ftNote2) {
      const delta = Math.abs(ftNote2.period - ftNote1.period) / 127;
      return ftNote1.period - delta * finetune;
    }

    console.warn("unable to find finetune for note " + note, ftNote1);
    return ftNote1 ? ftNote1.period : 100000;
  }

  // gives the non-finetuned baseperiod for a finetuned period
  getFineTuneBasePeriod(period: number, finetune: number): number {
    let result = period;
    const table = periodFinetuneTable[finetune];
    if (table) {
      result = table[period];
    }
    return result;
  }

  getSampleRateForPeriod(period: number): number {
    if (Tracker.inFTMode()) {
      if (Tracker.useLinearFrequency)
        return 8363 * Math.pow(2, (4608 - period) / 768);
      return PC_FREQUENCY_HALF / period;
    }
    return AMIGA_PALFREQUENCY_HALF / period;
  }

  limitAmigaPeriod(period: number) {
    // limits the period to the allowed Amiga frequency range, between 113 (B3) and 856 (C1)

    period = Math.max(period, 113);
    period = Math.min(period, 856);

    return period;
  }

  setAmigaLowPassFilter(on: boolean, time: number) {
    if (this.lowPassfilter == null) {
      console.error("No low pass filter to set!");
      return;
    }
    // note: this is determined by ear comparing a real Amiga 500 - maybe too much effect ?
    const value = on ? 2000 : 20000;
    this.lowPassfilter.frequency.setValueAtTime(value, time);
  }

  setMasterVolume(value: number, time?: number) {
    if (this.masterVolume == null) {
      console.error(
        "Cannot set the master volume without the master volume gain being initialized!",
      );
      return;
    }
    time = time || this.currentContext.currentTime;
    value = value * 0.7;
    this.masterVolume.gain.setValueAtTime(this.lastMasterVolume, time);
    this.masterVolume.gain.linearRampToValueAtTime(value, time + 0.02);
    this.lastMasterVolume = value;
  }

  slideMasterVolume(value: number, time?: number) {
    if (this.masterVolume == null) {
      console.error(
        "Cannot slide the master volume without the master volume gain being initialized!",
      );
      return;
    }
    time = time || this.currentContext.currentTime;
    value = value * 0.7;
    this.masterVolume.gain.linearRampToValueAtTime(value, time);
    this.lastMasterVolume = value;
  }

  getLastMasterVolume(): number {
    return this.lastMasterVolume / 0.7;
  }

  clearScheduledNotesCache() {
    // 3 rotating caches
    this.scheduledNotesBucket++;
    if (this.scheduledNotesBucket > 2) this.scheduledNotesBucket = 0;
    this.scheduledNotes[this.scheduledNotesBucket] = [];
  }
}

export default new Audio();
