/**
 * 인앱 브라우저 감지 유틸리티
 *
 * 카카오톡, 인스타그램, 네이버, 라인, 페이스북 등의 인앱 브라우저를
 * User-Agent 문자열로 감지하고, 외부 브라우저로의 전환을 안내/유도합니다.
 */

const IN_APP_UA_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /KAKAOTALK/i, name: "카카오톡" },
  { pattern: /Instagram/i, name: "인스타그램" },
  { pattern: /NAVER\(inapp/i, name: "네이버" },
  { pattern: /NAVER\/\d/i, name: "네이버" },
  { pattern: /Line\//i, name: "라인" },
  { pattern: /FBAN|FBAV/i, name: "페이스북" },
  { pattern: /SamsungBrowser\/.*CrossApp/i, name: "삼성 인터넷" },
  { pattern: /DaumApps/i, name: "다음" },
  { pattern: /everytimeApp/i, name: "에브리타임" },
  { pattern: /Twitter/i, name: "트위터" },
  { pattern: /Snapchat/i, name: "스냅챗" },
  { pattern: /wv\)/i, name: "WebView" }, // Android WebView 일반
];

export interface InAppBrowserInfo {
  isInApp: boolean;
  browserName: string | null;
  isAndroid: boolean;
  isIOS: boolean;
}

/**
 * 현재 브라우저가 인앱 브라우저인지 감지합니다.
 */
export function detectInAppBrowser(): InAppBrowserInfo {
  const ua = navigator.userAgent;

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  for (const { pattern, name } of IN_APP_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return { isInApp: true, browserName: name, isAndroid, isIOS };
    }
  }

  return { isInApp: false, browserName: null, isAndroid, isIOS };
}

/**
 * 안드로이드에서 Chrome intent:// 스키마를 사용해 현재 URL을 크롬으로 엽니다.
 */
export function openInChrome(): void {
  const currentUrl = window.location.href;

  // intent:// 스키마로 크롬 브라우저 강제 오픈
  const intentUrl =
    `intent://${currentUrl.replace(/^https?:\/\//, "")}` +
    `#Intent;scheme=https;package=com.android.chrome;end`;

  window.location.href = intentUrl;
}

/**
 * 현재 URL을 외부 브라우저로 열기 위한 안내 텍스트를 반환합니다.
 */
export function getExternalBrowserGuide(info: InAppBrowserInfo): string {
  if (info.isAndroid) {
    return "우측 상단 ⋮ 메뉴에서 '다른 브라우저로 열기' 또는 'Chrome으로 열기'를 눌러주세요.";
  }
  if (info.isIOS) {
    return "우측 하단 또는 상단의 Safari/Chrome 아이콘을 눌러 외부 브라우저로 열어주세요.";
  }
  return "브라우저의 메뉴에서 '외부 브라우저로 열기'를 선택해주세요.";
}
