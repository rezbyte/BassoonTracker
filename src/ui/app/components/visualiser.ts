import Panel from "../../components/panel";
import { Touch } from "../../input";
import Audio from "../../../audio";
import { Y } from "../../yascal/yascal";
import EventBus, { TrackStateChangeValue } from "../../../eventBus";
import { EVENT } from "../../../enum";
import Tracker from "../../../tracker";
import { UI } from "../../main";

enum MODES {
    WAVE,
    SPECTRUM,
    TRACKS
};

interface AnalyserPosition {
    left: number,
	top: number,
	width: number,
	height: number,
    lineLeft: number,
    lineWidth: number
}
export default class Visualiser extends Panel {
    private modeIndex = 2;
    private mode =  MODES[this.modeIndex];
    private analyser: AnalyserNode | null = null;
    private background: HTMLCanvasElement | undefined;
    private trackAnalyser: AnalyserNode[] = [];
    private trackMuteState: boolean[] = [];
    private analyserPos: AnalyserPosition[] = [];
    private analyserSize = 256;

    constructor() { // UI.visualiser
        super();
        this.ctx.fillStyle = 'black';
        this.ctx.lineWidth = 2;
        //this.ctx.strokeStyle = 'rgba(0, 255, 0,0.5)';
        //this.ctx.strokeStyle = 'rgba(255, 221, 0, 0.3)';
        this.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';
        this.init();
        EventBus.on(EVENT.screenRender,() => {
            this.render();
        });
    
        EventBus.on(EVENT.second,() => {
            if (Tracker.isPlaying()){
                // lower fft size on slower machines
                const fps = UI.getAverageFps();
                if (fps<32 && this.analyserSize>32){
                    this.analyserSize >>= 1;
                    this.analyserSize = Math.max(this.analyserSize,32);
                    UI.resetAverageFps();
                    console.warn("Low framerate, setting analyser FFT size to " + this.analyserSize);
                }
            }
        });
    }

    private init() {
        if (Audio.context){
            this.analyser = Audio.context.createAnalyser();
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            this.analyser.smoothingTimeConstant = 0.85;

            for (let i = 0; i<Tracker.getTrackCount(); i++){
                this.addAnalyser();
            }
			this.setAnalyserPositions();
        }

        const oscilloscope = Y.getImage("oscilloscope");
        if (oscilloscope == null) {
            console.error("Visualizer failed to get image: oscilloscope!");
            return;
        } 
		this.background = oscilloscope;

        EventBus.on(EVENT.filterChainCountChange,(trackCount: number) => {
            for (let i = this.trackAnalyser.length; i<trackCount; i++){
                this.addAnalyser()
            }
			this.setAnalyserPositions();
            this.connect();
        });

		EventBus.on(EVENT.trackStateChange,(state: TrackStateChangeValue) => {
			if (typeof state.track !== "undefined"){
				this.trackMuteState[state.track] = state.mute;
			}
		});


        this.needsRendering = true;
    };

    private addAnalyser(){
        const a = Audio.context.createAnalyser();
        a.smoothingTimeConstant = 0;
        a.fftSize = this.analyserSize;
        this.trackAnalyser.push(a);
    }

    connect(audioNode?: AudioNode) {
        if (Audio.context){
            if (audioNode && this.analyser) audioNode.connect(this.analyser);

            for (let i = 0; i< Tracker.getTrackCount(); i++){
                Audio.getFilterChain(i).output().connect(this.trackAnalyser[i]);
            }
        }

    };

    nextMode() {
        const modesLength = Object.entries(MODES).length;
        this.modeIndex = (this.modeIndex + 1) % modesLength;
        this.mode = MODES[this.modeIndex];
        console.log("setting visualiser to mode " + this.mode);
    };

    private modeWaveRender() {
        if (this.analyser == null) return;
        this.ctx.clearRect(0,0,this.width,this.height);

        this.analyser.fftSize = 256;
        const bufferLength = this.analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        
        this.drawWave(bufferLength, dataArray);
    };
    
    private drawWave(bufferLength: number, dataArray: Uint8Array) {
        if (this.analyser == null) return;
        this.analyser.getByteTimeDomainData(dataArray);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';
        this.ctx.beginPath();
        const sliceWidth = this.width * 1.0 / bufferLength;
        let wx = 0;

        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const wy = v * this.height/2;

            if(i === 0) {
                this.ctx.moveTo(wx, wy);
            } else {
                this.ctx.lineTo(wx, wy);
            }

            wx += sliceWidth;
        }

        this.ctx.lineTo(this.width, this.height/2);
        this.ctx.stroke();

