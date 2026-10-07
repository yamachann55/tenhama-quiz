/**
 * 回答者画面用 アプリケーションロジック
 */

class PlayerApp {
  constructor() {
    this.userId = "";
    this.userName = "";
    this.currentState = null;
    this.tempChoice = null;      // タップした直後の仮選択 ('O' or 'X')
    this.confirmedChoice = null; // 送信確定済みの選択
    this.pollTimer = null;

    // DOM要素の参照
    this.elements = {};
  }

  async init() {
    this.cacheElements();
    this.initUser();
    this.setupSyncListener();
    await this.fetchLatestState();

    // GASモード時の定期ポーリング（ローカル時はBroadcastChannelで即時同期される）
    if (!syncEngine.isLocal) {
      this.startPolling();
    } else {
      this.elements.modeIndicator.textContent = "タブ間即時連携中";
    }
  }

  cacheElements() {
    this.elements = {
      displayUserName: document.getElementById("displayUserName"),
      questionStep: document.getElementById("questionStep"),
      quizPhase: document.getElementById("quizPhase"),
      qNumberLabel: document.getElementById("qNumberLabel"),
      qText: document.getElementById("qText"),
      choiceContainer: document.getElementById("choiceContainer"),
      btnMaru: document.getElementById("btnMaru"),
      btnBatsu: document.getElementById("btnBatsu"),
      confirmBox: document.getElementById("confirmBox"),
      confirmGuideText: document.getElementById("confirmGuideText"),
      btnConfirmAnswer: document.getElementById("btnConfirmAnswer"),
      btnChangeAnswer: document.getElementById("btnChangeAnswer"),
      resultArea: document.getElementById("resultArea"),
      stampBox: document.getElementById("stampBox"),
      stampTitle: document.getElementById("stampTitle"),
      stampSub: document.getElementById("stampSub"),
      explanationText: document.getElementById("explanationText"),
      explanationImageBox: document.getElementById("explanationImageBox"),
      explanationImg: document.getElementById("explanationImg"),
      nameModal: document.getElementById("nameModal"),
      inputUserName: document.getElementById("inputUserName"),
      connectionStatus: document.getElementById("connectionStatus"),
      modeIndicator: document.getElementById("modeIndicator")
    };

    // 画像読み込みエラー時のフォールバック
    if (this.elements.explanationImg) {
      this.elements.explanationImg.onerror = () => {
        if (this.elements.explanationImageBox) {
          this.elements.explanationImageBox.style.display = "none";
        }
      };
    }
  }

  /* -------------------------------------------------------------
   * ユーザー情報管理
   * ------------------------------------------------------------- */
  initUser() {
    let savedId = localStorage.getItem("TH_PLAYER_ID");
    if (!savedId) {
      savedId = "user_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("TH_PLAYER_ID", savedId);
    }
    this.userId = savedId;

    let savedName = localStorage.getItem("TH_PLAYER_NAME");
    if (!savedName) {
      this.showNameModal();
    } else {
      this.userName = savedName;
      this.elements.displayUserName.textContent = this.userName;
    }
  }

  showNameModal() {
    this.elements.nameModal.classList.add("active");
  }

  saveUserName() {
    const val = this.elements.inputUserName.value.trim();
    if (!val) {
      alert("お名前（ニックネーム）を入力してください。");
      return;
    }
    this.userName = val;
    localStorage.setItem("TH_PLAYER_NAME", val);
    this.elements.displayUserName.textContent = val;
    this.elements.nameModal.classList.remove("active");
  }

  /* -------------------------------------------------------------
   * 状態同期とレンダリング
   * ------------------------------------------------------------- */
  setupSyncListener() {
    syncEngine.onUpdate((event) => {
      if (CONFIG.DEBUG) console.log("Player received sync event:", event);
      this.fetchLatestState();
    });
  }

  startPolling() {
    const pollLoop = async () => {
      await this.fetchLatestState();
      const jitter = Math.floor(Math.random() * 400) - 200;
      const interval = Math.max(1400, CONFIG.POLL_INTERVAL_MS + jitter);
      this.pollTimer = setTimeout(pollLoop, interval);
    };
    pollLoop();
  }

  async fetchLatestState() {
    const state = await syncEngine.getState();
    if (!state) return;

    // 前回の問題番号と変わった場合は回答選択をリセット
    if (!this.currentState || this.currentState.questionIndex !== state.questionIndex) {
      this.tempChoice = null;
      this.confirmedChoice = null;
    }

    this.currentState = state;
    this.render();
  }

