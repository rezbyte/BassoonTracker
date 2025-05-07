import { EVENT, MODULETYPE, TRACKERMODE } from "./enum";
import EventBus from "./eventBus";
import Tracker from "./tracker";
import StateManager, { UndoWithValue } from "./ui/stateManager";
import Note from "./models/note";
import Audio from "./audio";
import audioBufferToWav from "./lib/audioBufferToWav";
import saveAs from "file-saver";
import Logger from "./log";
import { detectSampleType } from "./audio/detectSampleType";
import { BinaryStream } from "./filesystem";
import { UI } from "./ui/main";
import Instrument from "./models/instrument";
import { getUrlParameter } from "./lib/util";
import Host from "./host";
import BassoonProvider from "./provider/bassoon";
import { ModalDialog } from "./ui/components/modalDialog";
import FastTracker from "./fileformats/fasttracker";
import ProTracker from "./fileformats/protracker";
import Dropbox from "./provider/dropbox";
import { Pattern } from "./models/song";
import Settings from "./settings";

class Editor {
  private currentTrack = 0;
  private currentTrackPosition = 0;
  private currentCursorPosition = 0;
  private prevCursorPosition?: number;
  private currentPattern = 0;
  private currentPatternPos = 0;
  private pasteBuffer: { track: Note[]; pattern: Pattern } = {
    track: [],
    pattern: [],
  };

  constructor() {
    const editor = this;
    EventBus.on(EVENT.trackerModeChanged, () => {
      editor.setCurrentTrackPosition(0);
    });

    EventBus.on(EVENT.patternChange, (pattern: number) => {
      editor.currentPattern = pattern;
    });

    EventBus.on(EVENT.patternPosChange, (positions) => {
      editor.currentPatternPos = positions.current;
    });

    EventBus.on(EVENT.trackCountChange, (trackCount: number) => {
      const max = trackCount * editor.getStepsPerTrack();
      if (editor.currentCursorPosition >= max)
        editor.setCurrentTrack(trackCount - 1);
    });
  }

  getStepsPerTrack(): 8 | 6 {
    return Tracker.inFTMode() ? 8 : 6;
  }

  setCurrentCursorPosition(index: number) {
    this.currentCursorPosition = index;

    const stepsPerTrack = this.getStepsPerTrack();

    this.currentTrack = Math.floor(this.currentCursorPosition / stepsPerTrack);
    this.currentTrackPosition = this.currentCursorPosition % stepsPerTrack;
    if (this.prevCursorPosition !== this.currentCursorPosition) {
      EventBus.trigger(EVENT.cursorPositionChange, this.currentCursorPosition);
    }
    this.prevCursorPosition = this.currentCursorPosition;
  }
  getCurrentCursorPosition(): number {
    return this.currentCursorPosition;
  }
  moveCursorPosition(amount: number) {
    const stepsPerTrack = this.getStepsPerTrack();

    let newPosition = this.currentCursorPosition + amount;
    const max = Tracker.getTrackCount() * stepsPerTrack - 1;
    if (newPosition > max) newPosition = 0;
    if (newPosition < 0) newPosition = max;
    this.setCurrentCursorPosition(newPosition);
  }
  getCurrentTrack(): number {
    return this.currentTrack;
  }
  setCurrentTrack(track: number) {
    const stepsPerTrack = this.getStepsPerTrack();
    this.setCurrentCursorPosition(
      track * stepsPerTrack + this.currentTrackPosition,
    );
  }
  getCurrentTrackPosition(): number {
    return this.currentTrackPosition;
  }
  setCurrentTrackPosition(position: number) {
    const stepsPerTrack = this.getStepsPerTrack();
    this.setCurrentCursorPosition(this.currentTrack * stepsPerTrack + position);
  }

