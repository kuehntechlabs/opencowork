import type { Configuration } from "electron-builder";

const config: Configuration = {
  appId: "com.opencowork.app",
  productName: "OpenCowork",
  artifactName: "opencowork-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: ["out/**/*", "resources/**/*", "!resources/bin"],
  extraResources: [
    {
      from: "resources/bin",
      to: "bin",
      filter: ["**/*"],
    },
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
