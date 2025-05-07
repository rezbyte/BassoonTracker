import Element from "./components/element";
import Host from "../host";
import FetchService from "../fetchService";
import { Y } from "./yascal/yascal";
import { UI } from "./main";
import Scale9Panel from "./components/scale9";
import App from "../app";
import YascalSprite, { Sprite } from "./yascal/sprite";
import Button from "./components/button";
import { ScaleRule, TextAlignment } from "./basetypes";

export interface Scale9 {
	left: number,
	top: number,
	right: number,
	bottom: number,
	img?: HTMLCanvasElement
	scale?: ScaleRule
}

interface AssetInfo {
	generate<T extends Element>(andCache: false): T,
	generate<T extends Element>(andCache: true): void,
	isLoading?: boolean
}

type AssetName = "button20_20" | "button30_30" | "buttonLight" | "buttonDark" | "buttonDarkBlue" | "buttonDarkRed" | "buttonDarkGreen" | "buttonKey";
type AssetMap<T extends AssetName> = 
T extends "button20_20" ? Button :
T extends "button30_30" ? Scale9Panel :
T extends "buttonLight" ? Button :
T extends "buttonDark" ? Button :
T extends "buttonDarkBlue" ? Button :
T extends "buttonDarkRed" ? Button :
T extends "buttonDarkGreen" ? Button :
T extends "buttonKey" ? Button :
never;