  putNote(
    instrument: number,
    period: number,
    noteIndex?: number,
    volume?: number,
  ) {
    const song = Tracker.getSong();
    if (song == null) {
      console.error("Need a song loaded to insert a note!");
      return;
    }
    const note =
      song.patterns[this.currentPattern][this.currentPatternPos][
        this.currentTrack
      ] || new Note();
    const editAction = StateManager.createNoteUndo(
      this.currentPattern,
      this.currentTrack,
      this.currentPatternPos,
      note,
    );

    if (note) {
      note.instrument = instrument;
      if (noteIndex) {
        note.setIndex(noteIndex);
      } else {
        note.setPeriod(period);
      }
      if (typeof volume === "number") {
        if (Tracker.inFTMode()) {
          note.volumeEffect = volume + 16;
        } else {
          note.effect = 12;
          note.param = volume;
        }
      }
    }

    editAction.data[0].to = note.duplicate();
    StateManager.registerEdit(editAction);

    song.patterns[this.currentPattern][this.currentPatternPos][
      this.currentTrack
    ] = note;
    EventBus.trigger(EVENT.patternChange, this.currentPattern);
  }

  putNoteParam(pos: number, value: number) {
    const song = Tracker.getSong();
    if (song == null) {
      console.error("Need a song loaded to insert note parameters!");
      return;
    }
    let x, y;
    const note =
      song.patterns[this.currentPattern][this.currentPatternPos][
        this.currentTrack
      ];
    const editAction = StateManager.createNoteUndo(
      this.currentPattern,
      this.currentTrack,
      this.currentPatternPos,
      note,
    );
    if (note) {
      if (pos == 1 || pos == 2) {
        const instrument = note.instrument;
        x = instrument >> 4;
        y = instrument & 0x0f;
        if (pos == 1) x = value;
        if (pos == 2) y = value;
        note.instrument = (x << 4) + y;
      }

      let xmOffset = 0;
      if (Tracker.inFTMode()) {
        xmOffset = 2;

        if (pos == 3 || pos == 4) {
          const vparam = note.volumeEffect;
          x = vparam >> 4 || 1;
          y = vparam & 0x0f;
          if (pos == 3) x = value + 1;
          if (pos == 4) y = value;
          note.volumeEffect = (x << 4) + y;
          if (note.volumeEffect < 16) {
            note.volumeEffect = 0;
          }
        }
      }

      if (pos == 3 + xmOffset) note.effect = value;
      if (pos == 4 + xmOffset || pos == 5 + xmOffset) {
        const param = note.param;
        x = param >> 4;
        y = param & 0x0f;
        if (pos == 4 + xmOffset) x = value;
        if (pos == 5 + xmOffset) y = value;
        note.param = (x << 4) + y;
      }
    }

    editAction.data[0].to = note.duplicate();
    StateManager.registerEdit(editAction);

    song.patterns[this.currentPattern][this.currentPatternPos][
      this.currentTrack
    ] = note;
    EventBus.trigger(EVENT.patternChange, this.currentPattern);
  }

  clearTrack() {
    const song = Tracker.getSong();
    const currentPatternData = Tracker.getCurrentPatternData();
    if (song == null || currentPatternData == null) {
      console.error("Cannot clear track without a song loaded to clear from!");
      return;
    }
    const length = currentPatternData.length;
    const editAction = StateManager.createTrackUndo(this.currentPattern);
    editAction.name = "Clear Track";
    for (let i = 0; i < length; i++) {
      const note = song.patterns[this.currentPattern][i][this.currentTrack];
      if (note) {
        StateManager.addNote(editAction, this.currentTrack, i, note);
        note.clear();
      }
    }
    StateManager.registerEdit(editAction);
    EventBus.trigger(EVENT.patternChange, this.currentPattern);
  }
  clearPattern() {
    const song = Tracker.getSong();
    const currentPatternData = Tracker.getCurrentPatternData();
    if (song == null || currentPatternData == null) {
      console.error("Cannot clear track without a song loaded to clear from!");
      return;
    }
    const length = currentPatternData.length;
    const editAction = StateManager.createPatternUndo(this.currentPattern);
    editAction.name = "Clear Pattern";
    for (let i = 0; i < length; i++) {
      for (let j = 0; j < Tracker.getTrackCount(); j++) {
        const note = song.patterns[this.currentPattern][i][j];
        if (note) {
          StateManager.addNote(editAction, j, i, note);
          note.clear();
        }
      }
    }
    StateManager.registerEdit(editAction);
    EventBus.trigger(EVENT.patternChange, this.currentPattern);
  }
  clearSong() {
    const song = Tracker.getSong();
    if (song == null) return;
    Tracker.setCurrentPattern(0);
    this.clearPattern();
    const pattern = song.patterns[0];

    song.patterns = [pattern];
    song.length = 1;
    song.restartPosition = 0;

    const patternTable = [];
    for (let i = 0; i < 128; ++i) {
      patternTable[i] = 0;
    }
    song.patternTable = patternTable;

    Tracker.setAmigaSpeed(6);
    Tracker.setBPM(125);
    Tracker.setCurrentSongPosition(1);

    EventBus.trigger(EVENT.songPropertyChange, song);
    EventBus.trigger(EVENT.patternTableChange);
  }

