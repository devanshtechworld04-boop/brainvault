document.addEventListener("DOMContentLoaded", function () {
  var CATS = [
    { id: "History", name: "Lost History", icon: "🏛️" },
    { id: "Science", name: "Weird Science", icon: "🧬" },
    { id: "Space", name: "Deep Cosmos", icon: "🪐" },
    { id: "Psychology", name: "Dark Psychology", icon: "🧠" },
    { id: "Geography", name: "Hidden Earth", icon: "🌍" },
    { id: "Inventions", name: "Forgotten Tech", icon: "⚙️" },
    { id: "Nature", name: "Bizarre Nature", icon: "🦑" },
    { id: "Culture", name: "Secret Culture", icon: "🎭" },
    { id: "Records", name: "Impossible Feats", icon: "🏅" },
    { id: "Mysteries", name: "Unsolved Files", icon: "🕵️" }
  ];

  var FALLBACK = [
    { id: 1, cat: "History", q: "Which Roman emperor appointed his horse Incitatus as a priest?", options: ["Caligula", "Nero", "Commodus", "Elagabalus"], ans: 0, fact: "Caligula gave Incitatus a marble stable and ivory manger." },
    { id: 2, cat: "Science", q: "What is the only letter absent from the Periodic Table?", options: ["Q", "J", "X", "Z"], ans: 1, fact: "The letter J never appears in any element symbol or name." },
    { id: 3, cat: "Space", q: "Which planet has a day longer than its entire year?", options: ["Mercury", "Venus", "Neptune", "Uranus"], ans: 1, fact: "Venus takes 243 Earth days to rotate once, and 225 days to orbit the Sun." }
  ];

  var BANK = (typeof QUESTION_BANK !== "undefined" && Array.isArray(QUESTION_BANK) && QUESTION_BANK.length > 0)
    ? QUESTION_BANK
    : FALLBACK;

  // AdMob Setup (Google Official Test IDs for Instant Verification)
  var AdMob = (window.Capacitor && window.Capacitor.Plugins) ? window.Capacitor.Plugins.AdMob : null;
  var Share = (window.Capacitor && window.Capacitor.Plugins) ? window.Capacitor.Plugins.Share : null;

  var TEST_IDS = {
    banner: "ca-app-pub-3940256099942544/6300978111",
    interstitial: "ca-app-pub-3940256099942544/1033173712",
    rewarded: "ca-app-pub-3940256099942544/5224354917"
  };

  async function initAds() {
    if (!AdMob) return;
    try {
      await AdMob.initialize({ initializeForTesting: true });
      await AdMob.showBanner({
        adId: TEST_IDS.banner,
        adSize: "ADAPTIVE_BANNER",
        position: "BOTTOM_CENTER",
        margin: 0,
        isTesting: true
      });
      await AdMob.prepareInterstitial({ adId: TEST_IDS.interstitial, isTesting: true });
      await AdMob.prepareRewardVideoAd({ adId: TEST_IDS.rewarded, isTesting: true });
    } catch (e) {}
  }

  async function showInterstitial() {
    if (!AdMob) return;
    try {
      await AdMob.showInterstitial();
      await AdMob.prepareInterstitial({ adId: TEST_IDS.interstitial, isTesting: true });
    } catch (e) {}
  }

  async function showRewarded(onDone) {
    if (!AdMob) return onDone();
    try {
      var r = await AdMob.showRewardVideoAd();
      if (r) onDone();
      await AdMob.prepareRewardVideoAd({ adId: TEST_IDS.rewarded, isTesting: true });
    } catch (e) {
      onDone();
    }
  }

  // State
  var state = { coins: 150, streak: 1, solvedIds: [], bookmarks: [], totalPlayed: 0, totalCorrect: 0, sound: true };
  try {
    var saved = JSON.parse(localStorage.getItem("bv_10k_state"));
    if (saved) state = Object.assign(state, saved);
  } catch (e) {}

  function saveState() {
    try { localStorage.setItem("bv_10k_state", JSON.stringify(state)); } catch (e) {}
    refreshUI();
  }

  function refreshUI() {
    document.getElementById("total-db-count").textContent = BANK.length + " Rare Facts Ready";
    document.getElementById("coin-count").textContent = state.coins;
    document.getElementById("streak-count").textContent = state.streak;
    document.getElementById("bookmark-count").textContent = state.bookmarks.length;
    document.getElementById("sound-toggle").textContent = state.sound ? "🔊" : "🔇";
    document.getElementById("mastery-text").textContent = state.solvedIds.length + " / " + BANK.length + " Solved";
    document.getElementById("mastery-fill").style.width = Math.min(100, (state.solvedIds.length / BANK.length) * 100) + "%";
  }

  function renderCategories() {
    var grid = document.getElementById("category-grid");
    grid.innerHTML = "";
    CATS.forEach(function (c) {
      var cnt = BANK.filter(function (q) { return q.cat === c.id; }).length;
      var card = document.createElement("div");
      card.className = "cat-card";
      card.innerHTML = '<span class="cat-icon">' + c.icon + '</span><h4>' + c.name + '</h4><span>' + cnt + ' Rare Facts</span>';
      card.addEventListener("click", function () { startQuiz(c.id); });
      grid.appendChild(card);
    });
  }

  var session = [], idx = 0, score = 0, correctCnt = 0, timer = null, sec = 20, answered = false;

  function switchScreen(id) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    document.getElementById(id).classList.add("active");
  }

  function startQuiz(cat) {
    var pool = (cat === "ALL") ? BANK.slice() : BANK.filter(function (q) { return q.cat === cat; });
    if (pool.length === 0) pool = BANK.slice();
    pool.sort(function () { return Math.random() - 0.5; });
    session = pool.slice(0, 15);
    idx = 0; score = 0; correctCnt = 0;
    switchScreen("quiz-screen");
    loadQuestion();
  }

  function loadQuestion() {
    answered = false;
    clearInterval(timer);
    sec = 20;
    var q = session[idx];
    document.getElementById("quiz-cat-badge").textContent = q.cat;
    document.getElementById("q-counter").textContent = "Q " + (idx + 1) + "/" + session.length;
    document.getElementById("question-text").textContent = q.q;
    document.getElementById("fact-box").classList.add("hidden");
    document.getElementById("bookmark-btn").textContent = state.bookmarks.indexOf(q.id) > -1 ? "★" : "🔖";
    document.getElementById("ll-5050").disabled = false;
    document.getElementById("ll-time").disabled = false;

    var list = document.getElementById("options-list");
    list.innerHTML = "";
    var letters = ["A", "B", "C", "D"];
    q.options.forEach(function (opt, i) {
      var btn = document.createElement("button");
      btn.className = "opt-btn";
      btn.id = "opt-" + i;
      btn.innerHTML = "<strong>" + letters[i] + ".</strong> " + opt;
      btn.addEventListener("click", function () { pickAnswer(i); });
      list.appendChild(btn);
    });

    document.getElementById("timer-sec").textContent = sec;
    timer = setInterval(function () {
      sec--;
      document.getElementById("timer-sec").textContent = sec;
      if (sec <= 0) { clearInterval(timer); pickAnswer(-1); }
    }, 1000);
  }

  function pickAnswer(choice) {
    if (answered) return;
    answered = true;
    clearInterval(timer);
    var q = session[idx];
    document.querySelectorAll(".opt-btn").forEach(function (b) { b.style.pointerEvents = "none"; });
    state.totalPlayed++;
    if (choice === q.ans) {
      document.getElementById("opt-" + choice).classList.add("correct");
      score += 10 + sec;
      correctCnt++;
      state.totalCorrect++;
      state.coins += 5;
      if (state.solvedIds.indexOf(q.id) === -1) state.solvedIds.push(q.id);
    } else {
      if (choice >= 0) document.getElementById("opt-" + choice).classList.add("wrong");
      document.getElementById("opt-" + q.ans).classList.add("correct");
    }
    saveState();
    document.getElementById("fact-explanation").textContent = q.fact;
    document.getElementById("fact-box").classList.remove("hidden");
  }

  // Bind All Buttons Cleanly
  document.getElementById("btn-quick-play").addEventListener("click", function () { startQuiz("ALL"); });
  document.getElementById("btn-exit-quiz").addEventListener("click", function () { clearInterval(timer); switchScreen("home-screen"); refreshUI(); });
  document.getElementById("btn-go-home").addEventListener("click", function () { switchScreen("home-screen"); refreshUI(); });
  document.getElementById("sound-toggle").addEventListener("click", function () { state.sound = !state.sound; saveState(); });

  document.getElementById("btn-next-q").addEventListener("click", function () {
    idx++;
    if (idx === 7) showInterstitial();
    if (idx < session.length) loadQuestion();
    else {
      showInterstitial();
      document.getElementById("res-score").textContent = score;
      document.getElementById("res-correct").textContent = correctCnt + "/" + session.length;
      document.getElementById("res-coins").textContent = "+" + (correctCnt * 5);
      switchScreen("result-screen");
    }
  });

  document.getElementById("ll-5050").addEventListener("click", function () {
    if (answered || state.coins < 25) return alert("Need 25 coins!");
    state.coins -= 25; saveState();
    this.disabled = true;
    var q = session[idx];
    var wrong = [0, 1, 2, 3].filter(function (i) { return i !== q.ans; }).sort(function () { return Math.random() - 0.5; });
    document.getElementById("opt-" + wrong[0]).classList.add("disabled");
    document.getElementById("opt-" + wrong[1]).classList.add("disabled");
  });

  document.getElementById("ll-time").addEventListener("click", function () {
    if (answered || state.coins < 20) return alert("Need 20 coins!");
    state.coins -= 20; saveState();
    sec += 15;
    document.getElementById("timer-sec").textContent = sec;
    this.disabled = true;
  });

  document.getElementById("ll-skip").addEventListener("click", function () {
    if (!answered) showRewarded(function () { document.getElementById("btn-next-q").click(); });
  });

  function addFreeCoins() {
    showRewarded(function () { state.coins += 50; saveState(); alert("🎉 +50 Coins Added!"); });
  }
  document.getElementById("btn-free-coins").addEventListener("click", addFreeCoins);
  document.getElementById("native-ad-slot").addEventListener("click", addFreeCoins);
  document.getElementById("btn-double-coins").addEventListener("click", function () {
    showRewarded(function () { var b = correctCnt * 5; state.coins += b; saveState(); alert("🎉 +" + b + " Extra Coins!"); });
  });

  function doShare(title, text) {
    if (Share) Share.share({ title: title, text: text, dialogTitle: title });
    else if (navigator.share) navigator.share({ title: title, text: text });
    else alert(text);
  }
  document.getElementById("btn-share-app").addEventListener("click", function () { doShare("BrainVault 10K", "🧠 Try BrainVault 10K — rare & unknown English trivia facts!"); });
  document.getElementById("btn-share-fact").addEventListener("click", function () { var q = session[idx]; doShare("Mind-Blowing Fact", "🤯 " + q.q + "\n✔ " + q.options[q.ans] + "\n💡 " + q.fact); });
  document.getElementById("btn-share-score").addEventListener("click", function () { doShare("My Score", "🏆 I scored " + score + " pts on BrainVault 10K!"); });

  document.getElementById("bookmark-btn").addEventListener("click", function () {
    var q = session[idx];
    var i = state.bookmarks.indexOf(q.id);
    if (i > -1) state.bookmarks.splice(i, 1); else state.bookmarks.push(q.id);
    saveState();
    this.textContent = i > -1 ? "🔖" : "★";
  });

  document.getElementById("btn-open-bookmarks").addEventListener("click", function () {
    var saved = BANK.filter(function (q) { return state.bookmarks.indexOf(q.id) > -1; });
    document.getElementById("bookmarks-list").innerHTML = saved.length
      ? saved.map(function (q) { return '<div class="saved-item"><strong>' + q.q + '</strong><br><small style="color:#10b981">✔ ' + q.options[q.ans] + '</small></div>'; }).join("")
      : "<p style='color:#94a3b8'>No saved facts yet!</p>";
    document.getElementById("bookmarks-modal").classList.remove("hidden");
  });
  document.getElementById("close-bookmarks").addEventListener("click", function () { document.getElementById("bookmarks-modal").classList.add("hidden"); });

  document.getElementById("btn-open-stats").addEventListener("click", function () {
    var acc = state.totalPlayed ? Math.round((state.totalCorrect / state.totalPlayed) * 100) : 0;
    document.getElementById("stats-body").innerHTML =
      '<div class="r-stat"><strong>' + state.totalPlayed + '</strong><span>Answered</span></div>' +
      '<div class="r-stat"><strong>' + acc + '%</strong><span>Accuracy</span></div>' +
      '<div class="r-stat"><strong>' + state.solvedIds.length + '</strong><span>Unique Facts</span></div>' +
      '<div class="r-stat"><strong>' + state.streak + ' Days</strong><span>Streak</span></div>';
    document.getElementById("stats-modal").classList.remove("hidden");
  });
  document.getElementById("close-stats").addEventListener("click", function () { document.getElementById("stats-modal").classList.add("hidden"); });

  // Initialize Everything
  renderCategories();
  refreshUI();
  initAds();
});
                                    