// generates and caches frequently used UI assets
class Assets {
	private assets: Partial<Record<AssetName, AssetMap<AssetName>>> = {};
	readonly buttonLightScale9: Scale9 = {
		left: 2,
		top:2,
		right: 4,
		bottom: 4
	};
	readonly buttonLightHoverScale9: Scale9 = {
		left: 2,
		top:2,
		right: 4,
		bottom: 4
	};
	readonly buttonDarkScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkBlueScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkRedScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkRedHoverScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkGreenScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkActiveScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkActiveBlueScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkGreenHoverScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkGreenActiveScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkRedActiveScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkBlueActiveScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonDarkYellowActiveScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly panelMainScale9: Scale9 = {
		left:2,
		top:2,
		right:3,
		bottom: 3
	};
	readonly panelDarkScale9: Scale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	readonly panelDarkHoverScale9: Scale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	readonly panelDarkGreyScale9: Scale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	readonly panelDarkGreyBlueScale9: Scale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	readonly panelTransScale9: Scale9 = {
		left:3,
		top:3,
		right:3,
		bottom: 2
	};
	readonly panelInsetScale9: Scale9 = {
		left:2,
		top:2,
		right:2,
		bottom: 2
	};
	readonly panelDarkInsetScale9: Scale9 = {
		left:2,
		top:2,
		right:2,
		bottom: 2
	};
	readonly buttonKeyScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonKeyHoverScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};
	readonly buttonKeyActiveScale9: Scale9 = {
		left: 5,
		top:5,
		right: 5,
		bottom: 5
	};

	private readonly assetsInfo: Record<AssetName, AssetInfo>;

	constructor() { // Formerly UI.Assets
		this.assetsInfo = {
			button20_20:{
				generate:(andCache) => {
					let result;
					const scale = this.panelDarkScale9;
					//result = UI.scale9Panel(0,0,20,20,scale);
					result = new Button(0,0,20,20);
					result.setProperties({
						background: scale,
						hoverBackground: this.panelDarkHoverScale9,
						textAlign: TextAlignment.center,
						font: UI.fontMed,
						paddingTop: 2
					});
					if (andCache){
						this.assets["button20_20"] = result;
					}else{
						return result;
					}
				}
			},
			button30_30:{
				generate:(andCache) => {
					const scale = this.buttonLightScale9;
					const result = new Scale9Panel(0,0,30,30,scale);
					if (andCache){
						this.assets["button30_30"] = result;
					}else{
						return result;
					}
				}
			},
			buttonLight:{
				generate:(andCache) => {
					const scale = this.buttonLightScale9;
					const result = new Button();
					result.setProperties({
						background: scale,
						hoverBackground: this.buttonLightHoverScale9,
						textAlign: TextAlignment.center,
						font: UI.fontMed
					});
					if (andCache){
						this.assets["buttonLight"] = result;
					}else{
						return result;
					}
				}
			},
			buttonDark:{
				generate:(andCache) => {
					const scale = this.buttonDarkScale9;
					const result = new Button(0,0,20,20);
					result.setProperties({
						background: scale,
						hoverBackground: this.buttonDarkBlueActiveScale9,
						activeBackground:this.buttonDarkActiveScale9,
						isActive:false,
						textAlign: TextAlignment.center,
						font: UI.fontMed
					});
					if (andCache){
						this.assets["buttonDark"] = result;
					}else{
						return result;
					}
				}
			},
			buttonDarkBlue:{
				generate:(andCache) => {
					const result = new Button(0,0,20,20);
					result.setProperties({
						background: this.buttonDarkBlueScale9,
						activeBackground: this.buttonDarkBlueActiveScale9,
						isActive:false,
						textAlign: TextAlignment.center,
						font: UI.fontMed
					});
					if (andCache){
						this.assets["buttonDarkBlue"] = result;
					}else{
						return result;
					}
				}
			},
			buttonDarkRed:{
				generate:(andCache) => {
					const result = new Button(0,0,20,20);
					result.setProperties({
						background: this.buttonDarkRedScale9,
						hoverBackground: this.buttonDarkRedHoverScale9,
						activeBackground: this.buttonDarkRedActiveScale9,
						isActive:false,
						textAlign: TextAlignment.center,
						font: UI.fontMed
					});
					if (andCache){
						this.assets["buttonDarkRed"] = result;
					}else{
						return result;
					}
				}
			},
			buttonDarkGreen:{
				generate:(andCache) => {
					const result = new Button(0,0,20,20);
					result.setProperties({
						background: this.buttonDarkGreenScale9,
						hoverBackground: this.buttonDarkGreenHoverScale9,
						activeBackground: this.buttonDarkGreenActiveScale9,
						isActive:false,
						textAlign: TextAlignment.center,
						font: UI.fontMed
					});
					if (andCache){
						this.assets["buttonDarkGreen"] = result;
					}else{
						return result;
					}
				}
			},
			buttonKey:{
				generate:(andCache) => {
					const result = new Button(0,0,20,20);
					result.setProperties({
						background: this.buttonKeyScale9,
						hoverBackground: this.buttonKeyHoverScale9,
						activeBackground :this.buttonKeyActiveScale9,
						isActive:false,
						textAlign: TextAlignment.center,
						font: UI.fontDark
					});
					if (andCache){
						this.assets["buttonKey"] = result;
					}else{
						return result;
					}
				}
			}
		};
	}

	preLoad(next: () => void) {
		let spriteMap: Sprite[] | undefined;
		let spriteSheet: HTMLImageElement | undefined;
		const baseUrl = Host.getBaseUrl();
		const useVersion = Host.useUrlParams;
		
		function assetUrl(url: string): string {
			url = baseUrl + url;
			if (useVersion) url += ("?v=" + App.buildNumber);
			return url;
		}

		const createSprites = () => {
			if (spriteMap && spriteSheet){
				spriteMap.forEach((spriteData: Sprite) => {
					spriteData.img = spriteSheet;
					Y.sprites[spriteData.name] = new YascalSprite(spriteData);
				});
				if (next) next();
			}
		};
		
		FetchService.json(assetUrl("skin/spritemap_v4.json"),(data: Sprite[] | undefined) => {
			spriteMap = data;
			createSprites();
		});

		Y.loadImage(assetUrl("skin/spritesheet_v4.png"),(img) => {
			spriteSheet = img;
			createSprites();
		})

	};

	// should be executed when all image assets have been loaded:
	init() {
		this.buttonLightScale9.img = Y.getImage("button_light");
		this.buttonLightHoverScale9.img = Y.getImage("button_light_hover");
		this.buttonDarkScale9.img = Y.getImage("button_inlay");
		this.buttonDarkBlueScale9.img = Y.getImage("button_inlay_blue");
		this.buttonDarkRedScale9.img = Y.getImage("button_inlay_red");
		this.buttonDarkRedHoverScale9.img = Y.getImage("button_inlay_red_hover");
		this.buttonDarkGreenScale9.img = Y.getImage("button_inlay_green");
		this.buttonDarkGreenHoverScale9.img = Y.getImage("button_hover_green");
		this.buttonDarkActiveScale9.img = Y.getImage("button_inlay_active");
		this.buttonDarkGreenActiveScale9.img = Y.getImage("button_inlay_green_active");
		this.buttonDarkRedActiveScale9.img = Y.getImage("button_inlay_red_active");
		this.buttonDarkBlueActiveScale9.img = Y.getImage("button_inlay_blue_active");
		this.buttonDarkYellowActiveScale9.img = Y.getImage("button_inlay_yellow_active");
		this.panelMainScale9.img = Y.getImage("background");
		this.panelDarkScale9.img = Y.getImage("bar");
		this.panelDarkHoverScale9.img = Y.getImage("bar_hover");
		this.panelDarkGreyScale9.img = Y.getImage("panel_dark_greyish");
		this.panelDarkGreyBlueScale9.img = Y.getImage("panel_dark_blueish");
		this.panelTransScale9.img = Y.getImage("panel_trans");
		this.panelInsetScale9.img = Y.getImage("panel_inset");
		this.panelDarkInsetScale9.img = Y.getImage("panel_dark");
		this.buttonKeyScale9.img = Y.getImage("keybutton");
		this.buttonKeyHoverScale9.img = Y.getImage("keybutton_hover");
		this.buttonKeyActiveScale9.img = Y.getImage("keybutton_highlight3");

		console.log("Assets init done");

	};

	get<T extends AssetName>(name: AssetName): AssetMap<T> | undefined {
		const result = this.assets[name] as AssetMap<T> | undefined;
		if (result){
			return result;
		}else{
			const asset = this.assetsInfo[name];
			if (asset.isLoading){
				console.log("Asset " + name + " is not ready yet, still loading");
				return undefined;
			}else{
				asset.isLoading = true;
				asset.generate(true);
			}
		}
	};

	put<T extends AssetName>(name: T, asset: AssetMap<T>) {
		this.assets[name] = asset;
	};

	generate<T extends AssetName>(name: T): AssetMap<T> {
		return this.assetsInfo[name].generate(false);
	};
}

export default new Assets();