  copyTrack(trackNumber: undefined): undefined;
  copyTrack(trackNumber: number): Note[];
  copyTrack(trackNumber: number | undefined): Note[] | undefined {
    const song = Tracker.getSong();
    const currentPatternData = Tracker.getCurrentPatternData();
    if (song == null || currentPatternData == null) {
      console.error("Cannot copy track from song because no song is loaded!");
      return;
    }
    const hasTracknumber = typeof trackNumber != "undefined";
    if (!hasTracknumber) trackNumber = this.currentTrack;
    const length = currentPatternData.length;
    const data = [];

    for (let i = 0; i < length; i++) {
      const note =
        song.patterns[this.currentPattern][i][trackNumber!] || new Note();
      data.push(note.duplicate());
    }
    if (hasTracknumber) {
      return data;
    } else {
      this.pasteBuffer.track = data;
    }
  }

  copyPattern() {
    const data = [];

    for (let j = 0; j < Tracker.getTrackCount(); j++) {
      const row = this.copyTrack(j);
      data.push(row);
    }
    this.pasteBuffer.pattern = data;
  }

  getPasteData() {
    return this.pasteBuffer;
  }

  pasteTrack(
    trackNumber?: number,
    trackData?: Note[],
    parentEditAction?: UndoWithValue,
  ): boolean {
    const song = Tracker.getSong();
    const currentPatternData = Tracker.getCurrentPatternData();
    if (song == null || currentPatternData == null) {
      console.error("Cannot paste track to song because no song is loaded!");
      return false;
    }
    const withoutTracknumber = trackNumber === undefined;
    trackNumber = trackNumber === undefined ? this.currentTrack : trackNumber;
    const data = withoutTracknumber ? this.pasteBuffer.track : trackData;
    if (data) {
      let editAction: UndoWithValue;
      if (parentEditAction) {
        editAction = parentEditAction;
      } else {
        editAction = StateManager.createTrackUndo(this.currentPattern);
        editAction.name = "Paste Track";
      }
      const length = currentPatternData.length;
      const patternData = song.patterns[this.currentPattern];
      for (let i = 0; i < length; i++) {
        let note = patternData[i][trackNumber];
        if (!note) {
          note = new Note();
          patternData[i][trackNumber] = note;
        }
        const source = data[i];
        const noteInfo = StateManager.addNote(editAction, trackNumber, i, note);
        noteInfo.to = source; // should we duplicate source?
        note.populate(source);
      }

      if (withoutTracknumber)
        EventBus.trigger(EVENT.patternChange, this.currentPattern);
      if (!parentEditAction) {
        StateManager.registerEdit(editAction);
      }
      return true;
    } else {
      return false;
    }
  }

