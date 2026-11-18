const AD_CONFIG = {
  appOpen: "ca-app-pub-5317235020851620/1880905256",
  banner: "ca-app-pub-5317235020851620/2289913450",
  interstitial: "ca-app-pub-5317235020851620/6967525065",
  rewarded: "ca-app-pub-5317235020851620/6584381682",
  rewardedInterstitial: "ca-app-pub-5317235020851620/9402116716",
  native: "ca-app-pub-5317235020851620/3716731101",
  isTesting: true // Keep true for APK testing; change to false before Play Store upload
};

let AdMobPlugin = null;
let SharePlugin = null;

async function initNativePlugins() {
  try {
    if (window.Capacitor && window.Capacitor.Plugins) {
      AdMobPlugin = window.Capacitor.Plugins.AdMob;
      SharePlugin = window.Capacitor.Plugins.Share;

      if (AdMobPlugin) {
        await AdMobPlugin.initialize({ initializeForTesting: AD_CONFIG.isTesting });
        showBannerAd();
        prepareInterstitial();
        prepareRewarded();
      }
    }
  } catch (e) {
    console.log("Browser preview mode");
  }
}

async function showBannerAd() {
  if (!AdMobPlugin) return;
  try {
    await AdMobPlugin.showBanner({
      adId: AD_CONFIG.banner,
      adSize: "ADAPTIVE_BANNER",
      position: "BOTTOM_CENTER",
      margin: 0,
      isTesting: AD_CONFIG.isTesting
    });
  } catch (e) {}
}

async function prepareInterstitial() {
  if (!AdMobPlugin) return;
  try {
    await AdMobPlugin.prepareInterstitial({
      adId: AD_CONFIG.interstitial,
      isTesting: AD_CONFIG.isTesting
    });
  } catch (e) {}
}

async function showInterstitialAd() {
  if (!AdMobPlugin) return;
  try {
    await AdMobPlugin.showInterstitial();
    prepareInterstitial();
  } catch (e) {}
}

async function prepareRewarded() {
  if (!AdMobPlugin) return;
  try {
    await AdMobPlugin.prepareRewardVideoAd({
      adId: AD_CONFIG.rewarded,
      isTesting: AD_CONFIG.isTesting
    });
  } catch (e) {}
}

