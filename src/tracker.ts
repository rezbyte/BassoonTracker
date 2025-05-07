import Audio from "./audio";
import waveFormFunction, {WaveFormGenerator} from "./audio/waveFormFunction";
import { PLAYTYPE, TRACKERMODE, NOTEPERIOD, FTNOTEPERIOD, EVENT, NotePeriod, NOTEOFF,  FTNotePeriod } from "./enum";
import EventBus from "./eventBus";
import Host from "./host";
import WAAClock from "waaclock";
import { getUrlParameter } from "./lib/util";
import Song, {Pattern} from "./models/song";
import Note, { NoteInfo } from "./models/note";
import Instrument from "./models/instrument";
import { BinaryStream, loadFile } from "./filesystem";
import FileDetector from "./fileformats/fileDetector";
import StateManager from "./ui/stateManager";
import Input from "./ui/input";
import { Config, UI } from "./ui/main";
import Editor from "./editor";
import Settings from "./settings";
import type { ListBoxItem } from "./ui/components/listbox";
import UZIP from "uzip";

interface SongPosition {
  position: number,
  step: number
};

interface Effect {
  value: number
}

interface Offset extends Effect {
  stepValue?: number,
  instrument?: number
}

interface Panning extends Effect {
  slide: boolean
}

interface Fade extends Effect {
  resetOnStep?: boolean
  fine: boolean
}

interface Slide extends Effect {
  target?: number,
  canUseGlissando?: boolean,
  resetVolume?: boolean,
  volume?: number,
  fine?: boolean
}

interface FineTune {
  original: number,
  instrument: Instrument
}

interface Arpeggio {
  root: number,
  interval1: number,
  interval2: number,
  step: number,
}

interface Sine {
  amplitude: number,
  freq: number,
}

export interface Effects {
  offset?: Offset,
  volume?: Effect,
  fade?: Fade,
  panning?: Panning,
  arpeggio?: Arpeggio,
  slide?: Slide,
  fineSlide?: Slide,
  defaultSlideTarget?: number
  slideUp?: Slide
  slideDown?: Slide
  fineTune?: FineTune,
  cutNote?: Effect,
  noteOff?: Effect,
  reTrigger?: Effect,
  vibrato?: Sine,
  tremolo?: Sine,
  glissando?: boolean
}

export interface TrackerState {
  patternPos: number, 
  songPos: number
}

interface StepResult {
  pause?: boolean,
  pasuseHandled?: boolean
  patternBreak?: boolean,
  positionBreak?: boolean,
  targetSongPosition?: number,
  targetPatternPosition?: number,
  patternDelay?: number
}

export let periodNoteTable: NotePeriod[] = [];
export let periodFinetuneTable: number[][] = [];
export let nameNoteTable: Record<string, NotePeriod> = {};
export let noteNames: string[] = [];
export let FTNotes: FTNotePeriod[] = [];
export let FTPeriods: number[] = [];

class Tracker {
  // TODO: strip UI stuff
  private isMaster = true;

  // The parameter `audioContext` in WAAClock's constructor can accept an OfflineAudioContext because WAAClock only uses properties from BaseAudioContext in it's source code.
  private clock: WAAClock | undefined;

  private isRecording = false;
  private _isPlaying = false;

  private song: Song | undefined;
  private instruments: Instrument[] = [];

  private currentInstrumentIndex = 1;
  private prevInstrumentIndex: number | undefined;
  private currentPattern = 0;
  private prevPattern: number | undefined;
  private currentPatternPos = 0;
  private prevPatternPos: number | undefined;
  private currentPlayType = PLAYTYPE.song;
  private currentPatternData: Pattern | undefined;

  private currentSongPosition = 0;
  private prevSongPosition: number | undefined = 0;

  private vibratoFunction?: WaveFormGenerator;
  private tremoloFunction?: WaveFormGenerator;

  private bpm = 125; // bmp
  private ticksPerStep = 6;
  private tickTime = 2.5 / this.bpm;
  //private tickCounter = 0;
  private mainTimer?: WAAClock.Event;

  private trackCount = 4;
  private patternLength = 64;
  private trackerMode = TRACKERMODE.PROTRACKER;

  private swing = 0; // swing in milliseconds. NOTE: this is not part of any original Tracker format, just nice to have on beat sequences

  private trackNotes: (NoteInfo | null)[] = [];
  private trackEffectCache: Effects[] = [];
  private trackerStates: {time: number, state: TrackerState}[] = [];
  private patternLoopStart: Record<number, number> = [];
  private patternLoopCount: Record<number, number> = [];

  useLinearFrequency = true;

  isPlugin = false;

  autoPlay: boolean = false;

  init(config?: Config) {
    this.clock = new WAAClock(Audio.context as AudioContext)
    /*for (let i = 0; i < this.trackCount; i++) {
      this.trackNotes.push({});
      this.trackEffectCache.push({});
    }*/
   this.trackNotes = Array(this.trackCount).fill(null);
   this.trackEffectCache = Array(this.trackCount);

    for (let i = -8; i < 8; i++) {
      periodFinetuneTable[i] = [];
    }

    for (let key in NOTEPERIOD) {
        const note: NotePeriod = NOTEPERIOD[key];
        periodNoteTable[note.period] = note;
        nameNoteTable[note.name] = note;
        noteNames.push(note.name);

        // build fineTune table
        if (note.tune) {
          for (let i = -8; i < 8; i++) {
            const table = periodFinetuneTable[i];
            const index = i + 8;
            table[note.tune[index]] = note.period;
          }
        }
    }

    let ftCounter = 0;
    for (const ftNote of Object.values(FTNOTEPERIOD)) {
      //const ftNote = FTNOTEPERIOD[key];
      if (!ftNote.period) ftNote.period = 1;
      FTNotes.push(ftNote);
      FTPeriods[ftNote.period] = ftCounter;
      if (ftNote.modPeriod) FTPeriods[ftNote.modPeriod] = ftCounter;
      ftCounter++;
    }

    if (config) {
      Host.init();
      Audio.init(config.audioContext, config.audioDestination);
      if (config.plugin) {
        this.isPlugin = true;
        UI.initPlugin(config);
        if (typeof config.isMaster === "boolean") this.isMaster = config.isMaster;
        if (config.handler) {
          EventBus.on(EVENT.songBPMChange, (bpm: number) => {
            if (config.handler) config.handler(EVENT.songBPMChange, bpm);
          });
          EventBus.on(EVENT.songBPMChangeIgnored, (bpm: number) => {
            if (config.handler) config.handler(EVENT.songBPMChangeIgnored, bpm);
          });

          EventBus.on(EVENT.songSpeedChange, (speed: number) => {
            if (config.handler) config.handler(EVENT.songSpeedChange, speed);
          });
          EventBus.on(EVENT.songSpeedChangeIgnored, (speed: number) => {
            if (config.handler) config.handler(EVENT.songSpeedChangeIgnored, speed);
          });

          EventBus.on(EVENT.patternEnd, (time: number) => {
            if (config.handler) config.handler(EVENT.patternEnd, time);
          });
        }
      }
    }
  };

