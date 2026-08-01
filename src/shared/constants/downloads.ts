export type DownloadItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  sizeLabel: string;
  available: boolean;
};

export const APP_DOWNLOAD_VERSION = "2.0.1";

export const APP_DOWNLOADS: DownloadItem[] = [
  {
    id: "win-setup",
    title: "Windows — bộ cài đặt",
    description: "Cài đặt Hung Tran Finance trên máy Windows.",
    href: `/downloads/Hung-Tran-Finance-Setup-${APP_DOWNLOAD_VERSION}.exe`,
    sizeLabel: "~102 MB",
    available: true,
  },
  {
    id: "win-portable",
    title: "Windows — portable (zip)",
    description: "Giải nén và chạy, không cần cài đặt.",
    href: `/downloads/Hung-Tran-Finance-Windows-Portable-${APP_DOWNLOAD_VERSION}.zip`,
    sizeLabel: "~153 MB",
    available: true,
  },
  {
    id: "web-zip",
    title: "Web tĩnh (zip)",
    description: "Gói dist để tự host trên static server.",
    href: `/downloads/Hung-Tran-Finance-Web-${APP_DOWNLOAD_VERSION}.zip`,
    sizeLabel: "~0.4 MB",
    available: true,
  },
  {
    id: "android-apk",
    title: "Android APK (debug)",
    description: "Cài tay trên điện thoại Android (cho phép nguồn không rõ).",
    href: `/downloads/Hung-Tran-Finance-${APP_DOWNLOAD_VERSION}.apk`,
    sizeLabel: "~5 MB",
    available: true,
  },
];
