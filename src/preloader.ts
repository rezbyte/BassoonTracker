import {PRELOADTYPE, cachedAssets} from "./enum";
import Audio from "./audio";

export default class PreLoader {
	private type: PRELOADTYPE = PRELOADTYPE.image;
	private loadCount = 0;
	private max?: number;
	private next?: Function;

	load(urls: string[], type: PRELOADTYPE, next: Function) {
		this.type = type || PRELOADTYPE.image;
		this.loadCount = 0;
		this.max = urls.length;
		this.next = next;

		for (let i = 0, len = urls.length; i < len; i++)
			this.loadAsset(urls[i]);
	};

	private loadAsset(url: string) {
		const getLoadCount = this.getLoadCount;
		if (this.type == PRELOADTYPE.image){
			const img = new Image();
			img.onload = () => {getLoadCount(url, this)};
			img.onerror = function(){
				alert('BufferLoader: XHR error');
			};
			img.src = url;
		}

		if (this.type == PRELOADTYPE.audio){
			const req = new XMLHttpRequest();
			req.responseType = "arraybuffer";
			req.open("GET", url, true);
			req.onload = function() {
				// Asynchronously decode the audio file data in request.response
				Audio.context.decodeAudioData(
					req.response,
					function(buffer) {
						if (!buffer) {
							alert('error decoding file data: ' + url);
							return;
						}
						getLoadCount(url, buffer);
					},
					function(error) {
						console.error('decodeAudioData error', error);
					}
				);
			};

			req.onerror = function() {
				alert('BufferLoader: XHR error');
			};

			req.send();
		}

		


		//request.responseType = "arraybuffer";
	};
	private getLoadCount(url: string, object: object) {
		cachedAssets.images[url] = object;
			if (++this.loadCount == this.max)
				if (this.next) this.next();
	};
};
