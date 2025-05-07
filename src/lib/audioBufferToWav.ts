// based on https://github.com/Jam3/audiobuffer-to-wav/

export default function audioBufferToWav (buffer: AudioBuffer, opt?: {float32: boolean}): ArrayBuffer {
	const numChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const format = opt?.float32 ? 3 : 1;
	const bitDepth = format === 3 ? 32 : 16;


	function interleave (inputL: Float32Array, inputR: Float32Array): Float32Array {
		const length = inputL.length + inputR.length;
		const interleaveResult = new Float32Array(length);

		let index = 0;
		let inputIndex = 0;

		while (index < length) {
			interleaveResult [index++] = inputL[inputIndex];
			interleaveResult [index++] = inputR[inputIndex];
			inputIndex++
		}
		return interleaveResult;
	}

	let result;
	if (numChannels === 2) {
		result = interleave(buffer.getChannelData(0), buffer.getChannelData(1))
	} else {
		result = buffer.getChannelData(0)
	}

	return encodeWAV(result, format, sampleRate, numChannels, bitDepth);

}



function encodeWAV (samples: Float32Array, format: number, sampleRate: number, numChannels: number, bitDepth: number): ArrayBuffer {


	const bytesPerSample = bitDepth / 8;
	const blockAlign = numChannels * bytesPerSample;

	const bufferLength = 44 + samples.length * bytesPerSample;

	const buffer = new ArrayBuffer(bufferLength);
	const view = new DataView(buffer);

	/* RIFF identifier */
	writeString(view, 0, 'RIFF');
	/* RIFF chunk length */
	view.setUint32(4, 36 + samples.length * bytesPerSample, true);
	/* RIFF type */
	writeString(view, 8, 'WAVE');
	/* format chunk identifier */
	writeString(view, 12, 'fmt ');
	/* format chunk length */
	view.setUint32(16, 16, true);
	/* sample format (raw) */
	view.setUint16(20, format, true);
	/* channel count */
	view.setUint16(22, numChannels, true);
	/* sample rate */
	view.setUint32(24, sampleRate, true);
	/* byte rate (sample rate * block align) */
	view.setUint32(28, sampleRate * blockAlign, true);
	/* block align (channel count * bytes per sample) */
	view.setUint16(32, blockAlign, true);
	/* bits per sample */
	view.setUint16(34, bitDepth, true);
	/* data chunk identifier */
	writeString(view, 36, 'data');
	/* data chunk length */
	view.setUint32(40, samples.length * bytesPerSample, true);

	let offset = 44;
	let i;

	if (format === 1) { // Raw PCM
		for (i = 0; i < samples.length; i++, offset += 2) {
			const s = Math.max(-1, Math.min(1, samples[i]));
			view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
		}
	} else {

		for (i = 0; i < samples.length; i++, offset += 4) {
			view.setFloat32(offset, samples[i], true)
		}
	}

	function writeString (view: DataView, offset: number, string: string) {
		for (let i = 0; i < string.length; i++) {
			view.setUint8(offset + i, string.charCodeAt(i))
		}
	}

	return buffer
}


