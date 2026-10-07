/**
 * 天浜線 クイズ同期エンジン (Sync Engine)
 * - ローカルテストモード: BroadcastChannel + localStorage でタブ間瞬時同期
 * - GAS連携モード: GAS WebApp への非同期Fetch (GET / POST)
 */

/**
 * 画像URLの正規化ヘルパー
 * Googleドライブの共有リンクを自動検知し、Web表示可能な高解像度CDNリンクに自動変換します。
 */
function formatImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (trimmed === "") return "";

  // 1. Googleドライブ: /file/d/FILE_ID/
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) {
    return `https://drive.google.com/thumbnail?id=${matchFileD[1]}&sz=w1200`;
  }

  // 2. Googleドライブ: ?id=FILE_ID または &id=FILE_ID
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam && matchIdParam[1]) {
    return `https://drive.google.com/thumbnail?id=${matchIdParam[1]}&sz=w1200`;
  }

  // 通常のWeb画像URLならそのまま返却
  return trimmed;
}

class QuizSyncEngine {
  constructor() {
    this.isLocal = !CONFIG.GAS_API_URL || CONFIG.GAS_API_URL.trim() === "";
    this.broadcastChannel = null;
    this.listeners = [];

    // ローカル同期用ストレージキー
    this.STORAGE_KEY_STATE = "TH_QUIZ_STATE";
    this.STORAGE_KEY_ANSWERS = "TH_QUIZ_ANSWERS";

    this.init();
  }

  init() {
    if (this.isLocal) {
      if (typeof BroadcastChannel !== "undefined") {
        this.broadcastChannel = new BroadcastChannel("TH_QUIZ_CHANNEL");
        this.broadcastChannel.onmessage = (event) => {
          this.notify(event.data);
        };
      }
      // 他タブの localStorage 変更イベントも検知
      window.addEventListener("storage", (e) => {
        if (e.key === this.STORAGE_KEY_STATE || e.key === this.STORAGE_KEY_ANSWERS) {
          this.notify({ type: "SYNC_UPDATE" });
        }
      });
    }
  }

  onUpdate(callback) {
    this.listeners.push(callback);
  }

  notify(data) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error("Listener error:", err);
      }
    });
  }

  /* -------------------------------------------------------------
   * 状態取得 (管理者 & 回答者 共通)
   * ------------------------------------------------------------- */
  async getState() {
    if (this.isLocal) {
      const raw = localStorage.getItem(this.STORAGE_KEY_STATE);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch (e) {
          console.error("JSON parse error:", e);
        }
      }
      // 初期状態
      const defaultState = {
        questionIndex: 0,
        status: "QUESTION", // "QUESTION" (出題中) | "ANSWER" (正誤発表中)
        questions: MOCK_QUIZ_DATA,
        updatedAt: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY_STATE, JSON.stringify(defaultState));
      return defaultState;
    } else {
      // GAS から取得
      try {
        const res = await fetch(`${CONFIG.GAS_API_URL}?action=getState&t=${Date.now()}`, {
          method: "GET",
          redirect: "follow"
        });
        if (!res.ok) {
          console.error(`[GAS通信エラー HTTP ${res.status}] Googleの404エラーが発生しています。\n対策: Apps Scriptのデプロイ設定で「アクセスできるユーザー」が「全員」になっているか確認し、「新しいバージョン」で再デプロイしてください。`);
          return null;
        }
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data && data.error) {
            console.error("[GASスクリプト実行時エラー]", data.message, data.stack);
            return null;
          }
          return data;
        } catch (jsonErr) {
          console.error("[GASレスポンスJSONパース失敗] 返却内容:", text.substring(0, 200));
          return null;
        }
      } catch (err) {
        console.error("GAS getState fetch error:", err);
        return null;
      }
    }
  }

  /* -------------------------------------------------------------
   * 全回答データの取得 (管理者用集計)
   * ------------------------------------------------------------- */
  async getAnswers(questionIndex) {
    if (this.isLocal) {
      const raw = localStorage.getItem(this.STORAGE_KEY_ANSWERS);
      const allAnswers = raw ? JSON.parse(raw) : {};
      return allAnswers[questionIndex] || {};
    } else {
      try {
        const res = await fetch(`${CONFIG.GAS_API_URL}?action=getAnswers&q=${questionIndex}&t=${Date.now()}`, {
          method: "GET",
          redirect: "follow"
        });
        if (!res.ok) return {};
        const text = await res.text();
        return JSON.parse(text);
      } catch (err) {
        console.error("GAS getAnswers error:", err);
        return {};
      }
    }
  }

  /* -------------------------------------------------------------
   * 管理者操作: 状態の更新 (次の問題/前の問題/正誤発表/リセット)
   * ------------------------------------------------------------- */
  async updateState(newState) {
    if (this.isLocal) {
      newState.updatedAt = Date.now();
      localStorage.setItem(this.STORAGE_KEY_STATE, JSON.stringify(newState));
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: "STATE_CHANGED", state: newState });
      }
      this.notify({ type: "STATE_CHANGED", state: newState });
      return true;
    } else {
      try {
        const res = await fetch(CONFIG.GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "updateState", state: newState }),
          redirect: "follow"
        });
        if (!res.ok) return false;
        const text = await res.text();
        return JSON.parse(text);
      } catch (err) {
        console.error("GAS updateState error:", err);
        return false;
      }
    }
  }

  /* -------------------------------------------------------------
   * 回答者操作: 回答送信 (〇 or ×)
   * ------------------------------------------------------------- */
  async submitAnswer(questionIndex, userId, userName, choice) {
    if (this.isLocal) {
      const raw = localStorage.getItem(this.STORAGE_KEY_ANSWERS);
      const allAnswers = raw ? JSON.parse(raw) : {};
      if (!allAnswers[questionIndex]) {
        allAnswers[questionIndex] = {};
      }
      allAnswers[questionIndex][userId] = {
        name: userName,
        choice: choice, // 'O' or 'X'
        submittedAt: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY_ANSWERS, JSON.stringify(allAnswers));

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: "ANSWER_SUBMITTED",
          questionIndex,
          userId,
          choice
        });
      }
      this.notify({ type: "ANSWER_SUBMITTED", questionIndex, userId, choice });
      return true;
    } else {
      try {
        const res = await fetch(CONFIG.GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "submitAnswer",
            questionIndex,
            userId,
            userName,
            choice
          }),
          redirect: "follow"
        });
        if (!res.ok) return false;
        const text = await res.text();
        return JSON.parse(text);
      } catch (err) {
        console.error("GAS submitAnswer error:", err);
        return false;
      }
    }
  }

  /* -------------------------------------------------------------
   * 管理者操作: 回答データのリセット
   * ------------------------------------------------------------- */
  async resetAllAnswers() {
    if (this.isLocal) {
      localStorage.removeItem(this.STORAGE_KEY_ANSWERS);
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: "ANSWERS_RESET" });
      }
      this.notify({ type: "ANSWERS_RESET" });
    } else {
      try {
        await fetch(CONFIG.GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "resetAllAnswers" }),
          redirect: "follow"
        });
      } catch (err) {
        console.error("GAS resetAllAnswers error:", err);
      }
    }
  }
}

// シングルトンとしてエクスポート
const syncEngine = new QuizSyncEngine();
