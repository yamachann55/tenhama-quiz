/**
 * 天浜線 文化財めぐり号 クイズ - Google Apps Script (GAS) バックエンド
 * 
 * 45人同時アクセス対策:
 * CacheService を活用し、回答者からのポーリング取得をメモリキャッシュから高速返却します。
 */

// キャッシュキー
const CACHE_KEY_STATE = "TH_QUIZ_CURRENT_STATE";
const CACHE_KEY_ANSWERS_PREFIX = "TH_QUIZ_ANSWERS_";

/**
 * 初期シート作成・セットアップ関数
 * スプレッドシートのスクリプトエディタで「setupSheets」を1回実行してください。
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("スプレッドシートが見つかりません。スプレッドシートの[拡張機能] > [Apps Script]から開いてください。");
  }

  // 1. 問題一覧シート
  let qSheet = ss.getSheetByName("問題一覧");
  if (!qSheet) {
    qSheet = ss.insertSheet("問題一覧");
    qSheet.appendRow(["問題番号", "問題文", "正解(O/X)", "解説", "画像URL(任意)"]);
    qSheet.appendRow([1, "天竜二俣駅にある「転車台」と「扇形車庫」は、国の登録有形文化財に登録されている？", "O", "1940年全線開通時から現役で稼働しており、扇形車庫等と共に国の登録有形文化財です。", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Tenryu-Futamata_Station%2C_ekisha.jpg/800px-Tenryu-Futamata_Station%2C_ekisha.jpg"]);
    qSheet.appendRow([2, "天浜線の旧国鉄時代の路線名は「遠州鉄道」であった？", "X", "旧国鉄時代の路線名は「二俣線（ふたません）」です。", ""]);
    qSheet.appendRow([3, "天浜線全線において、登録有形文化財に登録されている施設は全部で30箇所以上ある？", "O", "駅舎、ホーム、橋梁など合計36件もの施設が登録有形文化財に登録されています。", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Tenry%C5%AB-Futamata_Sta_Platform.jpg/800px-Tenry%C5%AB-Futamata_Sta_Platform.jpg"]);
    qSheet.appendRow([4, "最も長い川を渡る「天竜川橋梁」は、途中で列車がすれ違える複線である？", "X", "天浜線は全線単線です。天竜川橋梁も単線トラス橋です。", ""]);
    qSheet.appendRow([5, "天浜線は掛川駅から新所原駅までの全長67.7kmを結んでいる？", "O", "掛川駅から浜名湖北岸を通り、新所原駅まで全39駅、67.7kmを結んでいます。", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Tenryu-Hutamata-eki-2.jpg/800px-Tenryu-Hutamata-eki-2.jpg"]);
  }

  // 2. 状態管理シート
  let stateSheet = ss.getSheetByName("状態管理");
  if (!stateSheet) {
    stateSheet = ss.insertSheet("状態管理");
    stateSheet.appendRow(["キー", "値"]);
    stateSheet.appendRow(["questionIndex", 0]);
    stateSheet.appendRow(["status", "QUESTION"]);
  }

  // 3. 回答データシート
  let ansSheet = ss.getSheetByName("回答データ");
  if (!ansSheet) {
    ansSheet = ss.insertSheet("回答データ");
    ansSheet.appendRow(["問題番号", "ユーザーID", "ニックネーム", "選択(O/X)", "日時"]);
  }

  // キャッシュをリフレッシュ
  return refreshStateCache();
}

/**
 * スプレッドシート編集時トリガー
 * 問題や設定をスプレッドシート上で編集した瞬間に自動でキャッシュを最新化します！
 */
function onEdit(e) {
  try {
    refreshStateCache();
  } catch (err) {
    console.error("onEdit error:", err);
  }
}

/**
 * 手動キャッシュクリア用関数（エディタの関数選択から1クリックで実行可能）
 */
function refreshCache() {
  const state = refreshStateCache();
  console.log("最新の問題データを再読み込みしました:", state.questions.length + "問");
  return state;
}

/**
 * GET リクエスト処理 (状態取得 / 回答取得 / ヘルスチェック / キャッシュ更新)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || "getState";

    let result = {};

    if (action === "getState") {
      const forceRefresh = params.refresh === "true" || params.refresh === "1";
      result = forceRefresh ? refreshStateCache() : getCachedState();
    } else if (action === "refresh") {
      result = refreshStateCache();
    } else if (action === "getAnswers") {
      const qIdx = parseInt(params.q || "0", 10);
      result = getCachedAnswers(qIdx);
    } else if (action === "ping") {
      result = { status: "ok", timestamp: new Date().getTime() };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // 例外発生時もGoogleのエラーHTMLではなくJSONで返却
    const errorResponse = {
      error: true,
      message: err.toString(),
      stack: err.stack
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST リクエスト処理 (状態更新 / 回答送信 / リセット)
 */
