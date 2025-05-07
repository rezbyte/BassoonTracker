class Storage {
  get(key: string): string | null {
    return localStorage.getItem(key);
  }

  set(key: string, value: string) {
    return localStorage.setItem(key, value);
  }
}

export default new Storage();
