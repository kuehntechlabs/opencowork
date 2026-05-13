import type { Configuration } from "electron-builder";

const config: Configuration = {
  appId: "com.opencowork.app",
  productName: "OpenCowork",
  artifactName: "opencowork-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: [
    "out/**/*",
    "resources/**/*",
    "vendor/opencode/packages/opencode/dist/node/**",
    "!vendor/opencode/packages/opencode/dist/node/*.map",
  ],
  // WASM and native .node binaries cannot be loaded from inside app.asar; the
  // in-process opencode server pulls in tree-sitter WASM and (optionally)
  // @lydell/node-pty / @parcel/watcher native modules, so we unpack them.
  asarUnpack: [
    "out/main/chunks/**",
    "vendor/opencode/packages/opencode/dist/node/**",
    "node_modules/@lydell/node-pty*/**",
    "node_modules/@parcel/watcher*/**",
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: "resources/icons/icon.icns",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  win: {
    icon: "resources/icons/icon.ico",
    target: ["nsis"],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  linux: {
    icon: "resources/icons",
    category: "Development",
    target: ["AppImage", "deb"],
  },
  protocols: {
    name: "OpenCowork",
    schemes: ["opencowork"],
  },
};

export default config;