  pastePattern(): boolean {
    const data = this.pasteBuffer.pattern;
    if (data) {
      const editAction = StateManager.createPatternUndo(this.currentPattern);
      editAction.name = "Paste Pattern";
      for (let j = 0; j < Tracker.getTrackCount(); j++) {
        this.pasteTrack(j, data[j], editAction);
      }
      StateManager.registerEdit(editAction);
      EventBus.trigger(EVENT.patternChange, this.currentPattern);
      return true;
    } else {
      return false;
    }

    // const length = Tracker.getCurrentPatternData().length;

    // editAction.name = "Clear Pattern";
    // for (const i = 0; i < length; i++) {
    //   for (const j = 0; j < Tracker.getTrackCount(); j++) {
    //     const note = Tracker.getSong().patterns[currentPattern][i][j];
    //     if (note) {
    //       StateManager.addNote(editAction, j, i, note);
    //       note.clear();
    //     }
    //   }
    // }
    // StateManager.registerEdit(editAction);
    // EventBus.trigger(EVENT.patternChange, currentPattern);
  }

  insertNote() {
    const song = Tracker.getSong();
    if (song == null) {
      console.error("Cannot insert note into song because no song is loaded!");
      return false;
    }
    const end = song.patterns[this.currentPattern].length - 2;
    const start = this.currentPatternPos;

    for (let i = end; i >= start; i--) {
      const from = song.patterns[this.currentPattern][i][this.currentTrack];
      const to = song.patterns[this.currentPattern][i + 1][this.currentTrack];

      to.instrument = from.instrument;
      to.period = from.period;
      to.effect = from.effect;
      to.volumeEffect = from.volumeEffect;
      to.param = from.param;
      to.index = from.index;
    }

    const from =
      song.patterns[this.currentPattern][this.currentPatternPos][
        this.currentTrack
      ];
    if (from) from.clear();

    EventBus.trigger(EVENT.patternChange, this.currentPattern);
  }

  removeNote(track?: number, step?: number) {
    const song = Tracker.getSong();
    if (song == null) {
      console.error("Cannot remove a note when no song is loaded!");
      return;
    }

    if (typeof track === "undefined") track = this.currentTrack;
    if (typeof step === "undefined") step = this.currentPatternPos;

    if (step === 0) return;

    const start = step;
    const end = song.patterns[this.currentPattern].length - 1;

    for (let i = start; i <= end; i++) {
      const from = song.patterns[this.currentPattern][i][track];
      const to = song.patterns[this.currentPattern][i - 1][track];

      to.instrument = from.instrument;
      to.period = from.period;
      to.effect = from.effect;
      to.volumeEffect = from.volumeEffect;
      to.param = from.param;
      to.index = from.index;
    }

    const from = song.patterns[this.currentPattern][end][track];
    if (from) from.clear();

    EventBus.trigger(EVENT.patternChange, this.currentPattern);
  }

  addToPatternTable(index?: number, patternIndex?: number) {
    const song = Tracker.getSong();
    if (song == null) {
      console.error("Cannot add to the pattern table without a song loaded!");
      return;
    }
    if (typeof index == "undefined") index = song.length;
    patternIndex = patternIndex || 0;

    if (index === song.length) {
      song.patternTable[index] = patternIndex;
      song.length++;
    } else {
      for (let i = song.length; i > index; i--) {
        song.patternTable[i] = song.patternTable[i - 1];
      }
      song.patternTable[index] = patternIndex;
      song.length++;
    }

    EventBus.trigger(EVENT.songPropertyChange, song);
    EventBus.trigger(EVENT.patternTableChange);
  }

  removeFromPatternTable(index?: number) {
    const song = Tracker.getSong();
    if (song == null) {
      console.error(
        "Cannot remove a pattern from the pattern table without a song loaded!",
      );
      return;
    }
    if (song.length < 2) return;
    if (typeof index == "undefined") index = song.length - 1;

    if (index === song.length - 1) {
      song.patternTable[index] = 0;
      song.length--;
    } else {
      for (let i = index; i < song.length; i++) {
        song.patternTable[i] = song.patternTable[i + 1];
      }
      song.length--;
    }

    const currentSongPosition = Tracker.getCurrentSongPosition();
    if (currentSongPosition === song.length) {
      Tracker.setCurrentSongPosition(currentSongPosition - 1);
    }

    EventBus.trigger(EVENT.songPropertyChange, song);
    EventBus.trigger(EVENT.patternTableChange);
  }