async function triggerRewardedAd(onRewardCallback) {
  if (!AdMobPlugin) {
    onRewardCallback();
    return;
  }
  try {
    const reward = await AdMobPlugin.showRewardVideoAd();
    if (reward) onRewardCallback();
    prepareRewarded();
  } catch (e) {
    alert("Ad loading... try again in 3 seconds.");
    prepareRewarded();
  }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(type) {
  if (!state.sound) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === "correct") {
      osc.frequency.setValueAtTime(520, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
    } else if (type === "wrong") {
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(130, audioCtx.currentTime + 0.25);
    } else {
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    }
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

let state = JSON.parse(localStorage.getItem("bv_10k_state")) || {
  coins: 150,
  streak: 1,
  solvedIds: [],
  bookmarks: [],
  totalPlayed: 0,
  totalCorrect: 0,
  sound: true
};

function saveState() {
  localStorage.setItem("bv_10k_state", JSON.stringify(state));
  updateHeaderUI();
}

function updateHeaderUI() {
  document.getElementById("coin-count").textContent = state.coins;
  document.getElementById("streak-count").textContent = state.streak;
  document.getElementById("bookmark-count").textContent = state.bookmarks.length;
  document.getElementById("sound-toggle").textContent = state.sound ? "🔊" : "🔇";

  const solvedCount = state.solvedIds.length;
  const totalQ = QUESTION_BANK.length || 500;
  document.getElementById("mastery-text").textContent = `${solvedCount} / ${totalQ} Solved`;
  const pct = Math.min(100, (solvedCount / totalQ) * 100);
  document.getElementById("mastery-fill").style.width = `${pct}%`;
}

let currentSession = [];
let currentIndex = 0;
let sessionScore = 0;
let sessionCorrect = 0;
let timerInterval = null;
let timeLeft = 20;
let answered = false;

function renderCategories() {
  const grid = document.getElementById("category-grid");
  grid.innerHTML = CATEGORIES.map(cat => {
    const count = QUESTION_BANK.filter(q => q.cat === cat.id).length;
    return `
      <div class="cat-card" onclick="startQuiz('${cat.id}')">
        <span class="cat-icon">${cat.icon}</span>
        <h4>${cat.name}</h4>
        <span>${count} Rare Facts</span>
      </div>
    `;
  }).join("");
}

function startQuiz(category) {
  playTone("click");
  let pool = category === "ALL"
    ? [...QUESTION_BANK]
    : QUESTION_BANK.filter(q => q.cat === category);

  if (pool.length === 0) pool = [...QUESTION_BANK];

  pool.sort(() => Math.random() - 0.5);
  pool.sort((a, b) => state.solvedIds.includes(a.id) - state.solvedIds.includes(b.id));
  currentSession = pool.slice(0, 15);
  currentIndex = 0;
  sessionScore = 0;
  sessionCorrect = 0;

  switchScreen("quiz-screen");
  loadQuestion();
}

function loadQuestion() {
  answered = false;
  clearInterval(timerInterval);
  timeLeft = 20;

  const q = currentSession[currentIndex];
  document.getElementById("quiz-cat-badge").textContent = q.cat;
  document.getElementById("q-counter").textContent = `Q ${currentIndex + 1}/${currentSession.length}`;
  document.getElementById("question-text").textContent = q.q;
  document.getElementById("fact-box").classList.add("hidden");

  const isSaved = state.bookmarks.includes(q.id);
  document.getElementById("bookmark-btn").textContent = isSaved ? "★" : "🔖";

  document.getElementById("ll-5050").disabled = false;
  document.getElementById("ll-time").disabled = false;

  const optContainer = document.getElementById("options-list");
  const letters = ["A", "B", "C", "D"];
  optContainer.innerHTML = q.options.map((opt, idx) => `
    <button class="opt-btn" id="opt-${idx}" onclick="selectAnswer(${idx})">
      <strong>${letters[idx]}.</strong> <span>${opt}</span>
    </button>
  `).join("");

  startTimer();
}

function startTimer() {
  const timerEl = document.getElementById("timer-sec");
  const timerBox = document.getElementById("timer-box");
  timerEl.textContent = timeLeft;
  timerBox.classList.remove("low");

  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 5) timerBox.classList.add("low");
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      selectAnswer(-1);
    }
  }, 1000);
}

function selectAnswer(selectedIndex) {
  if (answered) return;
  answered = true;
  clearInterval(timerInterval);

  const q = currentSession[currentIndex];
  const buttons = document.querySelectorAll(".opt-btn");
  buttons.forEach(btn => (btn.style.pointerEvents = "none"));

  state.totalPlayed++;

  if (selectedIndex === q.ans) {
    playTone("correct");
    buttons[selectedIndex].classList.add("correct");
    sessionScore += 10 + timeLeft;
    sessionCorrect++;
    state.totalCorrect++;
    state.coins += 5;
    if (!state.solvedIds.includes(q.id)) state.solvedIds.push(q.id);
  } else {
    playTone("wrong");
    if (selectedIndex >= 0) buttons[selectedIndex].classList.add("wrong");
    buttons[q.ans].classList.add("correct");
  }

  saveState();
  document.getElementById("fact-explanation").textContent = q.fact;
  document.getElementById("fact-box").classList.remove("hidden");
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex === 7) {
    showInterstitialAd();
  }
  if (currentIndex < currentSession.length) {
    loadQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  showInterstitialAd();
  const earnedCoins = sessionCorrect * 5;
  document.getElementById("res-score").textContent = sessionScore;
  document.getElementById("res-correct").textContent = `${sessionCorrect}/${currentSession.length}`;
  document.getElementById("res-coins").textContent = `+${earnedCoins}`;
  switchScreen("result-screen");
}

function use5050() {
  if (answered || state.coins < 25) return alert("Need 25 coins!");
  state.coins -= 25;
  saveState();
  document.getElementById("ll-5050").disabled = true;

  const q = currentSession[currentIndex];
  let wrongIndices = [0, 1, 2, 3].filter(i => i !== q.ans);
  wrongIndices.sort(() => Math.random() - 0.5);
  document.getElementById(`opt-${wrongIndices[0]}`).classList.add("disabled");
  document.getElementById(`opt-${wrongIndices[1]}`).classList.add("disabled");
}

