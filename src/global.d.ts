interface Window {
    reload(): void,
    webkitAudioContext: AudioContext,
    webkitOfflineAudioContext: OfflineAudioContext,
    addEventListener(type: "undo", listener: (this: Window, ev: ClipboardEvent) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: "delete", listener: (this: Window, ev: ClipboardEvent) => any, options?: boolean | AddEventListenerOptions): void
}

interface Location {
    reload(forceGet: boolean): void // forceGet is a firefox-only parameter
}

interface Navigator {
    msPointerEnabled?: boolean // Whether Internet Explorer 10 pointer events are supported
}

interface HTMLCanvasElement {
    addEventListener(type: "MSPointerDown", listener: (this: HTMLCanvasElement, ev: TouchEvent) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: "MSPointerMove", listener: (this: HTMLCanvasElement, ev: MouseEvent) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: "MSPointerEnd", listener: (this: HTMLCanvasElement, ev: MouseEvent) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: "mousewheel", listener: (this: HTMLCanvasElement, ev: WheelEvent) => any, options?: boolean | AddEventListenerOptions): void
    addEventListener(type: "DOMMouseScroll", listener: (this: HTMLCanvasElement, ev: WheelEvent) => any, options?: boolean | AddEventListenerOptions): void
}