  renderTrackToBuffer(fileName?: string, target?: string) {
    // TODO: timing is off when not played first?
    // TODO: when rendering to sample - we should switch to mono first

    const song = Tracker.getSong();
    const currentPatternData = Tracker.getCurrentPatternData();
    if (song == null || currentPatternData == null) {
      console.error("Need a song loaded to render a track to buffer!");
      return;
    }
    let step = 0;
    let patternStep = Tracker.getCurrentSongPosition();
    let thisPatternLength = currentPatternData.length;

    // apparently needs some leading time, otherwise the first note is not rendered.
    let time = 0.1;

    const props = Tracker.getProperties();
    const ticksPerStep = props.ticksPerStep;
    const tickTime = props.tickTime;

    let patternCount = 1;

    patternStep = 0;

    const maxPosition = Math.min(patternStep + patternCount, song.length);
    patternCount = maxPosition - patternStep;

    // TODO - we should first calculate the real length of the pattern, scanning all tempo changes.
    const length =
      ticksPerStep * tickTime * thisPatternLength * patternCount + 0.2;
    Audio.startRendering(length);

    while (patternStep < maxPosition) {
      console.log("rendering step " + patternStep);
      const patternIndex = song.patternTable[patternStep];
      const currentPatternData = song.patterns[patternIndex];
      thisPatternLength = currentPatternData.length;

      while (step < thisPatternLength) {
        Tracker.playPatternStep(step, time, currentPatternData, 0);
        time += ticksPerStep * tickTime;
        step++;
      }
      step = 0;
      patternStep++;
    }

    Audio.stopRendering((renderedBuffer) => {
      // TODO cutoff the first 0.1 seconds -> start time

      const saveToFile = false;

      // save to wav
      if (saveToFile) {
        const result = audioBufferToWav(renderedBuffer);
        const b = new Blob([result], { type: "octet/stream" });
        fileName =
          fileName ||
          song.title.replace(/ /g, "-").replace(/\W/g, "") + ".wav" ||
          "module-export.wav";

        //if (target === "dropbox"){
        //	Dropbox.putFile("/" + fileName,b);
        //}else{
        saveAs(b, fileName);
        //}
      } else {
        this.buffer2Sample(renderedBuffer);
      }
    });
  }

  save(filename: string | undefined, target: string | ((b: Blob) => void)) {
    UI.setStatus("Exporting ...", true);
    this.buildBinary(
      Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,
      (file) => {
        const b = new Blob([file.buffer], { type: "application/octet-stream" });

        const fileName = filename || Tracker.getFileName();

        if (typeof target === "function") {
          target(b);
          return;
        }

        if (target === "dropbox") {
          Logger.info("save to dropbox " + fileName);
          Dropbox.putFile("/" + fileName, b, (success: boolean) => {
            if (success) {
              UI.setStatus("");
            } else {
              UI.setStatus("Error while saving to Dropbox ...");
            }
          });
        } else {
          Logger.info("save " + fileName);
          saveAs(b, fileName);
          UI.setStatus("");
        }
      },
    );
  }

