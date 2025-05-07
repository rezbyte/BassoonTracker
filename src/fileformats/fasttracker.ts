import Tracker from "../tracker";
import { TRACKERMODE } from "../enum";
import { BinaryStream } from "../filesystem";
import EventBus from "../eventBus";
import { EVENT, LOOPTYPE } from "../enum";
import Sample from "../models/sample";
import Instrument, { Envelope } from "../models/instrument";
import Song, { Pattern } from "../models/song";
import FileFormat from "./fileformat";
import Note from "../models/note";
import Host from "../host";

export default class FastTracker implements FileFormat {
  // see ftp://ftp.modland.com/pub/documents/format_documentation/FastTracker%202%20v2.04%20(.xm).html
  load(file: BinaryStream, name: string): Song {
    console.log("loading FastTracker");
    Tracker.setTrackerMode(TRACKERMODE.FASTTRACKER, true);
    Tracker.clearInstruments(1);

    file.litteEndian = true;

    file.goto(17);
    const title = file.readString(20);
    file.jump(1); //$1a

    const trackerName = file.readString(20);
    const trackerVersionPre = file.readByte();
    const trackerVersion = file.readByte() + "." + trackerVersionPre;
    const headerSize = file.readDWord(); // is this always 276?
    const songlength = file.readWord();
    let restartPosition = file.readWord();
    const numberOfChannels = file.readWord();
    const numberOfPatterns = file.readWord(); // this is sometimes more then the actual number? should we scan for highest pattern? -> YES! -> NO!
    const numberOfInstruments = file.readWord();
    const flags = file.readWord();
    if (flags % 2 === 1) {
      Tracker.useLinearFrequency = true;
    } else {
      Tracker.useLinearFrequency = false;
    }

    const defaultTempo = file.readWord();
    const defaultBPM = file.readWord();

    console.log(
      "File was made in " + trackerName + " version " + trackerVersion,
    );

    const patternTable: number[] = Array(songlength);
    let highestPattern = 0;
    for (let i = 0; i < songlength; ++i) {
      patternTable[i] = file.readUbyte();
      if (highestPattern < patternTable[i]) highestPattern = patternTable[i];
    }
    const length = songlength;
    const channels = numberOfChannels;
    restartPosition = restartPosition + 1;

    let fileStartPos = 60 + headerSize;
    file.goto(fileStartPos);

    const patterns: Pattern[] = Array(numberOfPatterns);
    for (let i = 0; i < numberOfPatterns; i++) {
      const headerSize = file.readDWord();
      const packingType = file.readUbyte(); // always 0
      const patternLength = file.readWord();
      const patternSize = file.readWord();

      fileStartPos += headerSize;
      file.goto(fileStartPos);

      const patternData = Array(patternLength);
      for (let step = 0; step < patternLength; step++) {
        const row = Array(numberOfChannels);
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const note = new Note();
          const v = file.readUbyte();

          if (v & 128) {
            if (v & 1) note.setIndex(file.readUbyte());
            if (v & 2) note.instrument = file.readUbyte();
            if (v & 4) note.volumeEffect = file.readUbyte();
            if (v & 8) note.effect = file.readUbyte();
            if (v & 16) note.param = file.readUbyte();
          } else {
            note.setIndex(v);
            note.instrument = file.readUbyte();
            note.volumeEffect = file.readUbyte();
            note.effect = file.readUbyte();
            note.param = file.readUbyte();
          }

          row[channel] = note;
        }
        patternData[step] = row;
      }

      fileStartPos += patternSize;
      file.goto(fileStartPos);

      patterns[i] = patternData;
    }

    const instrumentContainer = Array(numberOfInstruments);

