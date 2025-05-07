import Instrument from "./instrument";
import Note from "./note";

export type Pattern = Note[][];

export default interface Song {
    typeId?: string,
    title: string,
    filename?: string,
    length: number,
    restartPosition: number,
    patterns: Pattern[],
    instruments: Instrument[],
    patternTable: number[],
    channels?: number,
    speed?: number
};
