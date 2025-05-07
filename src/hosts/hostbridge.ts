interface File {
    Path: string,
}
  
export interface Message {
    type: string, 
    command: string, 
    message: string,
    callbackId: string,
    callback: string,
    files?: File[] | string
    data: {data: ArrayBuffer, filename: string}
}

export default interface HostBridge {
    useUrlParams?: boolean,
    useDropbox: boolean,
    showInternalMenu: boolean,
    useWebWorkers?: boolean,
    init(): void,
    getBaseUrl?: () => string,
    getRemoteUrl?: () => string,
    getVersionNumber?: () => string,
    getBuildNumber?: () => number,
    signalReady?: () => void
}