    for (let i = 1; i <= numberOfInstruments; ++i) {
      const instrument = new Instrument();

      try {
        instrument.filePosition = file.index;
        instrument.headerSize = file.readDWord();

        instrument.name = file.readString(22);
        instrument.type = file.readUbyte();
        instrument.numberOfSamples = file.readWord();
        instrument.samples = Array(instrument.numberOfSamples);
        instrument.sampleHeaderSize = 0;

        if (instrument.numberOfSamples > 0) {
          instrument.sampleHeaderSize = file.readDWord();

          // some files report incorrect sampleheadersize (18, without the samplename)
          // e.g. dubmood - cybernostra weekends.xm
          // sample header should be at least 40 bytes
          instrument.sampleHeaderSize = Math.max(
            instrument.sampleHeaderSize,
            40,
          );

          // and not too much ... (Files saved with sk@letracker)
          if (instrument.sampleHeaderSize > 200)
            instrument.sampleHeaderSize = 40;

          //should we assume it's always 40? not according to specs ...

          for (let si = 0; si < 96; si++)
            instrument.sampleNumberForNotes.push(file.readUbyte());
          for (let si = 0; si < 24; si++)
            instrument.volumeEnvelope.raw.push(file.readWord());
          for (let si = 0; si < 24; si++)
            instrument.panningEnvelope.raw.push(file.readWord());

          instrument.volumeEnvelope.count = file.readUbyte();
          instrument.panningEnvelope.count = file.readUbyte();
          instrument.volumeEnvelope.sustainPoint = file.readUbyte();
          instrument.volumeEnvelope.loopStartPoint = file.readUbyte();
          instrument.volumeEnvelope.loopEndPoint = file.readUbyte();
          instrument.panningEnvelope.sustainPoint = file.readUbyte();
          instrument.panningEnvelope.loopStartPoint = file.readUbyte();
          instrument.panningEnvelope.loopEndPoint = file.readUbyte();
          instrument.volumeEnvelope.type = file.readUbyte();
          instrument.panningEnvelope.type = file.readUbyte();
          instrument.vibrato.type = file.readUbyte();
          instrument.vibrato.sweep = file.readUbyte();
          instrument.vibrato.depth = Math.min(file.readUbyte(), 15); // some trackers have a different scale here? (e.g. Ambrozia)
          instrument.vibrato.rate = file.readUbyte();
          instrument.fadeout = file.readWord();
          instrument.reserved = file.readWord();

          function processEnvelope(envelope: Envelope): Envelope {
            envelope.points = Array(12);
            for (let si = 0; si < 12; si++) {
              const sliced = envelope.raw.slice(si * 2, si * 2 + 2);
              envelope.points[si] = [sliced[0], sliced[1]];
            }
            if (envelope.type & 1) {
              // on
              envelope.enabled = true;
            }

            if (envelope.type & 2) {
              // sustain
              envelope.sustain = true;
            }

            if (envelope.type & 4) {
              // loop
              envelope.loop = true;
            }

            return envelope;
          }

          instrument.volumeEnvelope = processEnvelope(
            instrument.volumeEnvelope,
          );
          instrument.panningEnvelope = processEnvelope(
            instrument.panningEnvelope,
          );
        }
      } catch (e) {
        console.error("error", e);
      }

      fileStartPos += instrument.headerSize;
      file.goto(fileStartPos);

      if (instrument.numberOfSamples === 0) {
        const sample = new Sample();
        instrument.samples[i] = sample;
      } else {
        if (file.isEOF(1)) {
          console.error("seek past EOF");
          console.error(instrument);
          break;
        }

        for (let sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++) {
          const sample = new Sample();

          sample.length = file.readDWord();
          sample.loop.start = file.readDWord();
          sample.loop.length = file.readDWord();
          sample.volume = file.readUbyte();
          sample.finetuneX = file.readByte();
          sample.type = file.readUbyte();
          sample.panning = file.readUbyte() - 128;
          sample.relativeNote = file.readByte();
          sample.reserved = file.readByte();
          sample.name = file.readString(22);
          sample.bits = 8;

          instrument.samples[sampleI] = sample;
          fileStartPos += instrument.sampleHeaderSize;

          file.goto(fileStartPos);
        }

        for (let sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++) {
          const sample = instrument.samples[sampleI];
          if (!sample.length) continue;

          fileStartPos += sample.length;

          if (sample.type & 16) {
            sample.bits = 16;
            sample.type ^= 16;
            sample.length >>= 1;
            sample.loop.start >>= 1;
            sample.loop.length >>= 1;
          }
          sample.loop.type = sample.type || 0;
          sample.loop.enabled = !!sample.loop.type;

          // sample data
          console.log(
            "Reading sample from 0x" +
              file.index +
              " with length of " +
              sample.length +
              (sample.bits === 16 ? " words" : " bytes") +
              " and repeat length of " +
              sample.loop.length,
          );
          const sampleEnd = sample.length;

          let old = 0;
          if (sample.bits === 16) {
            for (let j = 0; j < sampleEnd; j++) {
              let b = file.readShort() + old;
              if (b < -32768) b += 65536;
              else if (b > 32767) b -= 65536;
              old = b;
              sample.data.push(b / 32768);
            }
          } else {
            for (let j = 0; j < sampleEnd; j++) {
              let b = file.readByte() + old;

              if (b < -128) b += 256;
              else if (b > 127) b -= 256;
              old = b;
              sample.data.push(b / 127); // TODO: or /128 ? seems to introduce artifacts - see test-loop-fadeout.xm
            }
          }

          // unroll ping pong loops
          if (sample.loop.type === LOOPTYPE.PINGPONG) {
            // TODO: keep original sample?
            const loopPart = sample.data.slice(
              sample.loop.start,
              sample.loop.start + sample.loop.length,
            );

            sample.data = sample.data.slice(
              0,
              sample.loop.start + sample.loop.length,
            );
            sample.data = sample.data.concat(loopPart.reverse());
            sample.loop.length = sample.loop.length * 2;
            sample.length = sample.loop.start + sample.loop.length;
          }

          file.goto(fileStartPos);
        }
      }

      instrument.setSampleIndex(0);

      Tracker.setInstrument(i, instrument);
      instrumentContainer[i - 1] = {
        label: i + " " + instrument.name,
        data: i,
      };
    }
    EventBus.trigger(EVENT.instrumentListChange, instrumentContainer); // TODO: Move this and related statements into calling function in Tracker
    const instruments = Tracker.getInstruments();

