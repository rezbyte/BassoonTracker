import { BinaryStream } from "../filesystem";
import Sample from "../models/sample";

export function readRAWsample(file: BinaryStream, sample: Sample) {
  file.goto(0);
  for (let j = 0; j < sample.length; j++) {
    const b = file.readByte();
    sample.data.push(b / 127);
  }
}
