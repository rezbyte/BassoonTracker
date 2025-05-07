import { BinaryStream } from "../filesystem";
import Sample from "../models/sample";

export default function read8SVXsample(file: BinaryStream, sample: Sample) {
  // format description on http://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice

  console.error("reading 8SVX sample");

  // IFF file
  function readChuck() {
    const chunk = {
      name: file.readString(4),
      size: file.readDWord(),
    };
    return chunk;
  }

  file.litteEndian = false;
  file.goto(12);

  // look for BODY chunck
  let chunk = readChuck();
  while (chunk.name != "BODY" && !file.isEOF(10)) {
    if (chunk.name == "NAME") {
      sample.name = file.readString(chunk.size);
    } else {
      file.jump(chunk.size);

      // TODO: should we read the header to find loop repeat points?
      // can't seem to find an example file that uses that.
    }
    chunk = readChuck();
  }

  if (chunk.name == "BODY") {
    for (let j = 0; j < chunk.size; j++) {
      const b = file.readByte();
      sample.data.push(b / 127);
    }
  }
}