  render() {
    if (!this.currentState || !this.currentState.questions) return;

    const qIdx = this.currentState.questionIndex;
    const currentQ = this.currentState.questions[qIdx];
    const totalQ = this.currentState.questions.length;
    const isAnswerPhase = this.currentState.status === "ANSWER";

    this.elements.questionStep.textContent = `第 ${qIdx + 1} 問 / 全 ${totalQ} 問`;
    this.elements.qNumberLabel.textContent = `第 ${qIdx + 1} 問`;
    this.elements.qText.textContent = currentQ ? currentQ.question : "問題がありません";

    if (isAnswerPhase) {
      // ---------------------------------------------------------
      // 正誤発表フェーズ
      // ---------------------------------------------------------
      this.elements.quizPhase.textContent = "正誤発表中";
      this.elements.quizPhase.className = "answer-status-pill status-answered";

      // 〇×ボタンは無効化
      this.elements.choiceContainer.style.display = "none";
      this.elements.confirmBox.style.display = "none";
      this.elements.resultArea.style.display = "block";

      const correctAnswer = currentQ.answer; // 'O' or 'X'
      const isCorrect = this.confirmedChoice === correctAnswer;

      this.elements.explanationText.textContent = currentQ.explanation || "解説はありません。";

      // 解説画像の表示・非表示制御（幅に対して相対的に90%で表示）
      if (this.elements.explanationImageBox && this.elements.explanationImg) {
        const formattedUrl = formatImageUrl(currentQ.imageUrl);
        if (formattedUrl !== "") {
          this.elements.explanationImg.src = formattedUrl;
          this.elements.explanationImageBox.style.display = "flex";
        } else {
          this.elements.explanationImg.src = "";
          this.elements.explanationImageBox.style.display = "none";
        }
      }

      if (!this.confirmedChoice) {
        // 未回答の場合
        this.elements.stampBox.className = "stamp-box stamp-wrong";
        this.elements.stampTitle.textContent = "時 間 切 れ";
        this.elements.stampSub.textContent = `未回答 (正解は【 ${correctAnswer === "O" ? "〇" : "✕"} 】)`;
      } else if (isCorrect) {
        // 正解！
        this.elements.stampBox.className = "stamp-box stamp-correct";
        this.elements.stampTitle.textContent = "正 解 ！";
        this.elements.stampSub.textContent = `あなたの解答: 【 ${this.confirmedChoice === "O" ? "〇" : "✕"} 】`;
      } else {
        // 不正解
        this.elements.stampBox.className = "stamp-box stamp-wrong";
        this.elements.stampTitle.textContent = "残 念 …";
        this.elements.stampSub.textContent = `あなたの解答: 【 ${this.confirmedChoice === "O" ? "〇" : "✕"} 】(正解は【 ${correctAnswer === "O" ? "〇" : "✕"} 】)`;
      }
    } else {
      // ---------------------------------------------------------
      // 出題・回答受付フェーズ
      // ---------------------------------------------------------
      this.elements.resultArea.style.display = "none";
      this.elements.choiceContainer.style.display = "grid";
      this.elements.confirmBox.style.display = "block";

      if (this.confirmedChoice) {
        // 解答確定済み（発表待ち）
        this.elements.quizPhase.textContent = "解答済み（発表待ち）";
        this.elements.quizPhase.className = "answer-status-pill status-answered";

        this.elements.btnMaru.className = `choice-btn maru ${this.confirmedChoice === "O" ? "selected" : "disabled"}`;
        this.elements.btnBatsu.className = `choice-btn batsu ${this.confirmedChoice === "X" ? "selected" : "disabled"}`;

        this.elements.confirmGuideText.innerHTML = `現在【 <strong>${this.confirmedChoice === "O" ? "〇" : "✕"}</strong> 】で送信済みです。<br><span style="font-size:11px;color:var(--text-sub);">発表前なら選び直せます</span>`;
        this.elements.btnConfirmAnswer.style.display = "none";
        this.elements.btnChangeAnswer.style.display = "block";
      } else {
        // 未確定状態（仮選択 or 未選択）
        this.elements.quizPhase.textContent = "回答受付中";
        this.elements.quizPhase.className = "answer-status-pill status-unanswered";

        this.elements.btnMaru.className = `choice-btn maru ${this.tempChoice === "O" ? "selected" : ""}`;
        this.elements.btnBatsu.className = `choice-btn batsu ${this.tempChoice === "X" ? "selected" : ""}`;

        this.elements.btnChangeAnswer.style.display = "none";
        this.elements.btnConfirmAnswer.style.display = "block";

        if (this.tempChoice) {
          const mark = this.tempChoice === "O" ? "〇" : "✕";
          this.elements.confirmGuideText.textContent = `【 ${mark} 】を選択中。下のボタンで確定してください。`;
          this.elements.btnConfirmAnswer.textContent = `【 ${mark} 】で解答を決定する`;
          this.elements.btnConfirmAnswer.disabled = false;
        } else {
          this.elements.confirmGuideText.textContent = "どちらかを選択してください";
          this.elements.btnConfirmAnswer.textContent = "解答を送信する";
          this.elements.btnConfirmAnswer.disabled = true;
        }
      }
    }
  }

  /* -------------------------------------------------------------
   * 〇×選択アクション (誤タップ防止ステップ1: 仮選択)
   * ------------------------------------------------------------- */
  selectChoice(choice) {
    if (this.currentState.status === "ANSWER") return; // 発表中は変更不可
    if (this.confirmedChoice) return; // 確定済みの場合は先に「選び直す」を押す

    this.tempChoice = choice;
    this.render();
  }

  /* -------------------------------------------------------------
   * 送信確定アクション (誤タップ防止ステップ2: 送信)
   * ------------------------------------------------------------- */
  async confirmAnswer() {
    if (!this.tempChoice) return;
    if (this.currentState.status === "ANSWER") return;

    this.confirmedChoice = this.tempChoice;
    const qIdx = this.currentState.questionIndex;

    this.elements.btnConfirmAnswer.disabled = true;
    this.elements.btnConfirmAnswer.textContent = "送信中...";

    await syncEngine.submitAnswer(qIdx, this.userId, this.userName, this.confirmedChoice);
    this.render();
  }

  /* -------------------------------------------------------------
   * 選び直しアクション (発表前なら何度でも変更可能)
   * ------------------------------------------------------------- */
  allowChangeAnswer() {
    if (this.currentState.status === "ANSWER") return;
    // 確定状態を仮選択に戻す
    this.tempChoice = this.confirmedChoice;
    this.confirmedChoice = null;
    this.render();
  }
}

const playerApp = new PlayerApp();
window.addEventListener("DOMContentLoaded", () => {
  playerApp.init();
});