        this.parentCtx.drawImage(this.canvas,this.left, this.top);
    }

    private modeSpectrumRender() {
        if (this.analyser == null) return;
        this.ctx.clearRect(0,0,this.width,this.height);

        this.analyser.fftSize = 128;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const lowTreshold = 8;
        const highTreshold = 8;
        const max = bufferLength-highTreshold;

        const visualBufferLength = bufferLength - lowTreshold - highTreshold;

        this.analyser.getByteFrequencyData(dataArray);

        const barWidth = (this.width - visualBufferLength) / visualBufferLength;
        let barHeight;
        let wx = 0;

        // only display range

        for(let i = lowTreshold; i < max; i++) {
            barHeight = dataArray[i];

            this.ctx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
            this.ctx.fillRect(wx,this.height-barHeight/2,barWidth,barHeight/2);

            wx += barWidth + 1;
        }

        this.ctx.drawImage(this.canvas,this.left, this.top);


    };

    private modeTracksRender() {
        this.ctx.clearRect(0,0,this.width,this.height);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)';

        const hasVolume = Audio.hasVolume;

        for (let trackIndex = 0; trackIndex<Tracker.getTrackCount();trackIndex++){

            const track = this.trackAnalyser[trackIndex];
            const pos = this.analyserPos[trackIndex];

            const isMute = this.trackMuteState[trackIndex];

            if (this.background) this.ctx.drawImage(this.background,pos.left,pos.top,pos.width,pos.height);

            if (track){
                this.ctx.beginPath();

                let wy;
                let wx = pos.lineLeft;
                let ww = pos.lineWidth;

                if (hasVolume && !isMute){

                    track.fftSize = this.analyserSize;
                    const bufferLength = track.fftSize;
                    const dataArray = new Uint8Array(bufferLength);
                    track.getByteTimeDomainData(dataArray);

                    const sliceWidth = ww/bufferLength;

                    for(let i = 0; i < bufferLength; i++) {
                        const v = dataArray[i] / 128.0;
                        wy = v * pos.height/2 + pos.top;

                        if(i === 0) {
                            this.ctx.moveTo(wx, wy);
                        } else {
                            this.ctx.lineTo(wx, wy);
                        }

                        wx += sliceWidth;
                    }
                }else{
                    wy = pos.height/2 + pos.top;
                    this.ctx.moveTo(wx, wy);
                    this.ctx.lineTo(wx + ww-1, wy);
                }

                //myCtx.lineTo(aWidth, height/2);
                this.ctx.stroke();

                if (isMute){
                    this.ctx.fillStyle = "rgba(34, 49, 85, 0.5)";
                    this.ctx.fillRect(pos.left,pos.top,pos.width,pos.height);
                }
            }
        }

        this.parentCtx.drawImage(this.canvas,this.left, this.top);
        //this.ctx.drawImage(this.canvas,this.left, this.top);
    };

    private modeDotsRender() {
        this.ctx.clearRect(0,0,this.width,this.height);

        this.ctx.fillStyle = 'rgba(120, 255, 50, 0.7)';
        this.ctx.strokeStyle = 'rgba(120, 255, 50, 0.5)'; // this.ctx.lineStyle

        const hasVolume = Audio.hasVolume;
        const bufferLength = this.analyserSize;
        const dataArray = new Uint8Array(bufferLength);

        for (let trackIndex = 0; trackIndex<Tracker.getTrackCount();trackIndex++){

            const track = this.trackAnalyser[trackIndex];
            const pos = this.analyserPos[trackIndex];

            const isMute = this.trackMuteState[trackIndex];

            if (this.background) this.ctx.drawImage(this.background,pos.left,pos.top,pos.width,pos.height);

            if (track){
                this.ctx.beginPath();

                let wy;
                let wx = pos.lineLeft;
                let ww = pos.lineWidth;

                if (hasVolume && !isMute){

                    track.fftSize = this.analyserSize;
                    track.getByteTimeDomainData(dataArray);

                    const sliceWidth = ww/bufferLength;

                    for(let i = 0; i < bufferLength; i++) {
                        const v = dataArray[i] / 128.0;
                        wy = v * pos.height/2 + pos.top;

                        this.ctx.fillRect(wx,wy,sliceWidth,2);

                        //if(i === 0) {
                            //this.ctx.moveTo(wx, wy);
                        //} else {
                            //this.ctx.lineTo(wx, wy);
                        //}

                        wx += sliceWidth;
                    }
                }else{
                    wy = pos.height/2 + pos.top;
                    this.ctx.fillRect(wx,wy,ww-1,2);
                    //this.ctx.moveTo(wx, wy);
                    //this.ctx.lineTo(wx + ww-1, wy);
                }

                //myCtx.lineTo(aWidth, height/2);
                //this.ctx.stroke();

                if (isMute){
                    this.ctx.fillStyle = "rgba(34, 49, 85, 0.5)";
                    this.ctx.fillRect(pos.left,pos.top,pos.width,pos.height);
                }
            }
        }

        //this.parentCtx.drawImage(this.canvas,this.left, this.top);
        this.ctx.drawImage(this.canvas,this.left, this.top);
    };

    render(internal?: boolean) {

        if (!Audio.context) return;
        if (!this.isVisible()) return;
        //modeDotsRender();
        this.modeTracksRender();
        //modeSpectrumRender();
        return undefined;
    };

    private setAnalyserPositions() {
		this.analyserPos = [];

		let cols = Tracker.getTrackCount();
		let aHeight = this.height;

		if (Tracker.getTrackCount()>4){
		    cols = Math.ceil(Tracker.getTrackCount()/2);
			aHeight = this.height/2
        }
		const aWidth = this.width/cols;

		for (let i = 0; i < Tracker.getTrackCount(); i++){
		    let aLeft = i*aWidth;
		    let aTop = 0;
		    if (i>=cols){
				aLeft = (i-cols)*aWidth;
				aTop = this.height - aHeight;
            }
			this.analyserPos[i] = {
			    left: Math.floor(aLeft),
				top: Math.floor(aTop),
			    width: Math.floor(aWidth),
			    height: Math.floor(aHeight),
                lineLeft: Math.ceil(aLeft + aWidth/70),
                lineWidth: Math.floor(aWidth - (aWidth/30))
            }
        }
    }

	onResize() {
		this.setAnalyserPositions();
	};

	onClick(touchData: Touch) {
		if (this.mode===MODES[MODES.TRACKS]){
			for (let trackIndex = 0; trackIndex<Tracker.getTrackCount();trackIndex++){

				const pos = this.analyserPos[trackIndex];
				const x = touchData.x;
				const y = touchData.y;
				if (x>pos.left && x<pos.left+pos.width && y>pos.top && y<pos.top+pos.height){
					EventBus.trigger(EVENT.trackScopeClick,trackIndex);
					break;
				}
			}
		}
	};
}