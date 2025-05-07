import { BinaryStream } from "../filesystem";
import Audio from "../audio";
import { SAMPLETYPE } from "../enum";

/*	getSamplerate adapted for BassoonTracker
	Source: https://gist.github.com/DrSnuggles/5f956f4e210d6716aa764fa8fea4a680
		https://github.com/DrSnuggles/jsGoniometer/blob/master/getSamplerate.js
	License : WTFPL 2.0, Beerware Revision 42

	WebAudio lags of information which samplerate was used in original source
	https://github.com/WebAudio/web-audio-api/issues/30
	and always resamples to audio device sample rate
	https://stackoverflow.com/questions/51252732/javascript-getchanneldata-some-out-of-bounds
*/

interface MP3Header {
	ID: number,
	Layer: number,
	srate: number,
	type: SAMPLETYPE.MP3,
	info: string,
	sampleRate: number,
	numberOfChannels: number,
}

export interface MetaData {
	type: SAMPLETYPE,
	sampleRate: number,
	numberOfChannels?: number,
	chunkSize?: number
	audioFormat?: number,
	bits?: number,
	version?: number,
	preSkip?:number
}

export default function getSamplerate(file: BinaryStream, ext: string): MetaData {
	const sbuf8 = new Uint8Array(file.buffer);
	const type = String.fromCharCode(sbuf8[0]) + String.fromCharCode(sbuf8[1]) + String.fromCharCode(sbuf8[2]) + String.fromCharCode(sbuf8[3])

	// identify type
	if (type === "RIFF") {
		// https://de.wikipedia.org/wiki/RIFF_WAVE
		// http://soundfile.sapp.org/doc/WaveFormat/
		// The default byte ordering assumed for WAVE data files is little-endian. Files written using the big-endian byte ordering scheme have the identifier RIFX instead of RIFF.
		// look for 'fmt '
		//format description: http://soundfile.sapp.org/doc/WaveFormat/
		const str = getAsString(sbuf8);
		const fmtStart = str.indexOf("fmt ");
		return {
			type: SAMPLETYPE.WAVE_PCM,
			chunkSize: (sbuf8[4]) + (sbuf8[5]<<8) + (sbuf8[6]<<16) + (sbuf8[7]<<24),
			audioFormat: (sbuf8[fmtStart+8]) + (sbuf8[fmtStart+9]<<8),
			numberOfChannels: (sbuf8[fmtStart+10]) + (sbuf8[fmtStart+11]<<8),
			sampleRate: (sbuf8[fmtStart+12]) + (sbuf8[fmtStart+13]<<8) + (sbuf8[fmtStart+14]<<16) + (sbuf8[fmtStart+15]<<24),
			bits:(sbuf8[fmtStart+22]) + (sbuf8[fmtStart+23]<<8)
		};
	} else if (type === "fLaC") {
		// FLAC
		// https://xiph.org/flac/format.html#def_STREAMINFO
		// big-endian
		return {
			type: SAMPLETYPE.FLAC,
			sampleRate: (sbuf8[18]<<12) + (sbuf8[19]<<4) + ((sbuf8[20] & 0xF0)>>4),
			numberOfChannels: ((sbuf8[20] & 0xE)>>1) + 1,
			bits: ((sbuf8[20] & 0x1)<<4) + ((sbuf8[21] & 0xF0)>>4) + 1
		}
	} else if (type === "OggS") { // Vorbis: OGG or OPUS
		const str = getAsString(sbuf8);
		let opusHead = str.indexOf('OpusHead')
		if (opusHead != -1) {
			opusHead += 8;
			//ret.sampleRate = 48000; // default opus samplerate
			return {
				type: SAMPLETYPE.OPUS,
				version: sbuf8[opusHead],
				numberOfChannels: sbuf8[opusHead+1],
				preSkip: (sbuf8[opusHead+2]) + (sbuf8[opusHead+3]<<8),
				sampleRate: (sbuf8[opusHead+4]) + (sbuf8[opusHead+5]<<8) + (sbuf8[opusHead+6]<<16) + (sbuf8[opusHead+7]<<24), // original samplerate
			};
		} else {
			// https://stackoverflow.com/questions/45231773/how-to-get-sample-rate-by-ogg-vorbis-byte-buffer
			// https://xiph.org/vorbis/doc/Vorbis_I_spec.pdf
			return {
				type: SAMPLETYPE.OGG,
				numberOfChannels: (sbuf8[39]),
				sampleRate: (sbuf8[40]) + (sbuf8[41]<<8) + (sbuf8[42]<<16) + (sbuf8[43]<<24) + (sbuf8[44]<<32) + (sbuf8[45]<<40) + (sbuf8[46]<<48) + (sbuf8[47]<<56),
				bits: (sbuf8[48]) + (sbuf8[49]<<8) + (sbuf8[50]<<16) + (sbuf8[51]<<24)
			};
		}
	} else if (String.fromCharCode(sbuf8[4]) + String.fromCharCode(sbuf8[5]) + String.fromCharCode(sbuf8[6]) + String.fromCharCode(sbuf8[7]) === "ftyp") {
		// http://xhelmboyx.tripod.com/formats/mp4-layout.txt
		// big endian
		//const subtype = ret.str.substr(8, 4); // "avc1", "iso2", "isom", "mmp4", "mp41", "mp42", "mp71", "msnv", "ndas", "ndsc", "ndsh", "ndsm", "ndsp", "ndss", "ndxc", "ndxh", "ndxm", "ndxp", "ndxs"
		const str = getAsString(sbuf8);
		const mdhdStart = str.indexOf("mdhd");
		const version = sbuf8[mdhdStart+4];
		//console.log("MP4 Version "+ version);
		const sampleRate = version === 1 ? 
			(sbuf8[mdhdStart+16+8]<<24) + (sbuf8[mdhdStart+17+8]<<16) + (sbuf8[mdhdStart+18+8]<<8) + sbuf8[mdhdStart+19+8] : 
			(sbuf8[mdhdStart+16]<<24) + (sbuf8[mdhdStart+17]<<16) + (sbuf8[mdhdStart+18]<<8) + sbuf8[mdhdStart+19];
		return {
			type: SAMPLETYPE.MP4,
			sampleRate
		};
	} else if (type.substring(0, 3) === "ID3") {
		// MP3 is only good identifyable if ID3 is present
		return getMP3Header(sbuf8);
	} else if (ext === 'mp3') {
		// check for MP3 only by file extension, trying to validate header info went often wrong for IFF,RAW samples
		return getMP3Header(sbuf8);
	}
	// unknown format
	console.warn(`getSamplerate found unknown format ${type}`);
	return {type: SAMPLETYPE.RAW_8BIT, sampleRate: 0}

	//
	// Helper
	//
	function getAsString(buf: Uint8Array): string {
		const ret = [];
		const strLen = Math.min(buf.length, 1024*1024); // not all the buffer
		for (let i = 0; i < strLen; i++) {
			ret.push( String.fromCharCode(buf[i]) );
		}
		return ret.join("");
	}
	function getMP3Header(buf: Uint8Array): MP3Header {
		/* read samplerate from frame: https://de.wikipedia.org/wiki/MP3#Frame-Header
		https://www.mp3-tech.org/programmer/frame_header.html
		first we need to know ID = MPEG version (2 bits)
		then we another 2bits (sample rate freq index) and we can look in table which samplerate was used
		
		Sampling rate frequency index
		bits	MPEG1     MPEG2	     MPEG2.5
		00    44100 Hz  22050 Hz	 11025 Hz
		01	  48000 Hz	24000 Hz	 12000 Hz
		10	  32000 Hz	16000 Hz	  8000 Hz
		11	  reserv.	  reserv.	   reserv.
		*/
		for (let i = 500; i < buf.length-1; i++) { // before it's not our header
			if (buf[i] === 0xFF && (buf[i+1] & 0xE0) === 0xE0) {
				// header found
				const MP3_translate_ID = ["MPEG Version 2.5", "reserved", "MPEG Version 2", "MPEG Version 1"];
				const MP3_translate_Layer = ["reserved", "Layer III", "Layer II", "Layer I"];
				const MP3_translate_numChannels = /*["Stereo", "Joint Stereo", "2 Mono", "Mono"]*/ [2,2,2,1];
				const MP3_divisor = [4, 0, 2, 1]; // ID=1 -> div=0 !
				const MP3_baseRate = [44100, 48000, 32000]
				const ID = ((buf[i+1] & 0x18)>>3); // 0b00011000
				const Layer = ((buf[i+1] & 6)>>1); // 0b00000110
				const bitrate = ((buf[i+2] & 0xF0)>>4); // 0b11110000
				const srate = ((buf[i+2] & 0xC)>>2); // 0b00001100
				const channels = ((buf[i+3] & 0xC0)>>6); // 0b11000000

				return {
					ID: ID,
					Layer: Layer,
					srate: srate,
					type: SAMPLETYPE.MP3,
					info: MP3_translate_ID[ID] +" "+ MP3_translate_Layer[Layer],
					sampleRate: (!isNaN(MP3_baseRate[srate] / MP3_divisor[ID])) ? MP3_baseRate[srate] / MP3_divisor[ID] : Audio.context.sampleRate,
					numberOfChannels: MP3_translate_numChannels[channels],
				}
			}
		}
		throw new Error("Failed to get MP3 Header!")
	}
}
