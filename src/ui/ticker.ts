import EventBus from "../eventBus";
import { EVENT } from "../enum";

class Ticker {
	// groups UI related timers
	private tick2Handler?: () => void;
	private tick4Handler?: () => void;
	private onEachTick2Delay: number = 0;
	private onEachTick4Delay: number = 0;
	private onEachTick2Count: number = 0;
	private onEachTick4Count: number = 0;
	private ticker2 = 0;
	private ticker4 = 0;
	private tickerActive: boolean = false;

	private OnScreenRefresh() {
		if (this.tickerActive){
			this.ticker2 = 1-this.ticker2;
			if (this.ticker2){
				this.ticker4 = 1-this.ticker4;
				if (this.tick2Handler) {
					this.onEachTick2Count++;
					if (this.onEachTick2Count>this.onEachTick2Delay) this.tick2Handler();
				}
				if (this.ticker4){
					if (this.tick4Handler) {
						this.onEachTick4Count++;
						if (this.onEachTick4Count>this.onEachTick4Delay) this.tick4Handler();
					}
				}
			}
		}
	}
	
	constructor() {
		EventBus.on(EVENT.screenRefresh,this.OnScreenRefresh.bind(this));
	}

	onEachTick2(handler?: () => void, delay?: number){
		this.onEachTick2Count = 0;
		this.onEachTick2Delay = delay || 0;
		this.tick2Handler = handler;
		this.tickerActive = !!this.tick2Handler || !!this.tick4Handler;
	};

	onEachTick4(handler?: () => void, delay?: number){
		this.onEachTick4Count = 0;
		this.onEachTick4Delay = delay || 0;
		this.tick4Handler = handler;
		this.tickerActive = !!this.tick2Handler || !!this.tick4Handler;
	};

};

export default new Ticker();