function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const action = data.action;
    let response = { success: true };

    if (action === "updateState") {
      updateStateInSheet(data.state);
      response.state = refreshStateCache();
    } else if (action === "submitAnswer") {
      recordAnswer(data.questionIndex, data.userId, data.userName, data.choice);
      response.recorded = true;
    } else if (action === "resetAllAnswers") {
      resetAllAnswersInSheet();
      response.reset = true;
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const errorResponse = {
      error: true,
      message: err.toString(),
      stack: err.stack
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * キャッシュ付き 状態取得 (45人の高頻度アクセスを高速返却)
 */
function getCachedState() {
  const cache = CacheService.getScriptCache();
  const cachedJson = cache.get(CACHE_KEY_STATE);
  if (cachedJson) {
    try {
      const parsed = JSON.parse(cachedJson);
      // 有効な問題配列が含まれていれば返却
      if (parsed && parsed.questions && parsed.questions.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn("Cache parse failed, refreshing...");
    }
  }
  return refreshStateCache();
}

function refreshStateCache() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("スプレッドシートが見つかりません。コンテナバインド(スプレッドシートの拡張機能>Apps Script)として実行してください。");
  }

  // シートが未作成なら自動初期化
  let qSheet = ss.getSheetByName("問題一覧");
  let stateSheet = ss.getSheetByName("状態管理");
  if (!qSheet || !stateSheet) {
    return setupSheets();
  }

  // 問題読み込み
  const qRows = qSheet.getDataRange().getValues();
  const questions = [];
  for (let i = 1; i < qRows.length; i++) {
    const r = qRows[i];
    if (r[0] !== "" && r[1] !== "") {
      questions.push({
        id: r[0],
        question: String(r[1]),
        answer: String(r[2]).trim().toUpperCase(),
        explanation: String(r[3] || ""),
        imageUrl: formatGoogleDriveUrl(r[4])
      });
    }
  }

  // 状態読み込み
  const stateRows = stateSheet.getDataRange().getValues();
  let questionIndex = 0;
  let status = "QUESTION";

  for (let i = 1; i < stateRows.length; i++) {
    if (String(stateRows[i][0]).trim() === "questionIndex") {
      questionIndex = parseInt(stateRows[i][1], 10) || 0;
    }
    if (String(stateRows[i][0]).trim() === "status") {
      status = String(stateRows[i][1]).trim();
    }
  }

  const stateObj = {
    questionIndex: questionIndex,
    status: status,
    questions: questions,
    updatedAt: new Date().getTime()
  };

  const jsonStr = JSON.stringify(stateObj);
  // キャッシュに6時間保存
  CacheService.getScriptCache().put(CACHE_KEY_STATE, jsonStr, 21600);
  return stateObj;
}

function updateStateInSheet(state) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  const stateSheet = ss.getSheetByName("状態管理");
  if (!stateSheet) return;

  stateSheet.clear();
  stateSheet.appendRow(["キー", "値"]);
  stateSheet.appendRow(["questionIndex", state.questionIndex]);
  stateSheet.appendRow(["status", state.status]);

  refreshStateCache();
}

/**
 * 回答の記録 (重複回答は更新)
 */
function recordAnswer(qIdx, userId, userName, choice) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  const ansSheet = ss.getSheetByName("回答データ");
  if (!ansSheet) return;

  // キャッシュの回答集計を即時更新
  const cacheKey = CACHE_KEY_ANSWERS_PREFIX + qIdx;
  const cache = CacheService.getScriptCache();
  let currentAnswers = {};
  const cachedJson = cache.get(cacheKey);
  if (cachedJson) {
    try {
      currentAnswers = JSON.parse(cachedJson);
    } catch (e) {}
  }
  currentAnswers[userId] = {
    name: userName,
    choice: choice,
    submittedAt: new Date().getTime()
  };
  cache.put(cacheKey, JSON.stringify(currentAnswers), 21600);

  // シートへ追記
  ansSheet.appendRow([qIdx + 1, userId, userName, choice, new Date()]);
}

function getCachedAnswers(qIdx) {
  const cacheKey = CACHE_KEY_ANSWERS_PREFIX + qIdx;
  const cache = CacheService.getScriptCache();
  const cachedJson = cache.get(cacheKey);
  if (cachedJson) {
    try {
      return JSON.parse(cachedJson);
    } catch (e) {}
  }
  return {};
}

function resetAllAnswersInSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  const ansSheet = ss.getSheetByName("回答データ");
  if (ansSheet) {
    ansSheet.clear();
    ansSheet.appendRow(["問題番号", "ユーザーID", "ニックネーム", "選択(O/X)", "日時"]);
  }
  // キャッシュ消去
  for (let i = 0; i < 20; i++) {
    CacheService.getScriptCache().remove(CACHE_KEY_ANSWERS_PREFIX + i);
  }
}

/**
 * GoogleドライブURLをWeb表示用CDNリンクに自動変換
 */
function formatGoogleDriveUrl(url) {
  if (!url) return "";
  const trimmed = String(url).trim();
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) {
    return "https://drive.google.com/thumbnail?id=" + matchFileD[1] + "&sz=w1200";
  }
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchIdParam && matchIdParam[1]) {
    return "https://drive.google.com/thumbnail?id=" + matchIdParam[1] + "&sz=w1200";
  }
  return trimmed;
}
