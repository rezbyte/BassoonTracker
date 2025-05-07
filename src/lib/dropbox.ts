//https://github.com/JamesMaroney/dropbox-js - MIT license
// updates by Steffest

type OnCompleteHandler = (result: {account_id: string, entries: {id: string, name: string, size: number, ".tag": string, path_lower: string, path_display: string}[]}, a: Blob, b: XMLHttpRequest) => void;
interface CallHandlers {
    onComplete: OnCompleteHandler, 
    onError?: (a: XMLHttpRequestEventTarget | null) => void,
    onDownloadProgress?: (ev: ProgressEvent<XMLHttpRequestEventTarget>) => void,
    onUploadProgress?: (ev: ProgressEvent<XMLHttpRequestEventTarget>) => void
}

interface UrlParameters {
    state: string, 
    access_token?: string
}

interface CallReturn {
    apiResponse: any, 
    response: Blob, 
    r: XMLHttpRequest
}

class DropboxService {
    private static api = 'https://api.dropboxapi.com/2/'
    private static content = 'https://content.dropboxapi.com/2/'
    private globalErrorHandler: ((e: XMLHttpRequestEventTarget | UrlParameters | null, er: void) => void) | undefined = undefined;
    private static endpointMapping = {
        'auth/token/revoke': { contentType: null },
        'users/get_current_account': { contentType: 'application/json' },
        'files/upload': { baseUri: DropboxService.content, format: 'content-upload' },
        'files/get_thumbnail': { baseUri: DropboxService.content, format: 'content-download' },
        'files/download' : { baseUri: DropboxService.content, format: 'content-download' },
        'files/get_preview': {baseUri: DropboxService.content, format: 'content-download' },
        'files/upload_session/append': {baseUri: DropboxService.content, format: 'content-upload'},
        'files/upload_session/append_v2': {baseUri: DropboxService.content, format: 'content-upload'},
        'files/upload_session/finish': {baseUri: DropboxService.content, format: 'content-upload'},
        'files/upload_session/start': {baseUri: DropboxService.content, format: 'content-upload'},
        'files/get_shared_link_file': {baseUri: DropboxService.content, format: 'content-download'}
    };
    private static contentTypeMapping: Record<string,string> = {
        'rpc' : 'application/json',
        'content-upload' : 'application/octet-stream'
    };
    call(endpoint: keyof typeof DropboxService.endpointMapping | string, apiArgs?: {responseType?: XMLHttpRequestResponseType, path: string}, content?: Blob, handlers?: CallHandlers | OnCompleteHandler): Promise<CallReturn> | null { // var dropbox = function
        //var args = [].slice.call(arguments);

        const config: {contentType?: string | null, baseUri?: string, format?: string} = DropboxService.endpointMapping[endpoint as keyof typeof DropboxService.endpointMapping] || {};
        const baseUri = config?.baseUri || DropboxService.api;
        const format = config?.format || 'rpc';
        const contentType = config.contentType || (config.contentType === null) ? null : DropboxService.contentTypeMapping[format];

        //var lastArg = args[args.length - 1];
        //let handlers = (args.length > 2 && (DropboxService.isObject(lastArg) || DropboxService.isFunction(lastArg))) ? lastArg : {};
        if(DropboxService.isFunction(handlers)) handlers = { onComplete: handlers };

        let promise: Promise<CallReturn> | null = null; 
        let promisectl: Partial<{resolve(value: CallReturn | PromiseLike<CallReturn>): void, reject(value: XMLHttpRequestEventTarget | null): void}> = {};
        if(Promise){
            promise = new Promise(function(resolve,reject){ promisectl.resolve = resolve; promisectl.reject = reject });
        }

        const r = new XMLHttpRequest();

        r.open('POST', baseUri+endpoint, true);
        r.setRequestHeader('Authorization', 'Bearer '+ (this.tokenStore('__dbat') || '000000000000000000000000_00000-000000000000000000000000000000000') );

        if(format == 'content-download') r.responseType = 'blob';
        if(apiArgs && apiArgs.responseType){
            r.responseType = apiArgs.responseType;
            delete apiArgs.responseType;
        }

        if(contentType) r.setRequestHeader('Content-Type', contentType);
        if(apiArgs && (format == 'content-upload' || format == 'content-download'))
            r.setRequestHeader('Dropbox-API-Arg', JSON.stringify(apiArgs));

        if(handlers?.onDownloadProgress) r.addEventListener("progress", handlers.onDownloadProgress);
        if(handlers?.onUploadProgress && r.upload) r.upload.addEventListener("progress", handlers.onUploadProgress);
        if(handlers?.onError || this.globalErrorHandler) r.addEventListener("error", (e) => {
            const er = handlers?.onError && handlers.onError(e.target);
            promise && promisectl.reject && promisectl.reject(e.target);
            this.globalErrorHandler && this.globalErrorHandler(e.target, er);
        });

        r.onreadystatechange = () => {
            if (r.readyState != 4 ) return;
            if (r.status == 200) {
                const apiResponse = JSON.parse( r.getResponseHeader('dropbox-api-result') || r.responseText );
                if(endpoint=='auth/token/revoke') this.tokenStore('__dbat', '');
                handlers?.onComplete && handlers.onComplete( apiResponse, r.response, r);
                promise && promisectl.resolve && promisectl.resolve({apiResponse, response: r.response, r});
            } else {
                const er = handlers?.onError && handlers.onError(r);
                promise && promisectl.reject && promisectl.reject(r);
                this.globalErrorHandler && this.globalErrorHandler(r, er);
            }
        };

        let requestPayload: string | Blob | null = (content && format == 'content-upload') ? content : null; // (args.length > 2 && format == 'content-upload') ? args[2] : undefined;
        requestPayload = requestPayload || ( (apiArgs && format == 'rpc') ? JSON.stringify(apiArgs) : null );
        if(requestPayload){
            r.send(requestPayload);
        } else {
            r.send();
        }

        return promise;
    };
    setGlobalErrorHandler(handler: typeof this.globalErrorHandler) { 
        this.globalErrorHandler = handler; 
    };
    setTokenStore(store: typeof this.tokenStore){ 
        this.tokenStore = store;
    };
    authenticate(apiArgs: { client_id: string, redirect_uri?: string }, handlers: {onComplete: () => void, onError?: (params: {state: string}) => void} | (() => void)) {
        handlers = handlers || {};
        if(DropboxService.isFunction(handlers)) handlers = { onComplete: handlers };
        apiArgs = apiArgs || {};
        if(DropboxService.isString(apiArgs)) apiArgs = { client_id: apiArgs };
        apiArgs.redirect_uri = apiArgs.redirect_uri || window.location.href;

        let promise: Promise<void> | null = null; 
        let promisectl: Partial<{resolve(value: void | PromiseLike<void>): void, reject(value: UrlParameters): void}> = {};
        if(Promise){
            promise = new Promise(function(resolve,reject){ promisectl.resolve = resolve; promisectl.reject = reject });
        }

        // if we already have an access token, return immediately
        if( this.tokenStore('__dbat') ){
            handlers.onComplete();
            promisectl && promisectl.resolve && promisectl.resolve();
            return promise
        }

        const params = DropboxService.paramsFromUrlHash();
        let csrfToken = this.tokenStore('__dbcsrf');

        if(params.state && csrfToken && params.state == csrfToken){
            // we are returning from authentication redirect
            if(params.access_token){
                // the authentcation was successful
                this.tokenStore('__dbat', params.access_token);
                this.tokenStore('__dbcsrf', '');
                window.location.replace( window.location.href.replace(/#.*/,'') );
            } else {
                // the authentication was not successful
                const er = handlers.onError && handlers.onError(params);
                promisectl && promisectl.reject && promisectl.reject(params);
                this.globalErrorHandler && this.globalErrorHandler(params, er);
            }
        } else {
            // initiate authentication
            csrfToken = ""+Math.floor(Math.random()*100000);
            this.tokenStore('__dbcsrf', csrfToken);

            window.location.assign("https://www.dropbox.com/1/oauth2/authorize?response_type=token&"
                + "client_id="+ encodeURIComponent(apiArgs.client_id) +"&"
                + "redirect_uri="+ encodeURIComponent(apiArgs.redirect_uri) + "&"
                + "state="+ encodeURIComponent(csrfToken));
        }

        return promise;
    };
    getAccessToken(): string {
        return this.tokenStore('__dbat');
    };
    clearAccessToken() {
        return this.tokenStore('__dbat','');
    };
    private tokenStore(key: string, val: string): void;
    private tokenStore(key: string): string;
    private tokenStore(key: string, val?: string): string | void { 
        return ( arguments.length > 1 ) ? (localStorage[key] = val) : localStorage[key]; 
    }
    //private static toString = ({}).toString;
    private static isFunction(x: any): x is Function { 
        return toString.call(x) == '[object Function]'; 
    }
    private static isString(x: any): x is string{ 
        return toString.call(x) == '[object String]'; 
    }
    private static isObject(x: any): x is object{ 
        return toString.call(x) == '[object Object]'; 
    }
    private static paramsFromUrlHash(): UrlParameters {
        return window.location.hash.replace(/^#/,'').split('&').reduce(
            function(o: Partial<UrlParameters>, entry: string){ 
                if(entry=='') return o; 
                const splitEntry = entry.split('='); 
                o[decodeURIComponent(splitEntry[0]) as keyof UrlParameters] = decodeURIComponent(splitEntry[1]); 
                return o;
            },
            {}
        ) as UrlParameters;
    }
}

export default new DropboxService();