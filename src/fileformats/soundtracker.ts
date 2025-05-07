import { EVENT, LOOPTYPE, TRACKERMODE } from "../enum";
import { BinaryStream } from "../filesystem";
import FileFormat from "./fileformat";
import EventBus from "../eventBus";
import Tracker from "../tracker";
import Song, { Pattern } from "../models/song";
import Instrument from "../models/instrument";
import Note from "../models/note";

export default class SoundTracker implements FileFormat {
  load(file: BinaryStream): Song {
    Tracker.setTrackerMode(TRACKERMODE.PROTRACKER, true);
    Tracker.useLinearFrequency = false;
    Tracker.clearInstruments(15);

    const patternLength = 64;
    const instrumentCount = 15;

    //see https://www.aes.id.au/modformat.html
    // and ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt for differences

    const typeId = "ST";
    const channels = 4;
    const title = file.readString(20, 0);

    let sampleDataOffset = 0;
    for (let i = 1; i <= instrumentCount; ++i) {
      const sampleName = file.readString(22);
      const sampleLength = file.readWord(); // in words

      const instrument = new Instrument();
      instrument.name = sampleName;

      instrument.sample.length = instrument.realLen = sampleLength << 1;
      instrument.sample.volume = file.readWord();
      // NOTE: does the high byte of the volume sometimes contain finetune data?
      instrument.setFineTune(0);
      instrument.sample.loop.start = file.readWord(); // in bytes!
      instrument.sample.loop.length = file.readWord() << 1;

      instrument.sample.loop.enabled = instrument.sample.loop.length > 2;
      instrument.sample.loop.type = LOOPTYPE.FORWARD;

      // if an instrument contains a loops, only the loop part is played
      // TODO

      instrument.pointer = sampleDataOffset;
      sampleDataOffset += instrument.sample.length;
      instrument.setSampleIndex(0);
      Tracker.setInstrument(i, instrument);
    }
    const instruments = Tracker.getInstruments();

    file.goto(470);

    const length = file.readUbyte();
    const speed = file.readUbyte();

    const patternTable = [];
    let highestPattern = 0;
    for (let i = 0; i < 128; ++i) {
      patternTable[i] = file.readUbyte();
      if (patternTable[i] > highestPattern) highestPattern = patternTable[i];
    }
    //patternTable = patternTable;

    file.goto(600);

    // pattern data
    const patterns: Pattern[] = [];
    for (let i = 0; i <= highestPattern; ++i) {
      const patternData: Pattern = [];

      for (let step = 0; step < patternLength; step++) {
        const row: Note[] = [];
        for (let channel = 0; channel < 4; channel++) {
          const trackStepInfo = file.readUint();

          const note = new Note();
          note.period = (trackStepInfo >> 16) & 0x0fff;
          note.effect = (trackStepInfo >> 8) & 0x0f;
          note.instrument =
            ((trackStepInfo >> 24) & 0xf0) | ((trackStepInfo >> 12) & 0x0f);
          note.param = trackStepInfo & 0xff;

          row.push(note);
        }

        // fill with empty data for other channels
        for (let channel = 4; channel < Tracker.getTrackCount(); channel++) {
          row.push(new Note());
        }

        patternData.push(row);
      }
      patterns.push(patternData);

      //file.jump(1024);
    }

    const instrumentContainer = [];

    for (let i = 1; i <= instrumentCount; i++) {
      const instrument = Tracker.getInstrument(i);
      if (instrument) {
        console.log(
          "Reading sample from 0x" +
            file.index +
            " with length of " +
            instrument.sample.length +
            " bytes and repeat length of " +
            instrument.sample.loop.length,
        );

        const sampleEnd = instrument.sample.length;

        for (let j = 0; j < sampleEnd; j++) {
          let b = file.readByte();
          // ignore first 2 bytes
          if (j < 2) b = 0;
          instrument.sample.data.push(b / 127);
        }

        instrumentContainer.push({
          label: i + " " + instrument.name,
          data: i,
          index: i - 1,
        });
      }
    }
    EventBus.trigger(EVENT.instrumentListChange, instrumentContainer);

    return {
      typeId,
      channels,
      title,
      instruments,
      length,
      speed,
      patternTable,
      patterns,
      restartPosition: 1,
    };
  }
}
