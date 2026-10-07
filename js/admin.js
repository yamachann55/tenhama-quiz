/**
 * 管理者画面用 アプリケーションロジック
 */

class AdminApp {
  constructor() {
    this.currentState = null;
    this.pendingAction = null; // モーダルで確認待ちのアクション
    this.pollTimer = null;
    this.elements = {};
  }

  async init() {
    this.cacheElements();
    this.setupSyncListener();
    await this.fetchLatestState();

    if (!syncEngine.isLocal) {
      this.startPolling();
    } else {
      this.elements.adminModeIndicator.textContent = "タブ間即時連携中";
    }
  }

  cacheElements() {
    this.elements = {
      adminStepLabel: document.getElementById("adminStepLabel"),
      adminPhaseTag: document.getElementById("adminPhaseTag"),
      adminQNumber: document.getElementById("adminQNumber"),
      adminQText: document.getElementById("adminQText"),
      adminCorrectBadge: document.getElementById("adminCorrectBadge"),
      adminExplanationText: document.getElementById("adminExplanationText"),
      adminImageBox: document.getElementById("adminImageBox"),
      adminImg: document.getElementById("adminImg"),
      statTotalCount: document.getElementById("statTotalCount"),
      statMaxPercent: document.getElementById("statMaxPercent"),
      statAccuracy: document.getElementById("statAccuracy"),
      statCorrectWrong: document.getElementById("statCorrectWrong"),
      countMaru: document.getElementById("countMaru"),
      countBatsu: document.getElementById("countBatsu"),
      barMaru: document.getElementById("barMaru"),
      barBatsu: document.getElementById("barBatsu"),
      btnToggleAnswer: document.getElementById("btnToggleAnswer"),
      btnPrevQ: document.getElementById("btnPrevQ"),
      btnNextQ: document.getElementById("btnNextQ"),
      btnReset: document.getElementById("btnReset"),
      confirmModal: document.getElementById("confirmModal"),
      modalTitle: document.getElementById("modalTitle"),
      modalDesc: document.getElementById("modalDesc"),
      modalConfirmBtn: document.getElementById("modalConfirmBtn"),
      adminModeIndicator: document.getElementById("adminModeIndicator")
    };
  }

  setupSyncListener() {
    syncEngine.onUpdate((event) => {
      if (CONFIG.DEBUG) console.log("Admin received sync event:", event);
      this.fetchLatestState();
    });
  }

  startPolling() {
    this.pollTimer = setInterval(async () => {
      await this.fetchLatestState();
    }, CONFIG.POLL_INTERVAL_MS);
  }

  async fetchLatestState() {
    const state = await syncEngine.getState();
    if (!state) return;
    this.currentState = state;

    // 回答データの取得と集計
    const answers = await syncEngine.getAnswers(state.questionIndex);
    this.render(answers);
  }

