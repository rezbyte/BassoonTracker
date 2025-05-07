interface ImportMetaEnv {
    readonly PACKAGE_VERSION: string;
    readonly BUILD_VERSION: string;
    // more env variables...
}
  
interface ImportMeta {
    readonly env: ImportMetaEnv
}