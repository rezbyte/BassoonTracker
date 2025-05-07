import Host from "./host";

type Next<T> = (param?: T, xhr?: XMLHttpRequest) => void;

type Config<T> = {
  method?: string
  url: string
  cache?: boolean
  data?: Document | XMLHttpRequestBodyInit | null
  datatype?: string
  headers?: { key: string, value: string }[]
  timeout?: number
  success: (data: T) => void
  error: (xhr: XMLHttpRequest) => void
}

class FetchService {
  // somewhat Jquery syntax compatible for easy portability

  private defaultAjaxTimeout = 30000;

  get(url: string, next: Next<string>) {
    this.ajax({
      url: url,
      success: (data: string) => {
        next(data);
      },
      error: (xhr: XMLHttpRequest) => {
        next(undefined, xhr);
      },
    });
  }

  //<!--
  post(url: string, data: string | object, next: Next<string>) {
    let sData: string | null = null;
    if (typeof data === "object") {
      sData = "";
      for (const [key, value] of Object.entries(data)) {
        sData += "&" + key + "=" + encodeURIComponent(value);
      }
      if (sData.length) sData = sData.substr(1);
    } else {
      sData = data;
    }
    this.ajax({
      method: "POST",
      url: url,
      data: sData,
      datatype: "form",
      success: (data: string) => {
        next(data);
      },
      error: (xhr: XMLHttpRequest) => {
        next(undefined, xhr);
      },
    });
  }

  sendBinary(url: string, data: ArrayBuffer | FormData, next: Next<string>) {
    this.ajax({
      method: "POST",
      url: url,
      data: data,
      success: (data: string) => {
        next(data);
      },
      error: (xhr: XMLHttpRequest) => {
        next(undefined, xhr);
      },
    } as Config<string>);
  }
  //-->

  json<T>(url: string, next?: Next<T>) {
    if (typeof next == "undefined") next = () => {};
    this.ajax({
      url: url,
      cache: false,
      datatype: "json",
      headers: [{ key: "Accept", value: "application/json" }],
      success: (data: T) => {
        next(data);
      },
      error: (xhr) => {
        next(undefined, xhr);
      },
    });
  }

  html(url: string, next: Next<HTMLDivElement>) {
    this.ajax({
      url: url,
      cache: false,
      datatype: "html",
      success: (data: HTMLDivElement) => {
        next(data);
      },
      error: (xhr: XMLHttpRequest) => {
        next(undefined, xhr);
      },
    });
  }

  ajax<T>(config: Config<T>) {
    const xhr = new XMLHttpRequest();

    //config.error = config.error ?? () => {config.success(false);};

    if (config.datatype === "jsonp") {
      console.error(" ERROR: JSONP is not supported!"); //  console.error(log.error() + " ERROR: JSONP is not supported!");
      config.error(xhr);
    }

    let url = config.url;

    if (
      typeof config.cache === "boolean" &&
      !config.cache &&
      Host.useUrlParams
    ) {
      const r = new Date().getTime();
      url += url.indexOf("?") > 0 ? "&r=" + r : "?r=" + r;
    }

    const method = config.method || "GET";

    xhr.onreadystatechange = () => {
      if (xhr.readyState < 4) {
        return;
      }
      if (xhr.readyState === 4) {
        if (xhr.status !== 200 && xhr.status !== 201) {
          config.error(xhr);
        } else {
          let result: any = xhr.responseText;
          if (config.datatype === "json") result = JSON.parse(result);
          if (config.datatype === "html") {
            result = document.createElement("div");
            result.innerHTML = xhr.responseText;
          }
          config.success(result);
        }
      }
    };

    xhr.ontimeout = (e) => {
      console.error("timeout while getting " + url); //console.error(log.error() + "timeout while getting " + url);
    };

    xhr.open(method, url, true);
    xhr.timeout = config.timeout || this.defaultAjaxTimeout;

    if (config.headers) {
      config.headers.forEach((header) => {
        xhr.setRequestHeader(header.key, header.value);
      });
    }

    const data = config.data || "";
    if (method === "POST" && config.data && config.datatype === "form") {
      xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    }

    xhr.send(data);
  }
}

export default new FetchService();