  setCurrentInstrumentIndex(index: number) {
    if (this.song == null) {
      console.error("Cannot set current instrument index without a song!");
      return;
    }
    if (this.song.instruments[index]) {
      this.currentInstrumentIndex = index;
      if (this.prevInstrumentIndex != this.currentInstrumentIndex)
        EventBus.trigger(EVENT.instrumentChange, this.currentInstrumentIndex);
      this.prevInstrumentIndex = this.currentInstrumentIndex;
    } else {
      if (index <= this.getMaxInstruments()) {
        const max = index;
        for (let i = this.song.instruments.length; i <= max; i++) {
          this.setInstrument(i, new Instrument());
        }

        const instrumentContainer: ListBoxItem[] = [];
        for (let i = 1; i <= max; i++) {
          const instrument = this.song.instruments[i] || { name: "" };
          instrumentContainer.push({
            label: i + " " + instrument.name,
            data: i,
            index: i - 1
          });
          EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);
        }

        this.currentInstrumentIndex = index;
        if (this.prevInstrumentIndex != this.currentInstrumentIndex)
          EventBus.trigger(EVENT.instrumentChange, this.currentInstrumentIndex);
        this.prevInstrumentIndex = this.currentInstrumentIndex;
      }
    }
  };

  getCurrentInstrumentIndex() {
    return this.currentInstrumentIndex;
  };

  getCurrentInstrument(): Instrument {
    return this.instruments[this.currentInstrumentIndex];
  };

  getMaxInstruments(): 128 | 31 {
    return this.inFTMode() ? 128 : 31;
  };

  setCurrentPattern(index: number) {
    if (this.song == null) {
      console.error("Cannot set current pattern without a song!");
      return;
    }
    this.currentPattern = index;
    this.currentPatternData = this.song.patterns[this.currentPattern];

    if (!this.currentPatternData) {
      // insert empty pattern;
      this.currentPatternData = this.getEmptyPattern();
      this.song.patterns[this.currentPattern] = this.currentPatternData;
    }
    this.patternLength = this.currentPatternData.length;
    if (this.prevPattern != this.currentPattern)
      EventBus.trigger(EVENT.patternChange, this.currentPattern);
    this.prevPattern = this.currentPattern;
  };
  getCurrentPattern(): number {
    return this.currentPattern;
  };
  getCurrentPatternData(): Pattern | undefined {
    return this.currentPatternData;
  };
  updatePatternTable(index: number, value: number) {
    if (this.song == null) {
      console.error("Cannot update song pattern table without a song!");
      return;
    }
    this.song.patternTable[index] = value;
    EventBus.trigger(EVENT.patternTableChange, value);
    if (index === this.currentSongPosition) {
      this.prevPattern = undefined;
      this.setCurrentPattern(value);
    }
  };

  setCurrentPatternPos(index: number) {
    this.currentPatternPos = index;
    if (this.prevPatternPos != this.currentPatternPos)
      EventBus.trigger(EVENT.patternPosChange, {
        current: this.currentPatternPos,
        prev: this.prevPatternPos,
      });
    this.prevPatternPos = this.currentPatternPos;
  };
  getCurrentPatternPos(): number {
    return this.currentPatternPos;
  };
  moveCurrentPatternPos(amount: number) {
    let newPos = this.currentPatternPos + amount;
    const max = this.patternLength - 1;
    if (newPos < 0) newPos = max;
    if (newPos > max) newPos = 0;
    this.setCurrentPatternPos(newPos);
  };

  getCurrentSongPosition(): number {
    return this.currentSongPosition;
  };
  setCurrentSongPosition(position: number, fromUserInteraction?: boolean) {
    if (this.song == null) {
      console.error("Cannot set current song position without a song!");
      return;
    }
    this.currentSongPosition = position;
    if (this.currentSongPosition != this.prevSongPosition) {
      EventBus.trigger(EVENT.songPositionChange, this.currentSongPosition);
      if (this.song.patternTable)
        this.setCurrentPattern(this.song.patternTable[this.currentSongPosition]);
      this.prevSongPosition = this.currentSongPosition;

      if (fromUserInteraction && this._isPlaying) {
        this.stop();
        this.togglePlay();
      }
    }
  };

  setPlayType(playType: PLAYTYPE) {
    this.currentPlayType = playType;
    EventBus.trigger(EVENT.playTypeChange, this.currentPlayType);
  };
  getPlayType(): PLAYTYPE {
    return this.currentPlayType;
  };

  isPlaying(): boolean {
    return this._isPlaying;
  }

  playSong() {
    this.stop();
    Audio.checkState();
    //Audio.setMasterVolume(1);
    this.setPlayType(PLAYTYPE.song);
    this._isPlaying = true;
    //Audio.startRecording();
    this.playPattern(); // Originally: me.playPattern(this.currentPattern)
    EventBus.trigger(EVENT.playingChange, this._isPlaying);
  };

  playPattern() {
    this.stop();
    Audio.checkState();
    //Audio.setMasterVolume(1);
    this.currentPatternPos = 0;
    this._isPlaying = true;
    this.startPattern(this.currentPattern);
    EventBus.trigger(EVENT.playingChange, this._isPlaying);
  };

  stop() {
    if (this.clock) this.clock.stop();
    Audio.disable();
    if (!this.isPlugin) Audio.setMasterVolume(1);
    if (UI) {
      UI.setStatus("Ready");
      Input.clearInputNotes();
    }

    this.clearEffectCache();
    //Audio.stopRecording();

    for (let i = 0; i < this.trackCount; i++) {
      if (this.trackNotes[i]?.source) {
        try {
          this.trackNotes[i]?.source.stop();
        } catch (e) {}
      }
    }

    this._isPlaying = false;
    EventBus.trigger(EVENT.playingChange, this._isPlaying);
  };

  pause() {
    // this is only called when speed is set to 0
    if (this.clock) this.clock.stop();
    this._isPlaying = false;
    EventBus.trigger(EVENT.playingChange, this._isPlaying);
  };

  togglePlay() {
    if (this.isPlaying()) {
      this.stop();
    } else {
      if (this.currentPlayType == PLAYTYPE.pattern) {
        this.playPattern();
      } else {
        this.playSong();
      }
    }
  };

  getProperties() {
    return {
      ticksPerStep: this.ticksPerStep,
      tickTime: this.tickTime,
    };
  };

  private startPattern(patternIndex: number = 0) {
    if (this.song == null) {
      console.error("Cannot start a pattern without a song!");
      return;
    }

    if (this.clock == null) {
      console.error("Cannot play a pattern without Tracker being initialized!")
      return;
    }
    this.clock.start();
    Audio.enable();
    if (UI) UI.setStatus("Playing");
    this.patternLoopStart = [];
    this.patternLoopCount = [];

    this.currentPatternData = this.song.patterns[patternIndex];
    let thisPatternLength = this.currentPatternData.length;
    let stepResult: StepResult = {};

    // look-ahead playback - far less demanding, works OK on mobile devices
    let p = 0;
    let time = Audio.context.currentTime + 0.1; //  add small delay to allow some time to render the first notes before playing

    // start with a small delay then make it longer
    // this is because Chrome on Android doesn't start playing until the first batch of scheduling is done?

    let delay = 0.2;
    const playingDelay = 1;

    let playPatternData = this.currentPatternData;
    let playSongPosition = this.currentSongPosition;
    this.trackerStates = [];

    this.mainTimer = this.clock
      .setTimeout((event) => {
        if (this.song == null) {
          console.error("Cannot play a pattern without a song!");
          return;
        }
        if (p > 1 && this.mainTimer) {
          delay = playingDelay;
          this.mainTimer.repeat(delay);
        }

        const maxTime = event.deadline + delay;
        Audio.clearScheduledNotesCache();

        while (time < maxTime) {
          // ignore speed==0 when autoplay is active (Playlists)
          if (stepResult.pause && !this.autoPlay) {
            // speed is set to 0
            if (!stepResult.pasuseHandled) {
              const delta = time - Audio.context.currentTime;
              if (delta > 0) {
                setTimeout(() => {
                  this.pause();
                  // in Fasttracker this repeats the current step with the previous speed - including effects.
                  // (which seems totally weird)
                  this.setAmigaSpeed(6);
                }, Math.round(delta * 1000) + 100);
              }
              stepResult.pasuseHandled = true;
            }
            return;
          }

          this.setStateAtTime(time, { patternPos: p, songPos: playSongPosition });
          if (!UI) this.setCurrentSongPosition(playSongPosition);

          if (stepResult.patternDelay) {
            // the E14 effect is used: delay Pattern but keep processing effects
            stepResult.patternDelay--;

            for (let i = 0; i < this.trackCount; i++) {
              this.applyEffects(i, time);
            }

            time += this.ticksPerStep * this.tickTime;
          } else {
            stepResult = this.playPatternStep(
              p,
              time,
              playPatternData,
              playSongPosition
            );
            time += this.ticksPerStep * this.tickTime;
            p++;
            if (p >= thisPatternLength || stepResult.patternBreak) {
              if (
                !(
                  stepResult.positionBreak &&
                  stepResult.targetSongPosition == playSongPosition
                )
              ) {
                //We're not in a pattern loop
                this.patternLoopStart = [];
                this.patternLoopCount = [];
              }
              p = 0;
              if (this.getPlayType() === PLAYTYPE.song) {
                const song = this.song;
                let nextPosition: number = stepResult.positionBreak && stepResult.targetSongPosition !== undefined
                  ? stepResult.targetSongPosition
                  : ++playSongPosition;
                if (nextPosition >= song.length) {
                  nextPosition = song.restartPosition
                    ? song.restartPosition - 1
                    : 0;
                  EventBus.trigger(EVENT.songEnd);
                }
                if (nextPosition >= song.length) nextPosition = 0;
                playSongPosition = nextPosition;
                patternIndex = song.patternTable[playSongPosition];
                playPatternData = song.patterns[patternIndex];

                // some invalid(?) XM files have non-existent patterns in their song list - eg. cybernautic_squierl.xm
                if (!playPatternData) {
                  playPatternData = this.getEmptyPattern();
                  song.patterns[patternIndex] = playPatternData;
                }

                thisPatternLength = playPatternData.length;
                if (stepResult.patternBreak) {
                  p = stepResult.targetPatternPosition || 0;
                  if (p > playPatternData.length) p = 0; // occurs in the wild - example "Lake Of Sadness" - last pattern
                }
              } else {
                if (stepResult.patternBreak) {
                  p = stepResult.targetPatternPosition || 0;
                  if (p > this.patternLength) p = 0;
                }
              }
              EventBus.trigger(
                EVENT.patternEnd,
                time - this.ticksPerStep * this.tickTime
              );
            }
          }
        }

        // check if a playing note has looping parameters that needs further scheduling

        for (let i = 0; i < this.trackCount; i++) {
          const trackNote = this.trackNotes[i];
          if (trackNote && trackNote.time && trackNote.scheduled) {
            const instrument = this.getInstrument(trackNote.instrumentIndex);
            if (instrument) {
            }

            if (trackNote.volumeEnvelope && trackNote.scheduled.volume) {
              if (time + delay >= trackNote.scheduled.volume) {
                const scheduledtime = instrument.scheduleEnvelopeLoop(
                  trackNote.volumeEnvelope,
                  trackNote.scheduled.volume,
                  2
                );
                trackNote.scheduled.volume += scheduledtime;
              }
            }

            if (trackNote.panningEnvelope && trackNote.scheduled.panning) {
              if (time + delay >= trackNote.scheduled.panning) {
                const scheduledtime = instrument.scheduleEnvelopeLoop(
                  trackNote.panningEnvelope,
                  trackNote.scheduled.panning,
                  2
                );
                trackNote.scheduled.panning += scheduledtime;
              }
            }
          }
        }
      }, 0.01)
      .repeat(delay)
      .tolerance({ early: 0.1 });
  }

  playPatternStep(step: number, time: number = 0, patternData: Pattern | undefined = this.currentPatternData, songPostition: number = 0): StepResult {
    if (patternData === undefined) {
      throw new Error("Cannot playPatternStep without any pattern data loaded!");
    }
    // note: patternData can be different than currentPatternData when playback is active with long look ahead times

    const patternStep = patternData[step];
    const tracks = this.trackCount;
    const result: StepResult = {};

    // hmmm ... Whut?
    // The Speed setting influences other effects too,
    // on Amiga players the effects are processed each tick, so the speed setting on a later channel can influence the effects on a previous channel ...
    // This is implemented by setting the speed before all other effects
    // example: see the ED2 command pattern 0, track 3, step 32 in AceMan - Dirty Tricks.mod
    // not sure this is 100% correct, but in any case it's more correct then setting it at the track it self.
    // Thinking ... ... yes ... should be fine as no speed related effects are processed on tick 0?
    //

    for (let i = 0; i < tracks; i++) {
      const note = patternStep[i];
      if (note && note.effect && note.effect === 15) {
        if (note.param < 32) {
          //if (note.param == 0) note.param = 1;
          this.setAmigaSpeed(note.param);
          if (note.param === 0) result.pause = true;
        } else {
          this.setBPM(note.param);
        }
      }
    }
    // --- end Whut? ---

    for (let i = 0; i < tracks; i++) {
      const note = patternStep[i];
      if (note) {
        const songPos: SongPosition = { position: songPostition, step: step };

        let playtime = time;
        if (this.swing) {
          const swingTime = (Math.random() * this.swing * 2 - this.swing) / 1000;
          playtime += swingTime;
        }

        const r = this.playNote(note, i, playtime, songPos);
        if (r.patternBreak) {
          result.patternBreak = true;
          result.targetPatternPosition = r.targetPatternPosition || 0;
        }
        if (r.positionBreak) {
          result.positionBreak = true;
          result.targetPatternPosition = r.targetPatternPosition || 0;
          result.targetSongPosition = r.targetSongPosition || 0;
        }
        if (r.patternDelay) result.patternDelay = r.patternDelay;
      }
    }

    for (let i = 0; i < tracks; i++) {
      this.applyEffects(i, time);
    }

    return result;
  }


  private playNote(note: Note, track: number, time: number, songPos: SongPosition): StepResult {
    let defaultVolume: number | undefined = 100;
    const trackEffects: Effects = {};

    let instrumentIndex: number | undefined = note.instrument;
    let notePeriod = note.period;
    let noteIndex = note.index;

    let instrument: Instrument | undefined;

    if (notePeriod && !instrumentIndex) {
      // reuse previous instrument
      instrumentIndex = this.trackNotes[track]?.instrumentIndex;
      defaultVolume =
        typeof this.trackNotes[track]?.currentVolume === "number"
          ? this.trackNotes[track].currentVolume
          : defaultVolume;

      if (
        Settings.emulateProtracker1OffsetBug &&
        instrumentIndex &&
        this.trackEffectCache[track].offset
      ) {
        if (this.trackEffectCache[track].offset.instrument === instrumentIndex) {
          console.log(
            "applying instrument offset cache to instrument " + instrumentIndex
          );
          trackEffects.offset = this.trackEffectCache[track].offset;
        }
      }
    }

    if (typeof note.instrument === "number") {
      instrument = this.getInstrument(note.instrument);
      if (instrument) {
        defaultVolume = 100 * (instrument.sample.volume / 64);

        if (Settings.emulateProtracker1OffsetBug) {
          // reset instrument offset when a instrument number is present;
          const newTrackOffset: Offset = this.trackEffectCache[track].offset || {value: 0};
          newTrackOffset.value = 0;
          newTrackOffset.instrument = note.instrument;
          this.trackEffectCache[track].offset = newTrackOffset;
        }
      }
    }

    let volume: number = defaultVolume;
    let doPlayNote = true;

    if (typeof instrumentIndex === "number") {
      instrument = this.getInstrument(instrumentIndex);
    }

    if (noteIndex && this.inFTMode()) {
      if (noteIndex === 97) {
        noteIndex = NOTEOFF;
      }

      if (noteIndex === NOTEOFF) {
        const offInstrument = instrument ? instrument : this.trackNotes[track] ? this.getInstrument(this.trackNotes[track].instrumentIndex) : null;
        if (offInstrument) {
          volume = this.trackNotes[track] ? offInstrument.noteOff(time, this.trackNotes[track]) : 100; 
        } else {
          console.log("no instrument on track " + track);
          volume = 0;
        }
        defaultVolume = volume;
        doPlayNote = false;
      } else {
        if (instrument) {
          instrument.setSampleForNoteIndex(noteIndex);

          if (instrument.sample.relativeNote)
            noteIndex += instrument.sample.relativeNote;
          // TODO - check of note gets out of range
          // but apparently they still get played ... -> extend scale to 9, 10 or 11 octaves ?
          // see jt_letgo.xm instrument 6 (track 20) for example
        }

        if (this.useLinearFrequency) {
          notePeriod = 7680 - (noteIndex - 1) * 64;
        } else {
          const ftNote = FTNotes[noteIndex];
          if (ftNote) notePeriod = ftNote.period;
        }
      }
    }

    let value = note.param;
    let x, y;

    const result: StepResult = {};

    if (note.volumeEffect && this.inFTMode()) {
      const ve = note.volumeEffect;
      x = ve >> 4;
      y = ve & 0x0f;

      if (ve > 15 && ve <= 80) {
        volume = ((ve - 16) / 64) * 100;
        defaultVolume = volume;

        // note this is not relative to the default instrument volume but sets the instrument volume
        trackEffects.volume = {
          value: volume,
        };
      } else {
        switch (x) {
          case 6:
            // volume slide down
            trackEffects.fade = {
              value: (y * -1 * 100) / 64,
              fine: false
            };
            break;
          case 7:
            // volume slide up
            trackEffects.fade = {
              value: (y * 100) / 64,
              fine: false
            };
            break;
          case 8:
            // Fine volume slide down
            trackEffects.fade = {
              value: (-y * 100) / 64,
              fine: true,
            };
            break;
          case 9:
            // Fine volume slide up
            trackEffects.fade = {
              value: (y * 100) / 64,
              fine: true,
            };
            break;
          case 10:
            // set vibrato speed
            console.warn("set vibrato speed not implemented");
            break;
          case 11:
            // Vibrato
            console.warn("Vibrato not implemented");
            break;
          case 12:
            // Set panning
            trackEffects.panning = {
              value: (ve - 192) * 17,
              slide: false,
            };
            break;
          case 13:
            // Panning slide left
            console.warn("Panning slide left not implemented - track " + track);
            trackEffects.panning = {
              value: ve,
              slide: true,
            };
            break;
          case 14:
            // Panning slide right
            console.warn(
              "Panning slide right not implemented - track " + track
            );
            break;
          case 15:
            // Tone porta
            console.warn("Tone Porta not implemented");
            break;
        }
      }
    }

    let target: number;
    let prevSlide: Slide | undefined;
    switch (note.effect) {
      case 0:
        // Arpeggio
        if (value) {
          x = value >> 4;
          y = value & 0x0f;

          let finetune = 0;

          //todo: when a instrument index is present other than the previous index: number, but no note
          // how does this work?
          // see example just_about_seven.mod

          instrument = instrument ? instrument : this.trackNotes[track] ? this.getInstrument(this.trackNotes[track].instrumentIndex) : undefined;

          if (this.inFTMode()) {
            if (instrument) {
              const _noteIndex = noteIndex || this.trackNotes[track]?.noteIndex;
              if (_noteIndex === undefined) {
                console.error("Could not determine noteIndex for Arpeggio!");
                return result;
              }
              const root = instrument.getPeriodForNote(_noteIndex, true);
              if (noteIndex === NOTEOFF) {
                trackEffects.arpeggio = this.trackEffectCache[track].arpeggio;
              } else {
                trackEffects.arpeggio = {
                  root: root,
                  interval1:
                    root - instrument.getPeriodForNote(_noteIndex + x, true),
                  interval2:
                    root - instrument.getPeriodForNote(_noteIndex + y, true),
                  step: 1,
                };

                this.trackEffectCache[track].arpeggio = trackEffects.arpeggio;
              }
            }
          } else {
            let root = notePeriod || this.trackNotes[track]?.startPeriod;
            if (root === undefined) {
              console.error("Could not determine root for Arpeggio!");
              return result;
            }
            // check if the instrument is finetuned
            if (instrument) {
              finetune = instrument.getFineTune();
              if (finetune) root = Audio.getFineTuneForPeriod(root, finetune);
            }

            trackEffects.arpeggio = {
              root: root,
              interval1: root - Audio.getSemiToneFrom(root, x, finetune),
              interval2: root - Audio.getSemiToneFrom(root, y, finetune),
              step: 1,
            };
          }
        }

        // set volume, even if no effect present
        // note: this is consistent with the Protracker 3.15 and later playback
        // on Protracker 2.3 and 3.0, the volume effect seems much bigger - why ? (see "nugget - frust.mod")
        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume,
          };
        }

        break;
      case 1:
        // Slide Up
        value = value * -1;

        // note: on protracker 2 and 3 , the effectcache is NOT used on this effect
        // it is on Milkytracker (in all playback modes)

        if (this.inFTMode()) {
          if (!value && this.trackEffectCache[track].slideUp)
            value = this.trackEffectCache[track].slideUp.value;
        }

        trackEffects.slide = {
          value: value,
        };
        this.trackEffectCache[track].slideUp = trackEffects.slide;
        break;
      case 2:
        // Slide Down

        // note: on protracker 2 and 3 , the effectcache is NOT used on this effect
        // it is on Milkytracker (in all playback modes)

        if (this.inFTMode()) {
          if (!value && this.trackEffectCache[track].slideDown)
            value = this.trackEffectCache[track].slideDown.value;
        }

        trackEffects.slide = {
          value: value,
        };
        this.trackEffectCache[track].slideDown = trackEffects.slide;
        break;
      case 3:
        // Slide to Note - if there's a note provided, it is not played directly,
        // if the instrument number is set, the default volume of that instrument will be set

        // if value == 0 then the old slide will continue

        doPlayNote = false;
        // note: protracker2 switches samples on the fly if the instrument index is different from the previous instrument ...
        // Should we implement that?
        // fasttracker does not.
        // protracker 3 does not
        // milkytracker tries, but not perfect
        // the ProTracker clone of 8bitbubsy does this completely compatible to protracker2.

        target = notePeriod;
        if (this.inFTMode() && noteIndex === NOTEOFF) target = 0;

        // avoid using the fineTune of another instrument if another instrument index is present
        if (this.trackNotes[track]?.instrumentIndex)
          instrumentIndex = this.trackNotes[track].instrumentIndex;

        if (target && instrumentIndex) {
          // check if the instrument is finetuned
          const instrument = this.getInstrument(instrumentIndex);
          if (instrument && instrument.getFineTune()) {
            target = this.inFTMode()
              ? instrument.getPeriodForNote(noteIndex, true)
              : Audio.getFineTuneForPeriod(target, instrument.getFineTune());
          }
        }

        prevSlide = this.trackEffectCache[track].slide;

        if (prevSlide) {
          if (!value) value = prevSlide.value;
        }
        if (!target) {
          target = this.trackEffectCache[track].defaultSlideTarget ?? 0;
        }

        trackEffects.slide = {
          value: value,
          target: target,
          canUseGlissando: true,
          resetVolume: !!note.instrument,
          volume: defaultVolume,
        };
        this.trackEffectCache[track].slide = trackEffects.slide;

        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume,
          };
        }

        break;
      case 4:{
        // vibrato
        // reset volume and vibrato timer if instrument number is present
        if (note.instrument && this.trackNotes[track]) {
          if (this.trackNotes[track].startVolume) {
            trackEffects.volume = {
              value: volume,
            };
          }

          this.trackNotes[track].vibratoTimer = 0;
        }

        x = value >> 4;
        y = value & 0x0f;

        let freq = (x * this.ticksPerStep) / 64;

        const prevVibrato = this.trackEffectCache[track].vibrato;
        if (x == 0 && prevVibrato) freq = prevVibrato.freq;
        if (y == 0 && prevVibrato) y = prevVibrato.amplitude;

        trackEffects.vibrato = {
          amplitude: y,
          freq: freq,
        };
        this.trackEffectCache[track].vibrato = trackEffects.vibrato;

        break;
      }
      case 5:
        // continue slide to note
        doPlayNote = false;
        target = notePeriod;

        if (target && instrumentIndex) {
          // check if the instrument is finetuned
          instrument = this.getInstrument(instrumentIndex);
          if (instrument && instrument.getFineTune()) {
            // TODO - in FT mode - should we use getFineTuneForBote even when linearFrequency is used ?
            target = this.inFTMode()
              ? Audio.getFineTuneForNote(noteIndex, instrument.getFineTune())
              : Audio.getFineTuneForPeriod(target, instrument.getFineTune());
          }
        }

        value = 1;

        prevSlide = this.trackEffectCache[track].slide;
        if (prevSlide) {
          if (!target) target = prevSlide.target || 0;
          value = prevSlide.value;
        }

        trackEffects.slide = {
          value: value,
          target: target,
        };
        this.trackEffectCache[track].slide = trackEffects.slide;

        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume,
          };
        }

        // and do volume slide
        value = note.param;
        if (!value) {
          // don't do volume slide
        } else {
          if (note.param < 16) {
            // slide down
            value = value * -1;
          } else {
            // slide up
            //value = note.param & 0x0f;
            value = note.param >> 4;
          }

          // this is based on max volume of 64 -> normalize to 100;
          value = (value * 100) / 64;

          trackEffects.fade = {
            value: value,
            resetOnStep: !!note.instrument, // volume only needs resetting when the instrument number is given, other wise the volue is remembered from the preious state
            fine: false
          };
          this.trackEffectCache[track].fade = trackEffects.fade;
        }

        break;

      case 6:
        // Continue Vibrato and do volume slide

        // reset volume and vibrato timer if instrument number is present
        if (note.instrument && this.trackNotes[track]) {
          if (this.trackNotes[track].startVolume) {
            trackEffects.volume = {
              value: volume,
            };
          }

          this.trackNotes[track].vibratoTimer = 0;
        }
        if (note.param) {
          if (note.param < 16) {
            // volume slide down
            value = value * -1;
          } else {
            // volume slide up
            value = note.param & 0x0f;
          }

          // this is based on max volume of 64 -> normalize to 100;
          value = (value * 100) / 64;

          trackEffects.fade = {
            value: value,
            fine: false
          };
          this.trackEffectCache[track].fade = trackEffects.fade;
        } else {
          // on Fasttracker this command is remembered - on Protracker it is not.
          if (this.inFTMode()) {
            if (this.trackEffectCache[track].fade)
              trackEffects.fade = this.trackEffectCache[track].fade;
          }
        }

        if (this.trackEffectCache[track].vibrato)
          trackEffects.vibrato = this.trackEffectCache[track].vibrato;
        break;
      case 7:
        // Tremolo
        // note: having a instrument number without a period doesn't seem te have any effect (protracker)
        // when only a period -> reset the wave form / timer

        if (notePeriod && !note.instrument && this.trackNotes[track]) {
          if (this.trackNotes[track].startVolume) {
            trackEffects.volume = {
              value: volume,
            };
          }

          this.trackNotes[track].tremoloTimer = 0;
        }

        x = value >> 4;
        y = value & 0x0f;

        //let amplitude = y * (ticksPerStep-1); Note: this is the formula in the mod spec, but this seems way off;
        let amplitude = y;
        let freq = (x * this.ticksPerStep) / 64;

        const prevTremolo = this.trackEffectCache[track].tremolo;

        if (x == 0 && prevTremolo) freq = prevTremolo.freq;
        if (y == 0 && prevTremolo) amplitude = prevTremolo.amplitude;

        trackEffects.tremolo = {
          amplitude: amplitude,
          freq: freq,
        };

        this.trackEffectCache[track].tremolo = trackEffects.tremolo;

        break;
      case 8:
        // Set Panning position
        trackEffects.panning = {
          value: value,
          slide: false,
        };
        break;
      case 9:
        // Set instrument offset

        /* quirk in Protracker 1 and 2 ?
				 if NO NOTE is given but a instrument number is present,
				 then the offset is remembered for the next note WITHOUT instrument number
				 but only when the derived instrument number is the same as the offset instrument number
				 see "professional tracker" mod for example

				 also:
				 * if no instrument number is present: don't reset the offset
				  -> the effect cache of the previous 9 command of the instrument is used
				 * if a note is present REAPPLY the offset in the effect cache (but don't set start of instrument)
				  -> the effect cache now contains double the offset

				 */

        value = value << 8;
        if (!value && this.trackEffectCache[track].offset) {
          value =
            this.trackEffectCache[track].offset.stepValue ||
            this.trackEffectCache[track].offset.value ||
            0;
        }
        const stepValue = value;

        if (
          Settings.emulateProtracker1OffsetBug &&
          !note.instrument &&
          this.trackEffectCache[track].offset
        ) {
          // bug in PT1 and PT2: add to existing offset if no instrument number is given
          value += this.trackEffectCache[track].offset.value;
        }

        trackEffects.offset = {
          value: value,
          stepValue: stepValue,
        };

        // note: keep previous  this.trackEffectCache[track].offset.instrument intact
        const newTrackOffset: Offset = this.trackEffectCache[track].offset || {value: trackEffects.offset.value};
        newTrackOffset.value = trackEffects.offset.value;
        newTrackOffset.stepValue = trackEffects.offset.stepValue;
        this.trackEffectCache[track].offset = newTrackOffset;

        if (Settings.emulateProtracker1OffsetBug) {
          // quirk in PT1 and PT2: remember instrument offset for instrument
          if (note.instrument) {
            //console.log("set offset cache for instrument " + note.instrument);
            this.trackEffectCache[track].offset.instrument = note.instrument;
          }

          // bug in PT1 and PT2: re-apply instrument offset in effect cache
          if (notePeriod) {
            //console.log("re-adding offset in effect cache");
            this.trackEffectCache[track].offset.value += stepValue;
          }
        }

        if (note.instrument) {
          trackEffects.volume = {
            value: defaultVolume,
          };
        }

        break;
      case 10:
        // volume slide
        if (note.param < 16) {
          // slide down
          value = value * -1;
        } else {
          // slide up
          value = note.param >> 4;
        }

        // this is based on max volume of 64 -> normalize to 100;
        value = (value * 100) / 64;

        if (!note.param) {
          const prevFade = this.trackEffectCache[track].fade;
          if (prevFade) value = prevFade.value;
        }

        trackEffects.fade = {
          value: value,
          resetOnStep: !!note.instrument, // volume only needs resetting when the instrument number is given, otherwise the volume is remembered from the previous state
          fine: false,
        };

        //!!! in FT2 this effect is remembered - in Protracker it is not
        if (this.inFTMode()) {
          this.trackEffectCache[track].fade = trackEffects.fade;
        }

        break;
      case 11:
        // Position Jump

        // quickfix for autoplay ...
        if (!this.autoPlay) {
          result.patternBreak = true;
          result.positionBreak = true;
          result.targetSongPosition = note.param;
          result.targetPatternPosition = 0;
        }
        break;
      case 12:
        //volume
        volume = (note.param / 64) * 100;
        // not this is not relative to the default instrument volume but sets the instrument volume
        trackEffects.volume = {
          value: volume,
        };
        break;
      case 13:
        // Pattern Break
        result.patternBreak = true;
        x = value >> 4;
        y = value & 0x0f;
        result.targetPatternPosition = x * 10 + y;
        break;
      case 14:
        // Subeffects
        const subEffect = value >> 4;
        let subValue = value & 0x0f;
        switch (subEffect) {
          case 0:
            if (!this.inFTMode()) Audio.setAmigaLowPassFilter(!subValue, time);
            break;
          case 1: // Fine slide up
            subValue = subValue * -1;
            if (!subValue && this.trackEffectCache[track].fineSlide)
              subValue = this.trackEffectCache[track].fineSlide.value;
            trackEffects.slide = {
              value: subValue,
              fine: true,
            };
            this.trackEffectCache[track].fineSlide = trackEffects.slide;
            break;
          case 2: // Fine slide down
            if (!subValue && this.trackEffectCache[track].fineSlide)
              subValue = this.trackEffectCache[track].fineSlide.value;
            trackEffects.slide = {
              value: subValue,
              fine: true,
            };
            this.trackEffectCache[track].fineSlide = trackEffects.slide;
            break;
          case 3: // set glissando control
            this.trackEffectCache[track].glissando = !!subValue;
            break;
          case 4: // Set Vibrato Waveform
            switch (subValue) {
              case 1:
                this.vibratoFunction = waveFormFunction.saw;
                break;
              case 2:
                this.vibratoFunction = waveFormFunction.square;
                break;
              case 3:
                this.vibratoFunction = waveFormFunction.sine;
                break; // random
              case 4:
                this.vibratoFunction = waveFormFunction.sine;
                break; // no retrigger
              case 5:
                this.vibratoFunction = waveFormFunction.saw;
                break; // no retrigger
              case 6:
                this.vibratoFunction = waveFormFunction.square;
                break; // no retrigger
              case 7:
                this.vibratoFunction = waveFormFunction.sine;
                break; // random, no retrigger
              default:
                this.vibratoFunction = waveFormFunction.sine;
                break;
            }
            break;
          case 5: // Set Fine Tune
            if (instrumentIndex) {
              const instrument = this.getInstrument(instrumentIndex);
              trackEffects.fineTune = {
                original: instrument.getFineTune(),
                instrument: instrument,
              };
              instrument.setFineTune(subValue);
            }
            break;
          case 6: // Pattern Loop
            if (subValue) {
              this.patternLoopCount[track] = this.patternLoopCount[track] || 0;
              if (this.patternLoopCount[track] < subValue) {
                this.patternLoopCount[track]++;
                result.patternBreak = true;
                result.positionBreak = true;
                result.targetSongPosition = songPos.position; // keep on same position
                result.targetPatternPosition = this.patternLoopStart[track] || 0; // should we default to 0 if no start was set or just ignore?

                console.log(
                  "looping to " +
                    result.targetPatternPosition +
                    " for " +
                    this.patternLoopCount[track] +
                    "/" +
                    subValue
                );
              } else {
                this.patternLoopCount[track] = 0;
              }
            } else {
              console.log(
                "setting loop start to " + songPos.step + " on track " + track
              );
              this.patternLoopStart[track] = songPos.step;
            }
            break;
          case 7: // Set Tremolo WaveForm
            switch (subValue) {
              case 1:
                this.tremoloFunction = waveFormFunction.saw;
                break;
              case 2:
                this.tremoloFunction = waveFormFunction.square;
                break;
              case 3:
                this.tremoloFunction = waveFormFunction.sine;
                break; // random
              case 4:
                this.tremoloFunction = waveFormFunction.sine;
                break; // no retrigger
              case 5:
                this.tremoloFunction = waveFormFunction.saw;
                break; // no retrigger
              case 6:
                this.tremoloFunction = waveFormFunction.square;
                break; // no retrigger
              case 7:
                this.tremoloFunction = waveFormFunction.sine;
                break; // random, no retrigger
              default:
                this.tremoloFunction = waveFormFunction.sine;
                break;
            }
            break;
          case 8: // Set Panning - is this used ?
            console.warn("Set Panning - not implemented");
            break;
          case 9: // Retrigger Note
            if (subValue) {
              trackEffects.reTrigger = {
                value: subValue,
              };
            }
            break;
          case 10: // Fine volume slide up
            subValue = (subValue * 100) / 64;
            trackEffects.fade = {
              value: subValue,
              fine: true,
            };
            break;
          case 11: // Fine volume slide down
            subValue = (subValue * 100) / 64;

            trackEffects.fade = {
              value: -subValue,
              fine: true,
            };
            break;
          case 12: // Cut Note
            if (subValue) {
              if (subValue < this.ticksPerStep) {
                trackEffects.cutNote = {
                  value: subValue,
                };
              }
            } else {
              doPlayNote = false;
            }
            break;
          case 13: // Delay Sample start
            if (subValue) {
              if (subValue < this.ticksPerStep) {
                time += this.tickTime * subValue;
              } else {
                doPlayNote = false;
              }
            }
            break;
          case 14: // Pattern Delay
            result.patternDelay = subValue;
            break;
          case 15: // Invert Loop
            // Don't think is used somewhere - ignore
            break;
          default:
            console.warn("Subeffect " + subEffect + " not implemented");
        }
        break;
      case 15:
        //speed
        // Note: shouldn't this be "set speed at time" instead of setting it directly?
        // TODO: -> investigate
        // TODO: Yes ... this is actually quite wrong FIXME !!!!

        // Note 2: this hase moved to the beginning of the "row" sequence:
        // we scan all tracks for tempo changes and set them before processing any other command.
        // this is consistant with PT and FT

        //if (note.param < 32){
        //	//if (note.param == 0) note.param = 1;
        //	Tracker.setAmigaSpeed(note.param,time);
        //}else{
        //	Tracker.setBPM(note.param)
        //}
        break;

      case 16:
        //Fasttracker only - global volume
        value = Math.min(value, 64);
        if (!this.isPlugin) Audio.setMasterVolume(value / 64, time);
        break;
      case 17:
        //Fasttracker only - global volume slide

        x = value >> 4;
        y = value & 0x0f;
        const currentVolume = Audio.getLastMasterVolume() * 64;

        let amount = 0;
        let targetTime: number | undefined = undefined;
        if (x) {
          targetTime = time + x * this.tickTime;
          amount = x * (this.ticksPerStep - 1);
        } else if (y) {
          targetTime = time + y * this.tickTime;
          amount = -y * (this.ticksPerStep - 1);
        }

        if (amount) {
          value = (currentVolume + amount) / 64;
          value = Math.max(0, value);
          value = Math.min(1, value);

          Audio.slideMasterVolume(value, targetTime);
        }

        break;
      case 20:
        //Fasttracker only - Key off
        if (this.inFTMode()) {
          if (note.param && note.param >= this.ticksPerStep) {
            // ignore: delay is too large
          } else {
            doPlayNote = false;
            const offInstrument = instrument ? instrument : this.trackNotes[track] ? this.getInstrument(this.trackNotes[track].instrumentIndex) : null;
            if (offInstrument) {
              if (note.param) {
                trackEffects.noteOff = {
                  value: note.param,
                };
                doPlayNote = true;
              } else {
                volume =  this.trackNotes[track] ? offInstrument.noteOff(time, this.trackNotes[track]) : this.inFTMode() ? 100 : 0;
                defaultVolume = volume;
              }
            } else {
              console.log("no instrument on track " + track);
              defaultVolume = 0;
            }
          }
        }
        break;
      case 21:
        //Fasttracker only - Set envelope position
        console.warn("Set envelope position not implemented");
        break;
      case 25:
        //Fasttracker only - Panning slide
        console.warn("Panning slide not implemented - track " + track);
        break;
      case 27:
        //Fasttracker only - Multi retrig note
        // still not 100% sure how this is supposed to work ...
        // see https://forum.openmpt.org/index.php?topic=4999.15
        // see lupo.xm for an example (RO1 command)
        trackEffects.reTrigger = {
          value: note.param,
        };
        break;
      case 29:
        //Fasttracker only - Tremor
        console.warn("Tremor not implemented");
        break;
      case 33:
        //Fasttracker only - Extra fine porta
        console.warn("Extra fine porta not implemented");
        break;
      default:
        console.warn("unhandled effect: " + note.effect);
    }

    if (doPlayNote && instrumentIndex && notePeriod) {
      // cut off previous note on the same track;
      this.cutNote(track, time);
      this.trackNotes[track] = null;

      if (instrument) {
        this.trackNotes[track] = instrument.play(
          noteIndex,
          notePeriod,
          volume,
          track,
          trackEffects,
          time
        );
      }

      //this.trackNotes[track] = Audio.playSample(instrumentIndex,notePeriod,volume,track,trackEffects,time,noteIndex);
      this.trackEffectCache[track].defaultSlideTarget =
        this.trackNotes[track]?.startPeriod;
    }

    if (this.trackNotes[track] == null) {
      return result;
    }

    if (instrumentIndex) {
      this.trackNotes[track].instrumentIndex = instrumentIndex;

      // reset temporary instrument settings
      if (trackEffects.fineTune && trackEffects.fineTune.instrument) {
        trackEffects.fineTune.instrument.setFineTune(
          trackEffects.fineTune.original || 0
        );
      }
    }

    if (instrument && instrument.hasVibrato()) {
      this.trackNotes[track].hasAutoVibrato = true;
    }

    this.trackNotes[track].effects = trackEffects;
    //this.trackNotes[track].note = note;

    return result;
  }

  cutNote(track: number, time: number) {
    // ramp to 0 volume to avoid clicks
    try {
      if (this.trackNotes[track]?.source) {
        const gain = this.trackNotes[track].volume.gain;
        gain.setValueAtTime(
          this.trackNotes[track].currentVolume / 100,
          time - 0.002
        );
        gain.linearRampToValueAtTime(0, time);
        this.trackNotes[track].source.stop(time + 0.02);
        //trackNotes[track].source.stop(time);
      }
    } catch (e) {}
  }

  private applyAutoVibrato(trackNote: NoteInfo, currentPeriod: number): number {
    const instrument = this.getInstrument(trackNote.instrumentIndex);
    if (instrument) {
      const _freq = -instrument.vibrato.rate / 40;
      let _amp = instrument.vibrato.depth / 8;
      if (this.useLinearFrequency) _amp *= 4;
      trackNote.vibratoTimer = trackNote.vibratoTimer || 0;

      if (
        instrument.vibrato.sweep &&
        trackNote.vibratoTimer < instrument.vibrato.sweep
      ) {
        const sweepAmp =
          1 -
          (instrument.vibrato.sweep - trackNote.vibratoTimer) /
            instrument.vibrato.sweep;
        _amp *= sweepAmp;
      }
      const instrumentVibratoFunction = instrument.getAutoVibratoFunction();
      const targetPeriod = instrumentVibratoFunction(
        currentPeriod,
        trackNote.vibratoTimer,
        _freq,
        _amp
      );
      trackNote.vibratoTimer++;
      return targetPeriod;
    }
    return currentPeriod;
  }

  private applyEffects(track: number, time: number) {
    const trackNote = this.trackNotes[track];
    if (!trackNote) return;
    const effects = trackNote.effects;
    if (!effects) return;

    let value;
    let autoVibratoHandled = false;

    trackNote.startVibratoTimer = trackNote.vibratoTimer || 0;

    if (trackNote.resetPeriodOnStep && trackNote.source) {
      // vibrato or arpeggio is done
      // for slow vibratos it seems logical to keep the current frequency, but apparently most trackers revert back to the pre-vibrato one
      const targetPeriod = trackNote.currentPeriod || trackNote.startPeriod;
      this.setPeriodAtTime(trackNote, targetPeriod, time);
      trackNote.resetPeriodOnStep = false;
    }

    if (effects.volume) {
      const volume = effects.volume.value;
      if (trackNote.volume) {
        //trackNote.startVolume = volume; // apparently the startVolume is not set here but the default volume of the note is used?
        trackNote.volume.gain.setValueAtTime(volume / 100, time);
      }
      trackNote.currentVolume = volume;
    }

    if (effects.panning) {
      value = effects.panning.value;
      if (value === 255) value = 254;
      if (trackNote.panning) {
        trackNote.panning.pan.setValueAtTime((value - 127) / 127, time);
      }
    }

    if (effects.fade) {
      value = effects.fade.value;
      let currentVolume;
      let startTick = 1;

      if (effects.fade.resetOnStep) {
        currentVolume = trackNote.startVolume;
      } else {
        currentVolume = trackNote.currentVolume;
      }

      let steps = this.ticksPerStep;
      if (effects.fade.fine) {
        // fine Volume Up or Down
        startTick = 0;
        steps = 1;
      }

      for (let tick = startTick; tick < steps; tick++) {
        if (trackNote.volume) {
          trackNote.volume.gain.setValueAtTime(
            currentVolume / 100,
            time + tick * this.tickTime
          );
          currentVolume += value;
          currentVolume = Math.max(currentVolume, 0);
          currentVolume = Math.min(currentVolume, 100);
        }
      }

      trackNote.currentVolume = currentVolume;
    }

    if (effects.slide) {
      if (trackNote.source) {
        const currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
        let targetPeriod = currentPeriod;

        let steps = this.ticksPerStep;
        if (effects.slide.fine) {
          // fine Slide Up or Down
          steps = 2;
        }

        let slideValue = effects.slide.value;
        if (this.inFTMode() && this.useLinearFrequency)
          slideValue = effects.slide.value * 4;
        value = Math.abs(slideValue);

        //console.error(currentPeriod,slideValue);

        if (
          this.inFTMode() &&
          effects.slide.resetVolume &&
          (trackNote.volumeFadeOut || trackNote.volumeEnvelope)
        ) {
          // crap ... this should reset the volume envelope to the beginning ... annoying ...
          const instrument = this.getInstrument(trackNote.instrumentIndex);
          if (instrument) instrument.resetVolume(time, trackNote);
        }

        trackNote.vibratoTimer = trackNote.startVibratoTimer;

        // TODO: Why don't we use a RampToValueAtTime here ?
        for (let tick = 1; tick < steps; tick++) {
          if (effects.slide.target) {
            this.trackEffectCache[track].defaultSlideTarget = effects.slide.target;
            if (targetPeriod < effects.slide.target) {
              targetPeriod += value;
              if (targetPeriod > effects.slide.target)
                targetPeriod = effects.slide.target;
            } else {
              targetPeriod -= value;
              if (targetPeriod < effects.slide.target)
                targetPeriod = effects.slide.target;
            }
          } else {
            targetPeriod += slideValue;
            if (this.trackEffectCache[track].defaultSlideTarget)
              this.trackEffectCache[track].defaultSlideTarget += slideValue;
          }

          if (!this.inFTMode())
            targetPeriod = Audio.limitAmigaPeriod(targetPeriod);

          let newPeriod = targetPeriod;
          if (
            effects.slide.canUseGlissando &&
            this.trackEffectCache[track].glissando
          ) {
            newPeriod = Audio.getNearestSemiTone(
              targetPeriod,
              trackNote.instrumentIndex
            );
          }

          //console.error("***");
          //console.error(targetPeriod);

          if (targetPeriod !== trackNote.currentPeriod) {
            trackNote.currentPeriod = targetPeriod;

            if (trackNote.hasAutoVibrato && this.inFTMode()) {
              targetPeriod = this.applyAutoVibrato(trackNote, newPeriod);
              autoVibratoHandled = true;
            }
            this.setPeriodAtTime(trackNote, newPeriod, time + tick * this.tickTime);
          }
        }
      }
    }

    if (effects.arpeggio && trackNote.source) {
        const currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;
        let targetPeriod: number  = currentPeriod;

        trackNote.resetPeriodOnStep = true;
        trackNote.vibratoTimer = trackNote.startVibratoTimer;

        for (let tick = 0; tick < this.ticksPerStep; tick++) {
          const t = tick % 3;

          if (t == 0) targetPeriod = currentPeriod;
          if (t == 1 && effects.arpeggio.interval1)
            targetPeriod = currentPeriod - effects.arpeggio.interval1;
          if (t == 2 && effects.arpeggio.interval2)
            targetPeriod = currentPeriod - effects.arpeggio.interval2;

          if (trackNote.hasAutoVibrato && this.inFTMode()) {
            targetPeriod = this.applyAutoVibrato(trackNote, targetPeriod);
            autoVibratoHandled = true;
          }

          this.setPeriodAtTime(trackNote, targetPeriod, time + tick * this.tickTime);
        }
    }

    if (effects.vibrato || (trackNote.hasAutoVibrato && !autoVibratoHandled)) {
      effects.vibrato = effects.vibrato || { freq: 0, amplitude: 0 };
      const freq = effects.vibrato.freq;
      let amp = effects.vibrato.amplitude;
      if (this.inFTMode() && this.useLinearFrequency) amp *= 4;

      trackNote.vibratoTimer = trackNote.vibratoTimer || 0;

      if (trackNote.source && this.vibratoFunction) {
        trackNote.resetPeriodOnStep = true;
        const currentPeriod = trackNote.currentPeriod || trackNote.startPeriod;

        trackNote.vibratoTimer = trackNote.startVibratoTimer;
        for (let tick = 0; tick < this.ticksPerStep; tick++) {
          let targetPeriod = this.vibratoFunction(
            currentPeriod,
            trackNote.vibratoTimer,
            freq,
            amp
          );

          // should we add or average the 2 effects?
          if (trackNote.hasAutoVibrato && this.inFTMode()) {
            targetPeriod = this.applyAutoVibrato(trackNote, targetPeriod);
            autoVibratoHandled = true;
          } else {
            trackNote.vibratoTimer++;
          }

          // TODO: if we ever allow multiple effect on the same tick then we should rework this as you can't have concurrent "setPeriodAtTime" commands
          this.setPeriodAtTime(trackNote, targetPeriod, time + tick * this.tickTime);
        }
      }
    }

    if (this.tremoloFunction == null) {
      console.error("Missing tremolo function!")
    }
    if (effects.tremolo && this.tremoloFunction) {
      
      const freq = effects.tremolo.freq;
      const amp = effects.tremolo.amplitude;

      trackNote.tremoloTimer = trackNote.tremoloTimer || 0;

      if (trackNote.volume) {
        let _volume = trackNote.startVolume;

        for (let tick = 0; tick < this.ticksPerStep; tick++) {
          _volume = this.tremoloFunction(_volume, trackNote.tremoloTimer, freq, amp);

          if (_volume < 0) _volume = 0;
          if (_volume > 100) _volume = 100;

          trackNote.volume.gain.setValueAtTime(
            _volume / 100,
            time + tick * this.tickTime
          );
          trackNote.currentVolume = _volume;
          trackNote.tremoloTimer++;
        }
      }
    }

    if (effects.cutNote) {
      if (trackNote.volume) {
        trackNote.volume.gain.setValueAtTime(
          0,
          time + effects.cutNote.value * this.tickTime
        );
      }
      trackNote.currentVolume = 0;
    }

    if (effects.noteOff) {
      const instrument = this.getInstrument(trackNote.instrumentIndex);
      if (instrument) {
        trackNote.currentVolume = instrument.noteOff(
          time + effects.noteOff.value * this.tickTime,
          trackNote
        );
      }
    }

    if (effects.reTrigger) {
      const instrumentIndex = trackNote.instrumentIndex;
      const notePeriod = trackNote.startPeriod;
      const volume = trackNote.startVolume;
      const noteIndex = trackNote.noteIndex;

      const triggerStep = effects.reTrigger.value || 1;
      let triggerCount = triggerStep;
      while (triggerCount < this.ticksPerStep) {
        const triggerTime = time + triggerCount * this.tickTime;
        this.cutNote(track, triggerTime);
        this.trackNotes[track] = Audio.playSample(
          instrumentIndex,
          notePeriod,
          volume,
          track,
          effects,
          triggerTime,
          noteIndex
        );
        triggerCount += triggerStep;
      }
    }
  }

  setBPM(newBPM: number, sender?: {isMaster: boolean}) {
    const fromMaster = sender && sender.isMaster;
    if (this.isMaster || fromMaster) {
      console.log("set BPM: " + this.bpm + " to " + newBPM);
      if (this.clock && this.mainTimer)
        this.clock.timeStretch(Audio.context.currentTime, [this.mainTimer], this.bpm / newBPM);
      if (!fromMaster) EventBus.trigger(EVENT.songBPMChangeIgnored, this.bpm);
      this.bpm = newBPM;
      this.tickTime = 2.5 / this.bpm;
      EventBus.trigger(EVENT.songBPMChange, this.bpm);
    } else {
      EventBus.trigger(EVENT.songBPMChangeIgnored, newBPM);
    }
  };

  getBPM() {
    return this.bpm;
  };

  setAmigaSpeed(speed: number, sender?: {isMaster: boolean}) {
    // 1 tick is 0.02 seconds on a PAL Amiga
    // 4 steps is 1 beat
    // the speeds sets the amount of ticks in 1 step
    // default is 6 -> 60/(6*0.02*4) = 125 bpm

    const fromMaster = sender && sender.isMaster;
    if (this.isMaster || fromMaster) {
      //note: this changes the speed of the song, but not the speed of the main loop
      this.ticksPerStep = speed;
      EventBus.trigger(EVENT.songSpeedChange, speed);
    } else {
      EventBus.trigger(EVENT.songSpeedChangeIgnored, speed);
    }
  };

  getAmigaSpeed(): number {
    return this.ticksPerStep;
  };

  getSwing(): number {
    return this.swing;
  };

  setSwing(newSwing: number) {
    this.swing = newSwing;
  };

  getPatternLength(): number {
    return this.patternLength;
  };

  setPatternLength(value: number) {
    if (this.song == null) {
      console.error("Cannot set pattern length without a song!");
      return;
    }
    this.patternLength = value;

    const currentLength = this.song.patterns[this.currentPattern].length;
    if (currentLength === this.patternLength) return;

    if (currentLength < this.patternLength) {
      for (let step = currentLength; step < this.patternLength; step++) {
        const row = [];
        for (let channel = 0; channel < this.trackCount; channel++) {
          row.push(new Note());
        }
        this.song.patterns[this.currentPattern].push(row);
      }
    } else {
      this.song.patterns[this.currentPattern] = this.song.patterns[this.currentPattern].splice(
        0,
        this.patternLength
      );
      if (this.currentPatternPos >= this.patternLength) {
        this.setCurrentPatternPos(this.patternLength - 1);
      }
    }

    EventBus.trigger(EVENT.patternChange, this.currentPattern);
  };

  getTrackCount(): number {
    return this.trackCount;
  };

  setTrackCount(count: number) {
    this.trackCount = count;

   // for (let i = this.trackNotes.length; i <= this.trackCount; i++) this.trackNotes.push({});
    this.trackNotes = Array(this.trackNotes.length).fill(null);
    for (let i = this.trackEffectCache.length; i < this.trackCount; i++)
      this.trackEffectCache.push({});

    EventBus.trigger(EVENT.trackCountChange, this.trackCount);
  };

  getIsRecording(): boolean {
    return this.isRecording;
  };

  toggleRecord() {
    this.stop();
    this.isRecording = !this.isRecording;
    EventBus.trigger(EVENT.recordingChange, this.isRecording);
  };

  setStateAtTime(time: number, state: TrackerState) {
    this.trackerStates.push({ time: time, state: state });
  };

  getStateAtTime(time: number): TrackerState | undefined {
    let result = undefined;
    for (let i = 0, len = this.trackerStates.length; i < len; i++) {
      const state = this.trackerStates[0];
      if (state.time < time) {
        result = this.trackerStates.shift()?.state;
      } else {
        return result;
      }
    }
    return result;
  };

  getTimeStates() {
    return this.trackerStates;
  };

  setPeriodAtTime(trackNote: NoteInfo, period: number, time: number) {
    // TODO: shouldn't we always set the full samplerate from the period?

    period = Math.max(period, 1);

    let rate: number;
    if (this.inFTMode() && this.useLinearFrequency) {
      const sampleRate = 8363 * Math.pow(2, (4608 - period) / 768);
      rate = sampleRate / Audio.context.sampleRate;
    } else {
      rate = trackNote.startPeriod / period;
      rate = trackNote.startPlaybackRate * rate;
    }

    // note - seems to be a weird bug in chrome ?
    // try setting it twice with a slight delay
    // TODO: retest on Chrome windows and other browsers
    trackNote.source.playbackRate.setValueAtTime(rate, time);
    trackNote.source.playbackRate.setValueAtTime(rate, time + 0.005);
  };

  load(url: string = "/demomods/StardustMemories.mod", skipHistory: boolean = false, next?: () => void, initial: boolean = false) {
    if (url.indexOf("://") < 0 && url.indexOf("/") !== 0)
      url = Host.getBaseUrl() + url;

    if (UI) {
      UI.setInfo("");
      UI.setLoading();
    }
    const process = (result: ArrayBuffer) => {
      // initial file is overridden by a load command of the host;
      if (initial && !Host.useInitialLoad) return;

      this.processFile(result, name, (isMod) => {
        if (UI) UI.setStatus("Ready");

        if (isMod) {
          let infoUrl = "";
          let source = "";

          if (this.song == null) {
            this.new();
            if (this.song == null) {
              console.error("Tracker.load() expected Tracker.new() to initalize a new song!")
              return
            }
          }

          if (typeof url === "string") {
            if (url.indexOf("modarchive.org") > 0) {
              let id = url.split("moduleid=")[1];
              this.song.filename = id.split("#")[1] || id;
              id = id.split("#")[0];
              id = id.split("&")[0];

              source = "modArchive";
              infoUrl =
                "https://modarchive.org/index.php?request=view_by_moduleid&query=" +
                id;
              EventBus.trigger(EVENT.songPropertyChange, this.song);
            }

            if (url.indexOf("modules.pl") > 0) {
              let id = url.split("modules.pl/")[1];
              this.song.filename = id.split("#")[1] || id;
              id = id.split("#")[0];
              id = id.split("&")[0];

              source = "modules.pl";
              infoUrl = "http://www.modules.pl/?id=module&mod=" + id;
              EventBus.trigger(EVENT.songPropertyChange, this.song);
            }
          }

          if (UI) UI.setInfo(this.song.title, source, infoUrl);
        }

        if (UI && isMod && !skipHistory) {
          const path = window.location.pathname;
          const filename = path.substring(path.lastIndexOf("/") + 1);

          if (window.history.pushState) {
            window.history.pushState(
              {},
              name,
              filename + "?file=" + encodeURIComponent(url)
            );
          }
        }

        if (isMod) this.checkAutoPlay(skipHistory);
        if (next) next();
      });
    };

    let name = "";
    if (typeof url === "string") {
      name = url.substr(url.lastIndexOf("/") + 1);
      loadFile(url, (result) => {
        if (result === false) return;
        process(result);
      });
    } else {
      // TODO: url always seems to be string, consider deleting this block
     /* name = url.name || "";
      skipHistory = true;
      process(url.buffer || url); */
    }
  };

  private checkAutoPlay(skipHistory: boolean) {
    let autoPlay = getUrlParameter("autoplay");
    if (this.autoPlay) autoPlay = "1";
    if (!UI && skipHistory) autoPlay = "1";
    if (autoPlay == "true" || autoPlay == "1") {
      this.playSong();
    }
  };

  handleUpload(files: FileList) {
    console.log("file uploaded");
    if (files.length) {
      const file = files[0];

      const reader = new FileReader();
      reader.onload = () => {
        this.processFile(reader.result as ArrayBuffer, file.name, (isMod) => {
          if (UI) UI.setStatus("Ready");
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  processFile(arrayBuffer: ArrayBuffer, name: string, next?: (isMod: boolean) => void) {
    let isMod = false;
    const file = new BinaryStream(arrayBuffer, true);
    const result = FileDetector.detect(file, name);

    if (result && result.name == "ZIP") {
      console.log("extracting zip file");
      if (UI) UI.setStatus("Extracting Zip file", true);
      //if (typeof UZIP !== "undefined") {
        // using UZIP: https://github.com/photopea/UZIP.js
        const myArchive = UZIP.parse(arrayBuffer);
        console.log(myArchive);
        for (let name in myArchive) {
          this.processFile(myArchive[name].buffer, name, next);
          break; // just use first entry
        }
      /* } else {
        // if UZIP wasn't loaded use zip.js
        zip.workerScriptsPath = "script/src/lib/zip/";
        zip.useWebWorkers = Host.useWebWorkers;

        //ArrayBuffer Reader and Write additions: https://github.com/gildas-lormeau/zip.js/issues/21

        zip.createReader(
          new zip.ArrayBufferReader(arrayBuffer),
          (reader) => {
            let zipEntry;
            let size = 0;
            reader.getEntries((entries) => {
              if (entries && entries.length) {
                entries.forEach((entry) => {
                  if (entry.uncompressedSize > size) {
                    size = entry.uncompressedSize;
                    zipEntry = entry;
                  }
                });
              }
              if (zipEntry) {
                zipEntry.getData(new zip.ArrayBufferWriter(), (data) => {
                  if (data && data.byteLength) {
                    this.processFile(data, name, next);
                  }
                });
              } else {
                console.error("Zip file could not be read ...");
                if (next) next(false);
              }
            });
          },
          (error) => {
            console.error("Zip file could not be read ...");
            if (next) next(false);
          }
        );
      }*/
    }

    if (result.isMod && result.loader) {
      isMod = true;
      if (this._isPlaying) this.stop();
      this.resetDefaultSettings();

      this.song = result.loader().load(file, name);
      this.song.filename = name;

      this.onModuleLoad();
    }

    if (result.isSample) {
      // check for player only lib
      if (typeof Editor !== "undefined") {
        Editor.importSample(file, name);
      }
    }

    if (next) next(isMod);
  };

  getSong(): Song | undefined {
    return this.song;
  };

  getInstruments(): Instrument[] {
    return this.instruments;
  };

  getInstrument(index: number): Instrument {
    return this.instruments[index];
  };

  setInstrument(index: number, instrument: Instrument) {
    instrument.instrumentIndex = index;
    this.instruments[index] = instrument;
  };

  private onModuleLoad() {
    if (this.song == null) {
      console.error("Loaded module without song!")
      return;
    }
    if (UI) UI.setInfo(this.song.title);

    if (this.song.channels) this.setTrackCount(this.song.channels);

    this.prevPatternPos = undefined;
    this.prevInstrumentIndex = undefined;
    this.prevPattern = undefined;
    this.prevSongPosition = undefined;

    this.setCurrentSongPosition(0);
    this.setCurrentPatternPos(0);
    this.setCurrentInstrumentIndex(1);

    this.clearEffectCache();

    EventBus.trigger(EVENT.songLoaded, this.song);
    EventBus.trigger(EVENT.songPropertyChange, this.song);
  }

  private resetDefaultSettings() {
    EventBus.trigger(EVENT.songBPMChangeIgnored, 0);
    EventBus.trigger(EVENT.songSpeedChangeIgnored, 0);
    this.setAmigaSpeed(6);
    this.setBPM(125);

    this.vibratoFunction = waveFormFunction.sine;
    this.tremoloFunction = waveFormFunction.sine;

    //this.trackEffectCache = [];
    this.trackEffectCache = Array(this.trackCount);
    //this.trackNotes = [];
    this.trackNotes = Array(this.trackCount).fill(null);
    /*for (let i = 0; i < this.trackCount; i++) {
      this.trackNotes.push({});
      this.trackEffectCache.push({});
    }*/
    this.trackEffectCache = Array(this.trackCount);
    this.useLinearFrequency = false;
    this.setTrackerMode(TRACKERMODE.PROTRACKER, true);
    if (!this.isPlugin) Audio.setMasterVolume(1);
    Audio.setAmigaLowPassFilter(false, 0);
    if (typeof StateManager !== "undefined") StateManager.clear();
  }

  clearEffectCache() {
     this.trackEffectCache = [];

    for (let i = 0; i < this.trackCount; i++) {
       this.trackEffectCache.push({});
    }
  };

  clearInstruments(count?: number) {
    if (!this.song) return;
    const instrumentContainer = [];
    const max = count || this.song.instruments.length - 1;
    this.instruments = [];
    for (let i = 1; i <= max; i++) {
      this.setInstrument(i, new Instrument());
      instrumentContainer.push({ label: i + " ", data: i, index: i });
    }
    this.song.instruments = this.instruments;

    EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);
    EventBus.trigger(EVENT.instrumentChange, this.currentInstrumentIndex);
  };

  setTrackerMode(mode: TRACKERMODE, force: boolean) {
    let doChange = () => {
      this.trackerMode = mode;
      Settings.emulateProtracker1OffsetBug = !this.inFTMode();
      EventBus.trigger(EVENT.trackerModeChanged, mode);
    };

    //do some validation when changing from FT to MOD
    if (mode === TRACKERMODE.PROTRACKER && !force) {
      if (this.getInstruments().length > 32) {
        UI.showDialog(
          "WARNING !!!//This file has more than 31 instruments./If you save this file as .MOD, only the first 31 instruments will be included.//Are you sure you want to continue?",
          () => {
            doChange();
          },
          () => {}
        );
      } else {
        doChange();
      }
    } else {
      doChange();
    }
  };
  getTrackerMode() {
    return this.trackerMode;
  };
  inFTMode() {
    return this.trackerMode === TRACKERMODE.FASTTRACKER;
  };

  new() {
    this.resetDefaultSettings();
    
    this.clearInstruments(31);

    const patternTable = [];
    for (let i = 0; i < 128; ++i) {
      patternTable[i] = 0;
    }

    this.song = {
      typeId: "M.K.",
      title: "new song",
      length: 1,
      restartPosition: 0,
      patterns: [this.getEmptyPattern()],
      instruments: [],
      patternTable: patternTable,
    };

    this.onModuleLoad();
  };

  private clearInstrument() {
    this.instruments[this.currentInstrumentIndex] = new Instrument();
    EventBus.trigger(EVENT.instrumentChange, this.currentInstrumentIndex);
    EventBus.trigger(EVENT.instrumentNameChange, this.currentInstrumentIndex);
  };

  getFileName(): string {
    if (this.song == null) {
      console.error("Cannot get the file name of the loaded song without a song loaded!");
      return "new.mod";
    }
    return (
      this.song.filename ||
      (this.song.title
        ? this.song.title.replace(/ /g, "-").replace(/\W/g, "") + ".mod"
        : "new.mod")
    );
  };

  private getEmptyPattern(): Pattern {
    const result = [];
    for (let step = 0; step < this.patternLength; step++) {
      const row = [];
      for (let channel = 0; channel < this.trackCount; channel++) {
        row.push(new Note());
      }
      result.push(row);
    }
    return result;
  }

};

export default new Tracker();
