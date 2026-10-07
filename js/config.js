/**
 * クイズシステム全体設定
 */
const CONFIG = {
  // Google Apps Script (GAS) をデプロイしたら、そのウェブアプリURLをここに貼り付けてください
  // 空文字 ("") の場合は、自動的にブラウザローカル同期モード（タブ間リアルタイム連携）で動作します。
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbys_YEmtBesagY8DkuC-f-jvseW49v3Nz4C8-CGb5VLHA9zsSJqfUonghV1bD_r7EdwOQ/exec",

  // GAS接続時のポーリング間隔 (ミリ秒) - 45人規模を想定して4.5秒 (ランダムゆらぎ付き)
  POLL_INTERVAL_MS: 4500,

  // 最大想定参加人数
  MAX_PARTICIPANTS: 45,

  // アプリタイトル
  APP_TITLE: "天浜線 文化財めぐり号 クイズ",

  // デバッグログ出力
  DEBUG: true
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