  importSample(file: BinaryStream, name: string) {
    console.log(
      "Reading instrument " +
        name +
        " with length of " +
        file.length +
        " bytes to index " +
        Tracker.getCurrentInstrumentIndex(),
    );

    const instrument = Tracker.getCurrentInstrument() || new Instrument();

    instrument.name = name;
    instrument.sample.length = file.length;
    instrument.sample.loop.start = 0;
    instrument.sample.loop.length = 0;
    instrument.setFineTune(0);
    instrument.sample.volume = 64;
    instrument.sample.data = [];
    instrument.sample.name = name;

    detectSampleType(file, instrument.sample, () => {
      // some decoders are async: retrigger event on callback
      EventBus.trigger(
        EVENT.instrumentChange,
        Tracker.getCurrentInstrumentIndex(),
      );
      EventBus.trigger(
        EVENT.instrumentNameChange,
        Tracker.getCurrentInstrumentIndex(),
      );
      checkSample();
    });

    EventBus.trigger(
      EVENT.instrumentChange,
      Tracker.getCurrentInstrumentIndex(),
    );
    EventBus.trigger(
      EVENT.instrumentNameChange,
      Tracker.getCurrentInstrumentIndex(),
    );

    function checkSample() {
      if (Tracker.getTrackerMode() === TRACKERMODE.PROTRACKER) {
        // max sampleLength is 1FFFE
        if (instrument.sample.length > 131070) {
          const dialog = new ModalDialog();
          dialog.setProperties({
            width: UI.mainPanel?.width,
            height: UI.mainPanel?.height,
            top: 0,
            left: 0,
            ok: true,
          });
          dialog.onClick = dialog.close;

          dialog.setText(
            "Warning//The maximum sample length in .MOD format is 128kb//If you save in .MOD format/this sample will be truncated.//Please try downsampling or trimming the sample/to below 131072 bytes/or switch to .XM format",
          );

          UI.setModalElement(dialog);
        }
      }
    }
  }

  buffer2Sample(buffer: AudioBuffer) {
    const instrument = Tracker.getCurrentInstrument() || new Instrument();
    const name = "pattern " + Tracker.getCurrentPattern();
    instrument.name = name;
    instrument.sample.loop.start = 0;
    instrument.sample.loop.length = 0;
    instrument.setFineTune(0);
    instrument.sample.volume = 64;
    instrument.sample.name = name;

    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const data = buffer.getChannelData(0); // TODO: mix stereo;

    instrument.sample.data = [];

    // downsample to ... 22050 ... 11025 ?
    const leadingTimeCount = Math.floor(Audio.context.sampleRate / 10);

    // TODO - is creating a fixed length Float32Array faster ?
    for (let i = leadingTimeCount, len = data.length; i < len; i += 4) {
      instrument.sample.data.push(data[i]);
    }
    instrument.sample.length = instrument.sample.data.length;

    EventBus.trigger(
      EVENT.instrumentChange,
      Tracker.getCurrentInstrumentIndex(),
    );
    EventBus.trigger(
      EVENT.instrumentNameChange,
      Tracker.getCurrentInstrumentIndex(),
    );
  }

  // returns a binary stream
  buildBinary(type: MODULETYPE, next: (file: BinaryStream) => void) {
    type = type || MODULETYPE.mod;
    let writer: ProTracker | FastTracker | null = null;

    if (type === MODULETYPE.mod) {
      writer = new ProTracker();
    }

    if (type === MODULETYPE.xm) {
      writer = new FastTracker();
    }

    if (writer) writer.write(next);
  }

  loadInitialFile() {
    // load demo mod at startup
    //Tracker.load('/demomods/spacedeb.mod');

    let initialFile: string | null = null;
    const rawInitialFile = getUrlParameter("file");
    if (rawInitialFile && typeof rawInitialFile !== "boolean") {
      initialFile = decodeURIComponent(rawInitialFile);

      if (
        initialFile.substr(0, 7).toLowerCase() === "http://" &&
        document.location.protocol === "https:"
      ) {
        // proxy plain HTTP requests as this won't work over HTTPS
        initialFile = BassoonProvider.proxyUrl(initialFile);
      } else if (initialFile.substr(0, 6).toLowerCase() === "proxy/") {
        initialFile = BassoonProvider.proxyUrl(initialFile.substr(6));
      }
    } else {
      if (Settings.loadInitialFile)
        initialFile = Host.getBaseUrl() + "/demomods/Tinytune.mod";
    }
    if (initialFile) Tracker.load(initialFile, true, undefined, true);
  }
}

export default new Editor();