    Tracker.setBPM(defaultBPM);
    Tracker.setAmigaSpeed(defaultTempo);

    const song: Song = {
      title,
      patterns,
      patternTable,
      length,
      channels,
      restartPosition,
      instruments,
    };

    this.validate(song);

    return song;
  }

  // build internal
  //<!--
  write(next?: (file: BinaryStream) => void) {
    const song = Tracker.getSong();
    if (song == null) {
      console.error("Cannot write to a fasttracker XM without a song loaded!");
      return;
    }
    const instruments = Tracker.getInstruments(); // note: intruments start at index 1, not 0
    const trackCount = Tracker.getTrackCount();

    const versionNumber = Host.getVersionNumber();
    const version =
      typeof versionNumber === "undefined" ? "dev" : versionNumber;

    let highestPattern = 0;
    for (let i = 0; i < 128; i++) {
      const p = song.patternTable[i] || 0;
      highestPattern = Math.max(highestPattern, p);
    }

    // first get filesize
    let fileSize = 60 + 276;

    for (let i = 0; i <= highestPattern; i++) {
      if (song.patterns[i]) {
        fileSize += 9 + song.patterns[i].length * trackCount * 5;
      }
    }

    // TODO: trim instrument list;

    for (let i = 1; i < instruments.length; i++) {
      const instrument = instruments[i];

      if (instrument && instrument.hasSamples()) {
        instrument.samples.forEach(function (sample) {
          let len = sample.length;
          if (sample.bits === 16) len *= 2;
          fileSize += 243 + 40 + len;
        });
      } else {
        fileSize += 29;
      }
    }

    const arrayBuffer = new ArrayBuffer(fileSize);
    const file = new BinaryStream(arrayBuffer, false);

    file.writeStringSection("Extended Module: ", 17);
    file.writeStringSection(song.title, 20);
    file.writeByte(26);
    file.writeStringSection("BassoonTracker " + version, 20);
    file.writeByte(4); // minor version xm format
    file.writeByte(1); // major version xm format

    file.writeDWord(276); // header size;
    file.writeWord(song.length);
    file.writeWord(0); //restart position
    file.writeWord(Tracker.getTrackCount());
    file.writeWord(highestPattern + 1); // number of patterns
    file.writeWord(instruments.length - 1); // number of instruments
    file.writeWord(Tracker.useLinearFrequency ? 1 : 0);
    file.writeWord(Tracker.getAmigaSpeed()); // default tempo
    file.writeWord(Tracker.getBPM()); // default BPM

    //TO CHECK: are most players compatible when we only only write the actual song length instead of all 256?
    for (let i = 0; i < 256; i++) {
      file.writeUByte(song.patternTable[i] || 0);
    }

    // write pattern data
    for (let i = 0; i <= highestPattern; i++) {
      const thisPattern = song.patterns[i];
      let patternLength = 0;
      let patternSize = 0;

      if (thisPattern) {
        patternLength = thisPattern.length;
        patternSize = patternLength * trackCount * 5;
      }

      file.writeDWord(9); // header size;
      file.writeUByte(0); // packing type
      file.writeWord(patternLength);
      file.writeWord(patternSize);

      if (thisPattern) {
        // TODO: packing?
        for (let step = 0, max = thisPattern.length; step < max; step++) {
          const row = thisPattern[step];
          for (let channel = 0; channel < trackCount; channel++) {
            const note = row[channel] || {};
            file.writeUByte(note.index || 0);
            file.writeUByte(note.instrument || 0);
            file.writeUByte(note.volumeEffect || 0);
            file.writeUByte(note.effect || 0);
            file.writeUByte(note.param || 0);
          }
        }
      }
    }

    // write instrument data
    for (let i = 1; i < instruments.length; i++) {
      const instrument = instruments[i];

      if (instrument && instrument.hasSamples()) {
        instrument.numberOfSamples = instrument.samples.length;

        file.writeDWord(243); // header size;
        file.writeStringSection(instrument.name, 22);
        file.writeUByte(0); // instrument type
        file.writeWord(instrument.numberOfSamples); // number of samples

        const volumeEnvelopeType =
          (instrument.volumeEnvelope.enabled ? 1 : 0) +
          (instrument.volumeEnvelope.sustain ? 2 : 0) +
          (instrument.volumeEnvelope.loop ? 4 : 0);

        const panningEnvelopeType =
          (instrument.panningEnvelope.enabled ? 1 : 0) +
          (instrument.panningEnvelope.sustain ? 2 : 0) +
          (instrument.panningEnvelope.loop ? 4 : 0);

        file.writeDWord(40); // sample header size;
        for (let si = 0; si < 96; si++) {
          file.writeUByte(instrument.sampleNumberForNotes[si] || 0); // sample number for notes
        }

        // volume envelope
        for (let si = 0; si < 12; si++) {
          const point = instrument.volumeEnvelope.points[si] || [0, 0];
          file.writeWord(point[0]);
          file.writeWord(point[1]);
        }
        // panning envelope
        for (let si = 0; si < 12; si++) {
          const point = instrument.panningEnvelope.points[si] || [0, 0];
          file.writeWord(point[0]);
          file.writeWord(point[1]);
        }

        file.writeUByte(instrument.volumeEnvelope.count || 0);
        file.writeUByte(instrument.panningEnvelope.count || 0);
        file.writeUByte(instrument.volumeEnvelope.sustainPoint || 0);
        file.writeUByte(instrument.volumeEnvelope.loopStartPoint || 0);
        file.writeUByte(instrument.volumeEnvelope.loopEndPoint || 0);
        file.writeUByte(instrument.panningEnvelope.sustainPoint || 0);
        file.writeUByte(instrument.panningEnvelope.loopStartPoint || 0);
        file.writeUByte(instrument.panningEnvelope.loopEndPoint || 0);
        file.writeUByte(volumeEnvelopeType);
        file.writeUByte(panningEnvelopeType);
        file.writeUByte(instrument.vibrato.type || 0);
        file.writeUByte(instrument.vibrato.sweep || 0);
        file.writeUByte(instrument.vibrato.depth || 0);
        file.writeUByte(instrument.vibrato.rate || 0);
        file.writeWord(instrument.fadeout || 0);
        file.writeWord(0); // reserved

        // write samples

        // first all sample headers
        for (let sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++) {
          const thisSample = instrument.samples[sampleI];

          let sampleType = 0;
          if (thisSample.loop.length > 2 && thisSample.loop.enabled)
            sampleType = 1;

          //TODO pingpong loops, or are we keeping pingpong loops unrolled?

          let sampleByteLength = thisSample.length;
          let sampleLoopByteStart = thisSample.loop.start;
          let sampleLoopByteLength = thisSample.loop.length;
          if (thisSample.bits === 16) {
            sampleType += 16;
            sampleByteLength *= 2;
            sampleLoopByteStart *= 2;
            sampleLoopByteLength *= 2;
          }

          file.writeDWord(sampleByteLength);
          file.writeDWord(sampleLoopByteStart);
          file.writeDWord(sampleLoopByteLength);
          file.writeUByte(thisSample.volume);
          file.writeByte(thisSample.finetuneX);
          file.writeUByte(sampleType);
          file.writeUByte((thisSample.panning || 0) + 128);
          file.writeUByte(thisSample.relativeNote || 0);
          file.writeUByte(0);
          file.writeStringSection(thisSample.name || "", 22);
        }

        // then all sample data
        for (let sampleI = 0; sampleI < instrument.numberOfSamples; sampleI++) {
          const thisSample = instrument.samples[sampleI];

          let delta = 0;
          let prev = 0;

          if (thisSample.bits === 16) {
            for (let si = 0, max = thisSample.length; si < max; si++) {
              // write 16-bit sample data
              let b = Math.round(thisSample.data[si] * 32768);
              delta = b - prev;
              prev = b;

              if (delta < -32768) delta += 65536;
              else if (delta > 32767) delta -= 65536;
              file.writeWord(delta);
            }
          } else {
            for (let si = 0, max = thisSample.length; si < max; si++) {
              // write 8-bit sample data
              let b = Math.round(thisSample.data[si] * 127);
              delta = b - prev;
              prev = b;

              if (delta < -128) delta += 256;
              else if (delta > 127) delta -= 256;
              file.writeByte(delta);
            }
          }
        }
      } else {
        // empty instrument
        file.writeDWord(29); // header size;
        file.writeStringSection(instrument ? instrument.name : "", 22);
        file.writeUByte(0); // instrument type
        file.writeWord(0); // number of samples
      }
    }

    if (next) next(file);
  }
  //-->

  validate(song: Song) {
    function checkEnvelope(envelope: Envelope, type: string): Envelope {
      let isValid = true;
      if (envelope.points && envelope.points[0]) {
        if (envelope.points[0][0] === 0) {
          let c = 0;
          for (let i = 1; i < envelope.count; i++) {
            const point = envelope.points[i];
            if (point && point[0] > c) {
              c = point[0];
            } else {
              isValid = false;
            }
          }
        } else {
          isValid = false;
        }
      } else {
        isValid = false;
      }

      if (isValid) {
        return envelope;
      } else {
        console.warn("Invalid envelope, resetting to default");
        return type === "volume"
          ? {
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
            }
          : {
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
      }
    }

    song.instruments.forEach(function (instrument) {
      // check envelope
      instrument.volumeEnvelope = checkEnvelope(
        instrument.volumeEnvelope,
        "volume",
      );
      instrument.panningEnvelope = checkEnvelope(
        instrument.panningEnvelope,
        "panning",
      );

      // check sampleIndexes;
      const maxSampleIndex = instrument.samples.length - 1;
      for (
        let i = 0, max = instrument.sampleNumberForNotes.length;
        i < max;
        i++
      ) {
        instrument.sampleNumberForNotes[i] = Math.min(
          instrument.sampleNumberForNotes[i],
          maxSampleIndex,
        );
      }
    });
  }
}
