import { MetaData } from "../audio/getSamplerate";

export default class Sample {
  data: number[] = [];
  length = 0;
  realLen: number | undefined;
  name = "";
  bits = 8;

  volume = 64;
  finetune = 0;
  finetuneX = 0;
  panning = 0;
  relativeNote = 0;

  loop = {
    enabled: false,
    start: 0,
    length: 0,
    type: 0,
  };

  info?: MetaData;
  type: number = 0;
  reserved: number = 0;

  check() {
    let min = 0;
    let max = 0;
    for (let i = 0, len = this.data.length; i < len; i++) {
      min = Math.min(min, this.data[i]);
      max = Math.max(max, this.data[i]);
    }
    return { min: min, max: max };
  }
}
