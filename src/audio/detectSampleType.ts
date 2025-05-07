import { SAMPLETYPE } from "../enum";
import { readRAWsample } from "./raw";
import Sample from "../models/sample";
import { BinaryStream } from "../filesystem";
import read8SVXsample from "./8svx";
import getSamplerate from "./getSamplerate";

type Next = (sampleType?: SAMPLETYPE) => void;

export function detectSampleType(
  file: BinaryStream,
  sample: Sample,
  next: Next,
): SAMPLETYPE | void {
  // detects the sample type of a binary stream
  // if sample is given it also reads and decodes it into sample.data

  // let's assume it's a 8-bit raw audio file like found on the amiga ST disks by default
  let sampleType = SAMPLETYPE.RAW_8BIT;
  let decoder: (file: BinaryStream, sample: Sample, next: Next) => void =
    readRAWsample;

  // if we have original samplerate we can use WebAudio to decode most formats
  let ext = "";
  if (sample && sample.name) {
    ext = (sample.name.split(".").pop() || "").toLowerCase();
  }

  sample.info = getSamplerate(file, ext);

  switch (sample.info.type) {
    case SAMPLETYPE.WAVE_PCM:
    case SAMPLETYPE.RIFF_8BIT:
    case SAMPLETYPE.RIFF_16BIT:
    case SAMPLETYPE.MP3:
    case SAMPLETYPE.FLAC:
    case SAMPLETYPE.OGG:
    case SAMPLETYPE.OPUS:
      sampleType = SAMPLETYPE.OPUS;
      decoder = decodeFileWithAudioContext; //readRIFFsample;
      break;
    case SAMPLETYPE.IFF_8SVX: {
      file.goto(8);
      const subId = file.readString(4);
      if (subId == "8SVX") {
        sampleType = SAMPLETYPE.IFF_8SVX;
        decoder = read8SVXsample;
      }
      break;
    }
    default:
      console.log("Unknown sample format, expect RAW_8BIT:", sample.info);
      break;
  }

  if (sample && decoder) {
    decoder(file, sample, next);
  } else {
    if (next) {
      next(sampleType);
    } else {
      return sampleType;
    }
  }
}

export function decodeFileWithAudioContext(
  file: BinaryStream,
  sample: Sample,
  next: () => void,
) {
  // need to use original samplerate, not the one defined in users OS/Browser
  const converter = new AudioContext({ sampleRate: sample.info?.sampleRate });
  if (converter.sampleRate !== sample.info?.sampleRate) {
    console.log(
      "Could not initiate desired sampleRate of " +
        sample.info?.sampleRate +
        " instead got " +
        converter.sampleRate,
    );
  }
  converter.decodeAudioData(
    file.buffer,
    function (buffer) {
      if (!buffer) {
        alert("error decoding file data: " + sample.name);
        return;
      }
      // todo: show dialog for stereo samples ?
      sample.data = Array.from(buffer.getChannelData(0));
      if (sample.data && !sample.data.concat) {
        // typed arrays don't have the concat method
        sample.data = Array.from(sample.data);
      }
      sample.length = buffer.length;
      if (next) next();
    },
    function (error) {
      console.error("decodeAudioData error", error);
      if (next) next();
    },
  );
}
