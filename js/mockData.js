/**
 * 天浜線 文化財めぐり号 クイズ問題データ
 * スプレッドシート未設定時やローカルテスト時に使用されます。
 */
const MOCK_QUIZ_DATA = [
  {
    id: 1,
    question: "天竜二俣駅にある「転車台（ターンテーブル）」と「扇形車庫」は、国の登録有形文化財に登録されている？",
    answer: "O", // 'O' = 〇, 'X' = ×
    explanation: "正解は【 〇 】！1940年（昭和15年）の国鉄二俣線全線開通時から現役で稼働しており、扇形車庫・運転区事務室などと共に国の登録有形文化財に登録されています。",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Tenryu-Futamata_Station%2C_ekisha.jpg/800px-Tenryu-Futamata_Station%2C_ekisha.jpg"
  },
  {
    id: 2,
    question: "天浜線（天竜浜名湖鉄道）の旧国鉄時代の路線名は「遠州鉄道」であった？",
    answer: "X",
    explanation: "正解は【 × 】！旧国鉄時代の路線名は「二俣線（ふたません）」です。東海道本線のバイパス路線（軍事的な迂回路）としての使命も持って建設されました。",
    imageUrl: "" // 画像なしパターンのテスト
  },
  {
    id: 3,
    question: "天竜浜名湖鉄道の全線（掛川駅〜新所原駅）において、登録有形文化財に登録されている施設は全部で30箇所以上ある？",
    answer: "O",
    explanation: "正解は【 〇 】！なんと駅舎、プラットホーム、橋梁、転車台など合計36件もの施設が国の登録有形文化財に登録されています。まさに『走る文化財博物館』です！",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Tenry%C5%AB-Futamata_Sta_Platform.jpg/800px-Tenry%C5%AB-Futamata_Sta_Platform.jpg"
  },
  {
    id: 4,
    question: "天浜線の線路で最も長い川を渡る「天竜川橋梁」は、途中で列車がすれ違える複線である？",
    answer: "X",
    explanation: "正解は【 × 】！天浜線は全線が単線（線路が1本）です。天竜川橋梁も美しい鋼トラス橋ですが単線となっています。",
    imageUrl: "" // 画像なし
  },
  {
    id: 5,
    question: "天浜線は東の「掛川駅」から西の「新所原駅」までの全長67.7kmを結んでいる？",
    answer: "O",
    explanation: "正解は【 〇 】！掛川駅から浜名湖の北岸をぐるりと回り、湖西市の新所原駅まで全39駅、67.7kmをのんびり走っています。",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Tenryu-Hutamata-eki-2.jpg/800px-Tenryu-Hutamata-eki-2.jpg"
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MOCK_QUIZ_DATA };
}
