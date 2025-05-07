import { LegacyKeyboardEvent } from "../basetypes";
import type { TouchData, Touch, Drag } from "../input";
import { ctx } from "../main";

interface Dimensions {
    left: number;
    top: number;
    width:number;
    height: number;
    visible?: boolean;
}

export interface ElementProperties {
    left?: number;
    top?: number;
    width?:number;
    height?: number;
    name?: string
    type?: string
    zIndex?: number
}

export interface Changeable<T> {
    onChange?(value: T): void,
}

export default interface Element {
    setProperties?(properties: Dimensions): void,
    render(internal?: boolean): HTMLCanvasElement | void,
    render(internal: true): HTMLCanvasElement | void,
    render(internal: false): void,
    render(): void,
    activate?(): void,
    deActivate?(target?: Element): void,
    onHide?(): void,
    onShow?(): void,
    onResize?(): void,
    onDown?(touchData?: Touch): void,
    onHover?(touchData: TouchData): void,
    onHoverExit?(touchData?: TouchData, target?: Element): void,
    onDrag?(touchData: Drag): void,
    onDragStart?(touch?: Touch): void,
    onKeyDown?(keycode: number, event: LegacyKeyboardEvent): boolean | undefined,
    onClick?(touch: Touch): void,
    onTouchUp?(touch?: Touch): void,
    onMouseWheel?(touchData?: TouchData): void
}

export default class Element { 
    left: number;
    top: number;
    width:number;
    height: number;
    visible: boolean;
    needsRendering: boolean
    protected parentCtx: CanvasRenderingContext2D
    ctx: CanvasRenderingContext2D // Public for WaveForm.waveformDisplay
    canvas: HTMLCanvasElement // Public for WaveForm.waveformDisplay
    children: Element[]
    parent: Element | undefined
    name: string | undefined
    zIndex: number | undefined
    scaleX: number | undefined
    scaleY: number | undefined
    eventX: number | undefined
    eventY: number | undefined
    scrollOffsetX: number | undefined
    scrollOffsetY: number | undefined
    ignoreEvents: boolean | undefined
    type: string

    constructor(left?: number, top?:number, width?:number, height?:number) { // Formerly UI.Element
        this.left = left || 0;
        this.top = top || 0;
        this.width = width || 20;
        this.height = height || 20;

        this.visible = true;
        this.needsRendering = true;
        this.parentCtx = ctx;

        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d")!; // TODO: Nicer way to handle null
        this.children = [];
        this.type = "element";
    }

    hide(){
        this.visible = false;
        if (this.onHide) this.onHide();
    };
    show(andRefresh?: boolean, andRefreshAllChildren?: boolean){
        this.visible = true;
        if (andRefresh) this.refresh(andRefreshAllChildren);
        if (this.onShow) this.onShow();
    };
    toggle(state?: boolean){
        if (typeof state === "boolean"){
            if (state) {
                this.show();
            }else{
                this.hide();
            }
        }else{
            if (this.visible){
                this.hide();
            }else{
                this.show();
            }
        }

    };

    isVisible() {
        let result = this.visible;
        let parent = this.parent;
        while (result && parent) {
            result = parent.visible;
            parent = parent.parent;
        }
        return result;
    };

    containsPoint(x: number, y: number): boolean {
        const left = this.left;
        const right = this.left+this.width;
        const top = this.top;
        const bottom = this.top+this.height;

        return ((x >= left) && (x <= right) && (y >= top) && (y <= bottom));
    };

    getElementAtPoint(_x: number,_y: number): Element {
        _x -= (this.left + (this.scrollOffsetX || 0));
        _y -= (this.top + (this.scrollOffsetY || 0));

        if (this.scaleX) _x /= this.scaleX;
        if (this.scaleY) _y /= this.scaleY;

        let currentEventTarget;
        for (let i = this.children.length-1; i>=0; i--){
            const elm = this.children[i];
            if (elm.isVisible() && !elm.ignoreEvents && elm.containsPoint(_x,_y)){
                currentEventTarget = elm;
                break;
            }
        }

        // TODO: how does this work in multitouch? seems this should be part of the touchData object, no ?
        // Update: assigned it to localX and localY -> update all components ?
        if (currentEventTarget){
            const child = currentEventTarget.getElementAtPoint(_x,_y);
            if (child){
                currentEventTarget = child;
            }else{
                currentEventTarget.eventX = _x;
                currentEventTarget.eventY = _y;
            }
        }else{
            currentEventTarget = this;
            currentEventTarget.eventX = _x;
            currentEventTarget.eventY = _y;
        }



        return currentEventTarget;
    };

    setParent(parentElement?: Element){
        this.parent = parentElement;
        if (parentElement){
            this.parentCtx = parentElement.ctx;
        }
    };

    addChild(elm: Element){
        elm.setParent(this);
        elm.zIndex = elm.zIndex || this.children.length;
        this.children.push(elm);
    };

    getChild(name: string): Element | undefined {
        let i = this.children.length;
        let child;
        while (i){
            child = this.children[i];
            if (child && child.name && child.name == name) return child;
            i--;
        }
    };

    refresh(refreshChildren?: boolean){
        this.needsRendering = true;
        if (refreshChildren){
            console.error("refresh children " + this.name);
            let i = this.children.length;
            let child;
            while (i){
                child = this.children[i];
                if (child) child.refresh();
                i--;
            }
        }
        if (this.visible && this.parent && this.parent.refresh) this.parent.refresh();
    };

    setSize(_w: number, _h: number){
        this.width = Math.max(_w,1);
        this.height = Math.max(_h,1);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        if (this.onResize) this.onResize();
        this.refresh();
    };
    setPosition(_x: number,_y: number){
        this.left = _x;
        this.top = _y;
        this.refresh();
    };

    setDimensions(properties: Dimensions){
        const visible = (typeof properties.visible === "boolean") ? properties.visible : true;
        if (visible){
            if (this.setProperties){
                this.setProperties(properties);
            }else{
                this.setPosition(properties.left,properties.top);
                this.setSize(properties.width,properties.height);
            }
        }else{
            //element.hide();
        }
    };

    clearCanvas(){
        this.ctx.clearRect(0,0,this.width,this.height);
    };
}