  render(answers = {}) {
    if (!this.currentState || !this.currentState.questions) return;

    const qIdx = this.currentState.questionIndex;
    const currentQ = this.currentState.questions[qIdx];
    const totalQ = this.currentState.questions.length;
    const isAnswerPhase = this.currentState.status === "ANSWER";

    // 進行状況表示
    this.elements.adminStepLabel.textContent = `第 ${qIdx + 1} 問 / 全 ${totalQ} 問`;
    this.elements.adminQNumber.textContent = `第 ${qIdx + 1} 問`;
    this.elements.adminQText.textContent = currentQ ? currentQ.question : "";

    const correctMark = currentQ.answer === "O" ? "〇" : "✕";
    this.elements.adminCorrectBadge.textContent = `正解: 【 ${correctMark} 】`;

    // 解説文と画像プレビューの反映
    if (this.elements.adminExplanationText) {
      this.elements.adminExplanationText.textContent = currentQ ? (currentQ.explanation || "解説なし") : "";
    }
    if (this.elements.adminImageBox && this.elements.adminImg) {
      const formattedUrl = currentQ ? formatImageUrl(currentQ.imageUrl) : "";
      if (formattedUrl !== "") {
        this.elements.adminImg.src = formattedUrl;
        this.elements.adminImageBox.style.display = "flex";
      } else {
        this.elements.adminImg.src = "";
        this.elements.adminImageBox.style.display = "none";
      }
    }

    // フェーズとボタン表示切り替え
    if (isAnswerPhase) {
      this.elements.adminPhaseTag.textContent = "正誤発表中（回答締切）";
      this.elements.adminPhaseTag.className = "answer-status-pill status-tag-answer";
      this.elements.btnToggleAnswer.textContent = "出 題（受付中）に 戻 す";
      this.elements.btnToggleAnswer.style.backgroundColor = "var(--text-sub)";
    } else {
      this.elements.adminPhaseTag.textContent = "出題・回答受付中";
      this.elements.adminPhaseTag.className = "answer-status-pill status-tag-active";
      this.elements.btnToggleAnswer.textContent = "正 誤 発 表 を 行 う";
      this.elements.btnToggleAnswer.style.backgroundColor = "var(--accent-green)";
    }

    // 前へ/次へ ボタンの活性・不活性
    this.elements.btnPrevQ.disabled = qIdx === 0;
    this.elements.btnNextQ.disabled = qIdx === totalQ - 1;

    // 集計計算
    const answerList = Object.values(answers);
    const totalCount = answerList.length;

    let maruCount = 0;
    let batsuCount = 0;
    let correctCount = 0;
    let wrongCount = 0;

    answerList.forEach((ans) => {
      if (ans.choice === "O") maruCount++;
      if (ans.choice === "X") batsuCount++;

      if (ans.choice === currentQ.answer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    // 集計値の反映
    this.elements.statTotalCount.textContent = `${totalCount} 名`;
    this.elements.statMaxPercent.textContent = `最大 ${CONFIG.MAX_PARTICIPANTS} 名中 (${Math.round((totalCount / CONFIG.MAX_PARTICIPANTS) * 100)}% 参加)`;

    this.elements.countMaru.textContent = maruCount;
    this.elements.countBatsu.textContent = batsuCount;

    // バーグラフ計算
    if (totalCount > 0) {
      const maruPercent = Math.round((maruCount / totalCount) * 100);
      const batsuPercent = 100 - maruPercent;
      this.elements.barMaru.style.width = `${maruPercent}%`;
      this.elements.barMaru.textContent = maruPercent > 10 ? `〇 ${maruPercent}% (${maruCount})` : "";
      this.elements.barBatsu.style.width = `${batsuPercent}%`;
      this.elements.barBatsu.textContent = batsuPercent > 10 ? `✕ ${batsuPercent}% (${batsuCount})` : "";

      const accuracy = Math.round((correctCount / totalCount) * 100);
      this.elements.statAccuracy.textContent = `${accuracy} %`;
      this.elements.statCorrectWrong.textContent = `正解: ${correctCount} 名 / 誤答: ${wrongCount} 名`;
    } else {
      this.elements.barMaru.style.width = "50%";
      this.elements.barMaru.textContent = "〇 0%";
      this.elements.barBatsu.style.width = "50%";
      this.elements.barBatsu.textContent = "✕ 0%";
      this.elements.statAccuracy.textContent = "-- %";
      this.elements.statCorrectWrong.textContent = "正解: 0 / 不正解: 0";
    }
  }

  /* -------------------------------------------------------------
   * 誤タップ防止：確認モーダル表示
   * ------------------------------------------------------------- */
  askAction(actionType) {
    this.pendingAction = actionType;
    const qIdx = this.currentState.questionIndex;
    const totalQ = this.currentState.questions.length;

    let title = "操作の確認";
    let desc = "";
    let isDanger = false;

    switch (actionType) {
      case "NEXT_Q":
        title = "次の問題へ進む確認";
        desc = `第 ${qIdx + 2} 問（全 ${totalQ} 問）へ進みますか？<br>回答者の画面も次の問題に切り替わります。`;
        break;
      case "PREV_Q":
        title = "前の問題へ戻る確認";
        desc = `第 ${qIdx} 問へ戻りますか？`;
        break;
      case "TOGGLE_ANSWER":
        if (this.currentState.status === "QUESTION") {
          title = "正誤発表の実行確認";
          desc = "回答を締め切り、乗客全員の画面に【正解・解説】を表示しますか？";
        } else {
          title = "出題状態への復帰確認";
          desc = "回答受付中（出題状態）に戻しますか？";
        }
        break;
      case "RESET":
        title = "【警告】全問リセット";
        desc = "第1問に戻り、全問の回答データを初期化します。<br>本当によろしいですか？";
        isDanger = true;
        break;
    }

    this.elements.modalTitle.textContent = title;
    this.elements.modalDesc.innerHTML = desc;

    if (isDanger) {
      this.elements.modalConfirmBtn.className = "btn-confirm danger";
      this.elements.modalConfirmBtn.textContent = "リセットを実行する";
    } else {
      this.elements.modalConfirmBtn.className = "btn-confirm";
      this.elements.modalConfirmBtn.textContent = "実行する";
    }

    this.elements.confirmModal.classList.add("active");
  }

  closeModal() {
    this.pendingAction = null;
    this.elements.confirmModal.classList.remove("active");
  }

  /* -------------------------------------------------------------
   * 確認後の実際の操作実行
   * ------------------------------------------------------------- */
  async executeConfirmedAction() {
    const action = this.pendingAction;
    this.closeModal();

    if (!action || !this.currentState) return;

    let newState = { ...this.currentState };

    if (action === "NEXT_Q") {
      if (newState.questionIndex < newState.questions.length - 1) {
        newState.questionIndex++;
        newState.status = "QUESTION"; // 次の問題は出題受付状態からスタート
      }
    } else if (action === "PREV_Q") {
      if (newState.questionIndex > 0) {
        newState.questionIndex--;
        newState.status = "QUESTION";
      }
    } else if (action === "TOGGLE_ANSWER") {
      newState.status = newState.status === "QUESTION" ? "ANSWER" : "QUESTION";
    } else if (action === "RESET") {
      newState.questionIndex = 0;
      newState.status = "QUESTION";
      await syncEngine.resetAllAnswers();
    }

    await syncEngine.updateState(newState);
    await this.fetchLatestState();
  }

  /* -------------------------------------------------------------
   * テスト用：シミュレーション機能（45名一括生成等）
   * ------------------------------------------------------------- */
  async simulateAnswers(count) {
    if (!this.currentState) return;
    const qIdx = this.currentState.questionIndex;

    const sampleNames = [
      "天浜ファンA", "転車台マニア", "国鉄愛好家", "浜名湖旅人", "遠州鉄道員",
      "掛川の乗客", "新所原の旅人", "文化財ハンター", "二俣線同好会", "SLマニア"
    ];

    for (let i = 1; i <= count; i++) {
      const uId = `sim_user_${i}`;
      const name = sampleNames[i % sampleNames.length] + ` (${i})`;
      // ランダムに〇または×（7:3の比率で〇多め）
      const choice = Math.random() < 0.65 ? "O" : "X";
      await syncEngine.submitAnswer(qIdx, uId, name, choice);
    }

    await this.fetchLatestState();
  }

  async clearCurrentAnswers() {
    if (!this.currentState) return;
    await syncEngine.resetAllAnswers();
    await this.fetchLatestState();
  }
}

const adminApp = new AdminApp();
window.addEventListener("DOMContentLoaded", () => {
  adminApp.init();
});
