import Editor from "./editor";

export function loadFile(url: string, next: (result: ArrayBuffer | false) => void) {
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onload = function (event) {
        const arrayBuffer: ArrayBuffer = req.response;
        if (arrayBuffer && req.status === 200) {
            if (next) next(arrayBuffer);
        } else {
            console.error("unable to load", url);
            // do not call if player only
            if (typeof Editor !== "undefined") {
              if (next) next(false);
            }
        }
    };
    req.send(null);
}

export function saveFile(b: Blob | MediaSource, filename: string) {
	//<!--
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    const url = window.URL.createObjectURL(b);
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
	//-->
}

export class BinaryStream {

	index: number;
	litteEndian: boolean;
	buffer: ArrayBuffer;
	dataView: DataView;
	length: number;

	constructor(arrayBuffer: ArrayBuffer, bigEndian: boolean) {
		this.index = 0;
		this.litteEndian = !bigEndian;
		this.buffer = arrayBuffer;
		this.dataView = new DataView(arrayBuffer);
		this.length = arrayBuffer.byteLength;
	}

	goto(value: number) {
		this.setIndex(value);
	};

	jump(value: number) {
		this.goto(this.index + value);
	};

	readByte(position?: number) {
		this.setIndex(position);
		const b = this.dataView.getInt8(this.index);
		this.index++;
		return b;
	};

	writeByte(value: number, position?: number) {
		this.setIndex(position);
		this.dataView.setInt8(this.index,value);
		this.index++;
	};

	readUbyte(position?: number): number {
		this.setIndex(position);
		const b = this.dataView.getUint8(this.index);
		this.index++;
		return b;
	};

	writeUByte(value: number, position?: number) {
		this.setIndex(position);
		this.dataView.setUint8(this.index,value);
		this.index++;
	};

	readLong = this.readUint;
	readDWord = this.readUint
	readUint(position?: number): number {
		this.setIndex(position);
		const i = this.dataView.getUint32(this.index,this.litteEndian);
		this.index+=4;
		return i;
	};

	writeLong = this.writeUint;
	writeDWord = this.writeUint;
	writeUint(value: number, position?: number) {
		this.setIndex(position);
		this.dataView.setUint32(this.index,value,this.litteEndian);
		this.index+=4;
	};

	readBytes(len: number, position: number): Uint8Array {
		this.setIndex(position);
		const buffer = new Uint8Array(len);
		let i = this.index;
		if ((len += i) > this.length) len = this.length;
		let offset = 0;

		for (; i < len; ++i)
			buffer[offset++] = this.dataView.getUint8(i);
		this.index = len;
		return buffer;
	};

	readString(len: number, position?: number): string {
		this.setIndex(position);
		let i = this.index;
		const src = this.dataView;
		let text = "";

		if ((len += i) > this.length) len = this.length;

		for (; i < len; ++i) {
			const c = src.getUint8(i);
			if (c == 0) break;
			text += String.fromCharCode(c);
		}

		this.index = len;
		return text;
	};

	writeString(value: string, position?: number) {
		this.setIndex(position);
		const src = this.dataView;
		const len = value.length;
		for (let i = 0; i < len; i++) src.setUint8(this.index + i,value.charCodeAt(i));
		this.index += len;
	};

	writeStringSection(value: string, max: number, paddValue?: number, position?: number) {
		this.setIndex(position);
		max = max || 1;
		value = value || "";
		paddValue = paddValue || 0;
		const len = value.length;
		if (len>max) value = value.substr(0,max);
		this.writeString(value);
		this.fill(paddValue,max-len);
	};

	// same as readUshort
	readWord(position?: number): number {
		this.setIndex(position);
		const w = this.dataView.getUint16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	writeWord(value: number, position?: number) {
		this.setIndex(position);
		this.dataView.setUint16(this.index,value,this.litteEndian);
		this.index += 2;
	};

	readShort(value?: number, position?: number): number {
		this.setIndex(position);
		const w = this.dataView.getInt16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	clear(length: number) {
		this.fill(0,length);
	};

	fill(value?: number,length?: number) {
		value = value || 0;
		length = length || 0;
		for (let i = 0; i<length; i++) {
			this.writeByte(value);
		}
	};

	isEOF(margin?: number): boolean {
		margin = margin || 0;
		return this.index >= (this.length-margin);
	};

	private setIndex(value: number| undefined) {
		value = value === 0 ? value : value || this.index;
		if (value<0) value = 0;
		if (value >= this.length) value = this.length-1;

		this.index = value;
	}
};