function useExtraTime() {
  if (answered || state.coins < 20) return alert("Need 20 coins!");
  state.coins -= 20;
  saveState();
  timeLeft += 15;
  document.getElementById("timer-sec").textContent = timeLeft;
  document.getElementById("ll-time").disabled = true;
}

function useSkipAd() {
  if (answered) return;
  triggerRewardedAd(() => {
    nextQuestion();
  });
}

function watchRewardedForCoins() {
  triggerRewardedAd(() => {
    state.coins += 50;
    saveState();
    alert("🎉 +50 Coins Added!");
  });
}

function doubleCoinsWithAd() {
  triggerRewardedAd(() => {
    const bonus = sessionCorrect * 5;
    state.coins += bonus;
    saveState();
    alert(`🎉 Doubled! +${bonus} Extra Coins Added!`);
  });
}

async function shareText(title, text) {
  try {
    if (SharePlugin) {
      await SharePlugin.share({ title, text, dialogTitle: title });
    } else if (navigator.share) {
      await navigator.share({ title, text });
    } else {
      navigator.clipboard.writeText(text);
      alert("Copied to clipboard to share!");
    }
  } catch (e) {}
}

function shareApp() {
  shareText(
    "BrainVault 10K Quiz",
    "🧠 Think you're smart? Try BrainVault 10K — rare & unknown English trivia facts! Download now!"
  );
}

function shareCurrentFact() {
  const q = currentSession[currentIndex];
  shareText("Mind-Blowing Fact!", `🤯 Did you know?\n\nQ: ${q.q}\nAnswer: ${q.options[q.ans]}\n\n💡 ${q.fact}\n\n— Shared via BrainVault 10K App`);
}

function shareScore() {
  shareText("My Trivia Score", `🏆 I scored ${sessionScore} pts (${sessionCorrect}/${currentSession.length} correct) on BrainVault 10K Rare Trivia! Can you beat me?`);
}

function toggleBookmark() {
  const q = currentSession[currentIndex];
  const idx = state.bookmarks.indexOf(q.id);
  if (idx > -1) state.bookmarks.splice(idx, 1);
  else state.bookmarks.push(q.id);
  saveState();
  document.getElementById("bookmark-btn").textContent = idx > -1 ? "🔖" : "★";
}

function openModal(id) {
  if (id === "bookmarks-modal") {
    const list = document.getElementById("bookmarks-list");
    const saved = QUESTION_BANK.filter(q => state.bookmarks.includes(q.id));
    list.innerHTML = saved.length
      ? saved.map(q => `<div class="saved-item"><strong>${q.q}</strong><br><small style="color:#10b981">✔ ${q.options[q.ans]}</small></div>`).join("")
      : "<p style='color:#94a3b8'>No saved facts yet. Tap 🔖 during a quiz to save!</p>";
  }
  if (id === "stats-modal") {
    const acc = state.totalPlayed ? Math.round((state.totalCorrect / state.totalPlayed) * 100) : 0;
    document.getElementById("stats-body").innerHTML = `
      <div class="r-stat"><strong>${state.totalPlayed}</strong><span>Answered</span></div>
      <div class="r-stat"><strong>${acc}%</strong><span>Accuracy</span></div>
      <div class="r-stat"><strong>${state.solvedIds.length}</strong><span>Unique Facts</span></div>
      <div class="r-stat"><strong>${state.streak} Days</strong><span>Streak</span></div>
    `;
  }
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) { document.getElementById(id).classList.add("hidden"); }
function switchScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
function exitQuiz() { clearInterval(timerInterval); goHome(); }
function goHome() { switchScreen("home-screen"); updateHeaderUI(); }

document.getElementById("sound-toggle").onclick = () => {
  state.sound = !state.sound;
  saveState();
};

window.addEventListener("DOMContentLoaded", () => {
  renderCategories();
  updateHeaderUI();
  initNativePlugins();
});
      
