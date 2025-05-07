import { BinaryStream } from "../filesystem";
import Song from "../models/song";

export default interface FileFormat {
    load: (file: BinaryStream, name: string) => Song
    write?: (next?: (file: BinaryStream) => void) => void
    validate?: (song: Song) => void
}