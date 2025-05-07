import { BinaryStream } from "../filesystem";
import FileFormat from "./fileformat";
import Tracker from "../tracker";
import { UI } from "../ui/main";
import Song, { Pattern } from "../models/song";
import Note from "../models/note";
import Instrument from "../models/instrument";
import { EVENT, LOOPTYPE, TRACKERMODE } from "../enum";
import EventBus from "../eventBus";
import Settings from "../settings";

export default class ProTracker implements FileFormat {
  load(file: BinaryStream, name: string): Song {
    Tracker.setTrackerMode(TRACKERMODE.PROTRACKER, true);
    Tracker.useLinearFrequency = false;
    Tracker.clearInstruments(31);

    const patternLength = 64;
    const instrumentCount = 31;
    let channelCount = 4;

    //see https://www.aes.id.au/modformat.html

    const typeId = file.readString(4, 1080);
    const title = file.readString(20, 0);

    if (typeId === "2CHN") channelCount = 2;
    if (typeId === "3CHN") channelCount = 3;
    if (typeId === "5CHN") channelCount = 5;
    if (typeId === "6CHN") channelCount = 6;
    if (typeId === "7CHN") channelCount = 7;
    if (typeId === "8CHN") channelCount = 8;
    if (typeId === "9CHN") channelCount = 9;
    if (typeId === "10CH") channelCount = 10;
    if (typeId === "11CH") channelCount = 11;
    if (typeId === "12CH") channelCount = 12;
    if (typeId === "13CH") channelCount = 13;
    if (typeId === "14CH") channelCount = 14;
    if (typeId === "15CH") channelCount = 15;
    if (typeId === "16CH") channelCount = 16;
    if (typeId === "18CH") channelCount = 18;
    if (typeId === "20CH") channelCount = 20;
    if (typeId === "22CH") channelCount = 22;
    if (typeId === "24CH") channelCount = 24;
    if (typeId === "26CH") channelCount = 26;
    if (typeId === "28CH") channelCount = 28;
    if (typeId === "30CH") channelCount = 30;
    if (typeId === "32CH") channelCount = 32;

    const channels = channelCount;

    let sampleDataOffset = 0;
    for (let i = 1; i <= instrumentCount; ++i) {
      const instrumentName = file.readString(22);
      const sampleLength = file.readWord(); // in words

      const instrument = new Instrument();
      instrument.name = instrumentName;

      instrument.sample.length = instrument.sample.realLen = sampleLength << 1;
      let finetune = file.readUbyte();
      if (finetune > 16) finetune = finetune % 16;
      if (finetune > 7) finetune -= 16;
      instrument.setFineTune(finetune);
      instrument.sample.volume = file.readUbyte();
      instrument.sample.loop.start = file.readWord() << 1;
      instrument.sample.loop.length = file.readWord() << 1;

      instrument.sample.loop.enabled = instrument.sample.loop.length > 2;
      instrument.sample.loop.type = LOOPTYPE.FORWARD;

      instrument.pointer = sampleDataOffset;
      sampleDataOffset += instrument.sample.length;
      instrument.setSampleIndex(0);
      Tracker.setInstrument(i, instrument);
    }
    const instruments = Tracker.getInstruments();

    file.goto(950);
    const length = file.readUbyte();
    file.jump(1); // 127 byte

    let patternTable = [];
    let highestPattern = 0;
    for (let i = 0; i < 128; ++i) {
      patternTable[i] = file.readUbyte();
      if (patternTable[i] > highestPattern) highestPattern = patternTable[i];
    }
    patternTable = patternTable;

    file.goto(1084);

    // pattern data
    const patterns: Pattern[] = [];
    for (let i = 0; i <= highestPattern; ++i) {
      const patternData = [];

      for (let step = 0; step < patternLength; step++) {
        const row = [];
        let channel;
        for (channel = 0; channel < channelCount; channel++) {
          const note = new Note();
          const trackStepInfo = file.readUint();

          note.setPeriod((trackStepInfo >> 16) & 0x0fff);
          note.effect = (trackStepInfo >> 8) & 0x0f;
          note.instrument =
            ((trackStepInfo >> 24) & 0xf0) | ((trackStepInfo >> 12) & 0x0f);
          note.param = trackStepInfo & 0xff;

          row.push(note);
        }

        // fill with empty data for other channels
        // TODO: not needed anymore ?
        for (
          channel = channelCount;
          channel < Tracker.getTrackCount();
          channel++
        ) {
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

        let sampleEnd = instrument.sample.length;

        if (
          instrument.sample.loop.length > 2 &&
          Settings.unrollShortLoops &&
          instrument.sample.loop.length < 1000
        ) {
          // cut off trailing bytes for short looping samples
          sampleEnd = Math.min(
            sampleEnd,
            instrument.sample.loop.start + instrument.sample.loop.length,
          );
          instrument.sample.length = sampleEnd;
        }

        for (let j = 0; j < sampleEnd; j++) {
          let b = file.readByte();
          // ignore first 2 bytes
          if (j < 2) b = 0;
          instrument.sample.data.push(b / 127);
        }

        // unroll short loops?
        // web audio loop start/end is in seconds
        // doesn't work that well with tiny loops

        if (
          (Settings.unrollShortLoops || Settings.unrollLoops) &&
          instrument.sample.loop.length > 2
        ) {
          let loopCount = Math.ceil(40000 / instrument.sample.loop.length) + 1;

          if (!Settings.unrollLoops) loopCount = 0;

          let resetLoopNumbers = false;
          let loopLength = 0;
          if (
            Settings.unrollShortLoops &&
            instrument.sample.loop.length < 1600
          ) {
            loopCount = Math.floor(1000 / instrument.sample.loop.length);
            resetLoopNumbers = true;
          }

          for (let l = 0; l < loopCount; l++) {
            const start = instrument.sample.loop.start;
            const end = start + instrument.sample.loop.length;
            for (let j = start; j < end; j++) {
              instrument.sample.data.push(instrument.sample.data[j]);
            }
            loopLength += instrument.sample.loop.length;
          }

          if (resetLoopNumbers && loopLength) {
            instrument.sample.loop.length += loopLength;
            instrument.sample.length += loopLength;
          }
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
      title,
      channels,
      instruments,
      length,
      patternTable,
      patterns,
      restartPosition: 1,
    };
  }

  //<!--
  write(next?: (file: BinaryStream) => void): void {
    const song = Tracker.getSong();
    if (song == null) {
      console.log("No song loaded to write!");
      return;
    }
    const instruments = Tracker.getInstruments();
    const trackCount = Tracker.getTrackCount();
    const patternLength = Tracker.getPatternLength();

    // get filesize

    let fileSize = 20 + 31 * 30 + 1 + 1 + 128 + 4;

    let highestPattern = 0;
    for (let i = 0; i < 128; i++) {
      const p = song.patternTable[i] || 0;
      highestPattern = Math.max(highestPattern, p);
    }

    fileSize += (highestPattern + 1) * (trackCount * 256);

    if (Tracker.getInstruments().length > 32) {
      UI.showDialog(
        "WARNING !!!//This file has more than 31 instruments.//Only the first 31 instruments will be included.",
      );
    }
    const startI = 1;
    const endI = 31;

    for (let i = startI; i <= endI; i++) {
      const instrument = instruments[i];
      if (instrument) {
        // reset to first sample in case we come from a XM file
        instrument.setSampleIndex(0);
        fileSize += instrument.sample.length;
      } else {
        // +4 ?
      }
    }

    const arrayBuffer = new ArrayBuffer(fileSize);
    const file = new BinaryStream(arrayBuffer, true);

    // write title
    file.writeStringSection(song.title, 20);

    // write instrument data
    for (let i = startI; i <= endI; i++) {
      const instrument = instruments[i];
      if (instrument) {
        // limit instrument size to 128k
        //TODO: show a warning when this is exceeded ...
        instrument.sample.length = Math.min(instrument.sample.length, 131070); // = FFFF * 2

        file.writeStringSection(instrument.name, 22);
        file.writeWord(instrument.sample.length >> 1);
        file.writeUByte(instrument.sample.finetune);
        file.writeUByte(instrument.sample.volume);
        file.writeWord(instrument.sample.loop.start >> 1);
        file.writeWord(instrument.sample.loop.length >> 1);
      } else {
        file.clear(30);
      }
    }

    file.writeUByte(song.length);
    file.writeUByte(127);

    // patternPos
    for (let i = 0; i < 128; i++) {
      const p = song.patternTable[i] || 0;
      file.writeUByte(p);
    }

    file.writeString(trackCount == 8 ? "8CHN" : "M.K.");

    // pattern Data

    for (let i = 0; i <= highestPattern; i++) {
      const patternData = song.patterns[i];

      // TODO - should be patternLength of pattern;
      for (let step = 0; step < patternLength; step++) {
        const row = patternData[step];
        for (let channel = 0; channel < trackCount; channel++) {
          if (row) {
            const trackStep = row[channel];
            let uIndex = 0;
            let lIndex = trackStep.instrument;

            if (lIndex > 15) {
              uIndex = 16; // TODO: Why is this 16 and not 1 ? Nobody wanted 255 instruments instead of 31 ?
              lIndex = trackStep.instrument - 16;
            }

            const v =
              (uIndex << 24) +
              (trackStep.period << 16) +
              (lIndex << 12) +
              (trackStep.effect << 8) +
              trackStep.param;
            file.writeUint(v);
          } else {
            file.writeUint(0);
          }
        }
      }
    }

    // sampleData;
    for (let i = startI; i <= endI; i++) {
      const instrument = instruments[i];
      if (instrument && instrument.sample.data && instrument.sample.length) {
        // should we put repeat info here?
        //file.clear(2);
        let d;
        // instrument length is in word
        for (let j = 0; j < instrument.sample.length; j++) {
          d = instrument.sample.data[j] || 0;
          file.writeByte(Math.round(d * 127));
        }
        console.log(
          "write instrument with " + instrument.sample.length + " length",
        );
      } else {
        // still write 4 bytes?
      }
    }

    if (next) next(file);
  }
  //-->
}
