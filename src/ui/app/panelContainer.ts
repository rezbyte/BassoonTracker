import Panel from "../components/panel";
import Scale9Panel from "../components/scale9";
import { canvas } from "../main";
import Assets from "../assets";

export default interface AppPanelContainer {
    onPanelResize(): void
}
export default class AppPanelContainer extends Panel {
    private background: Scale9Panel;

    constructor(height?: number) { // UI.app_panelContainer
        super(0,0,canvas.width,height); // super(0,0,canvas.width,height,true);
        this.background = new Scale9Panel(0,0,this.width,this.height,Assets.panelMainScale9);
        this.background.ignoreEvents = true;
        this.addChild(this.background);
    }

    onResize() {
        this.background.setSize(this.width, this.height);
        if (this.onPanelResize) this.onPanelResize();
    };
}