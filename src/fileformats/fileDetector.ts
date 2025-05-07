import { BinaryStream } from "../filesystem";
import ProTracker from "./protracker";
import SoundTracker from "./soundtracker";
import FastTracker from "./fasttracker";
import FileFormat from "./fileformat";

interface FileType {
  name: string
  isMod?: true
  isSample?: true
  loader?: () => FileFormat
}
class FileDetector {

  private readonly fileType: Record<string, FileType> = {
    unknown: { name: "UNKNOWN" },
    unsupported: { name: "UNSUPPORTED" },
    mod_ProTracker: {
      name: "PROTRACKER",
      isMod: true,
      loader: function () {
        return new ProTracker();
      },
    },
    mod_SoundTracker: {
      name: "SOUNDTRACKER",
      isMod: true,
      loader: function () {
        return new SoundTracker();
      },
    },
    mod_FastTracker: {
      name: "FASTTRACKER",
      isMod: true,
      loader: function () {
        return new FastTracker();
      },
    },
    sample: { name: "SAMPLE", isSample: true },
    zip: { name: "ZIP" },
  };

  detect(file: BinaryStream, name: string): FileType {
    const length = file.length;
    let id = "";

    id = file.readString(17, 0);
    if (id == "Extended Module: ") {
      return this.fileType.mod_FastTracker;
    }

    if (length > 1100) {
      id = file.readString(4, 1080); // M.K.
    }
    console.log("Format ID: " + id);

    if (id == "M.K.") return this.fileType.mod_ProTracker;
    if (id == "M!K!") return this.fileType.mod_ProTracker; // more then 64 patterns
    if (id == "M&K!") return this.fileType.mod_ProTracker; // what's different? example https://modarchive.org/index.php?request=view_by_moduleid&query=76607
    if (id == "FLT4") return this.fileType.mod_ProTracker;
    if (id == "2CHN") return this.fileType.mod_ProTracker;
    if (id == "3CHN") return this.fileType.mod_ProTracker;
    if (id == "5CHN") return this.fileType.mod_ProTracker;
    if (id == "6CHN") return this.fileType.mod_ProTracker;
    if (id == "7CHN") return this.fileType.mod_ProTracker;
    if (id == "8CHN") return this.fileType.mod_ProTracker;
    if (id == "9CHN") return this.fileType.mod_ProTracker;
    if (id == "10CH") return this.fileType.mod_ProTracker;
    if (id == "11CH") return this.fileType.mod_ProTracker;
    if (id == "12CH") return this.fileType.mod_ProTracker;
    if (id == "13CH") return this.fileType.mod_ProTracker;
    if (id == "14CH") return this.fileType.mod_ProTracker;
    if (id == "15CH") return this.fileType.mod_ProTracker;
    if (id == "16CH") return this.fileType.mod_ProTracker;
    if (id == "18CH") return this.fileType.mod_ProTracker;
    if (id == "20CH") return this.fileType.mod_ProTracker;
    if (id == "22CH") return this.fileType.mod_ProTracker;
    if (id == "24CH") return this.fileType.mod_ProTracker;
    if (id == "26CH") return this.fileType.mod_ProTracker;
    if (id == "28CH") return this.fileType.mod_ProTracker;
    if (id == "30CH") return this.fileType.mod_ProTracker;
    if (id == "32CH") return this.fileType.mod_ProTracker;

    let ext = "";
    if (name && name.length > 4) ext = name.substr(name.length - 4);
    ext = ext.toLowerCase();

    if (ext == ".wav") return this.fileType.sample;
    if (ext == ".mp3") return this.fileType.sample;
    if (ext == ".iff") return this.fileType.sample;
    if (ext == "flac") return this.fileType.sample;
    if (ext == ".ogg") return this.fileType.sample;
    if (ext == "opus") return this.fileType.sample;
    if (ext == ".zip") return this.fileType.zip;

    let zipId = file.readString(2, 0);
    if (zipId == "PK") return this.fileType.zip;

    // might be an 15 instrument mod?
    // filename should at least contain a "." this avoids checking all ST-XX samples

    // example: https://modarchive.org/index.php?request=view_by_moduleid&query=35902 or 36954
    // more info: ftp://ftp.modland.com/pub/documents/format_documentation/Ultimate%20Soundtracker%20(.mod).txt

    if (name && name.indexOf(".") >= 0 && length > 1624) {
      // check for ascii
      function isAcii(byte: number) {
        return byte < 128;
      }

      function isST() {
        console.log("Checking for old 15 instrument soundtracker format");
        file.goto(0);
        for (let i = 0; i < 20; i++) if (!isAcii(file.readByte())) return false;

        console.log("First 20 chars are ascii, checking Samples");

        // check samples
        let totalSampleLength = 0;
        let probability = 0;
        for (let s = 0; s < 15; s++) {
          for (let i = 0; i < 22; i++) if (!isAcii(file.readByte())) return false;
          file.jump(-22);
          const name = file.readString(22);
          if (name.toLowerCase().substr(0, 3) == "st-") probability += 10;
          if (probability > 20) return true;
          totalSampleLength += file.readWord();
          file.jump(6);
        }

        if (totalSampleLength * 2 + 1624 > length) return false;

        return true;
      }

      const isSoundTracker = isST();
      if (isSoundTracker) {
        return this.fileType.mod_SoundTracker;
      }
    }

    // fallback to sample
    return this.fileType.sample;
  };

};

export default new FileDetector();
