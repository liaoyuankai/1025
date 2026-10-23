(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const progressBar = document.querySelector("#progress-bar");
  const soundButton = document.querySelector("#sound-toggle");
  const soundLabel = soundButton?.querySelector(".sound-toggle__text");
  const confettiLayer = document.querySelector("#confetti");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, reduceMotion ? 0 : ms));
  let current = 0;
  // 用定时器而不是 requestAnimationFrame：某些内置浏览器在后台/低电量时会暂停 rAF
  const nextTick = (fn) => window.setTimeout(() => fn(performance.now()), 16);

  /* ---------- 翻页 ---------- */
  const enterHooks = {};

  function show(index) {
    if (!slides[index]) return;
    slides[current].classList.remove("is-active");
    current = index;
    const slide = slides[current];
    slide.scrollTop = 0;
    slide.classList.add("is-active");
    if (progressBar) progressBar.style.width = `${(current / (slides.length - 1)) * 100}%`;
    enterHooks[slide.dataset.slide]?.(slide);
    // 同一页有多条评论时一条打完再打下一条
    (async () => { for (const reply of slide.querySelectorAll(".post__reply [data-type]:not([data-manual])")) await typeReply(reply, 1200); })();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".next")) show(current + 1);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("textarea")) return;
    const nextButton = [...slides[current].querySelectorAll(".next")].find((button) => button.offsetParent);
    if (event.key === "ArrowRight" && current > 0 && nextButton) show(current + 1);
    if (event.key === "ArrowLeft" && current > 1) show(current - 1);
  });

  /* ---------- 音乐：全程 Someone to Love，关灯许愿时换成生日歌 ---------- */
  const bgm = new Audio("assets/bgm.m4a?v=3");
  bgm.loop = true;
  const song = new Audio("assets/happy-birthday.m4a?v=3");
  const CHORUS_AT = 96; // 1:36 副歌第一拍，前面约 1 秒几乎没声
  // iPhone 不让网页调音量（volume 永远是 1），所以两首歌已在文件里调成一样响，那边切歌直接停/放
  const canFade = (() => { const probe = new Audio(); probe.volume = 0.5; return probe.volume === 0.5; })();
  let track = bgm;
  let soundOn = false;
  let muted = false; // 她自己点了暂停
  let wantSound = false; // 此刻本该有声音（生日歌唱完后的安静不算）
  let lastPlayError = "";

  function setSound(playing) {
    soundOn = playing;
    soundButton?.setAttribute("aria-pressed", String(playing));
    soundButton?.setAttribute("aria-label", playing ? "暂停音乐" : "播放音乐");
    if (soundLabel) soundLabel.textContent = playing ? "播放中" : "音乐";
  }

  async function play(audio) {
    wantSound = true;
    try {
      await audio.play();
      setSound(true);
    } catch (error) {
      lastPlayError = `${audio === bgm ? "BGM" : "生日歌"} ${error.name}`;
      setSound(false);
    }
  }

  function fadeOut(audio, ms = 700) {
    if (!canFade) { audio.pause(); return; }
    const id = (audio.fadeId = (audio.fadeId || 0) + 1);
    const start = performance.now();
    const step = (now) => {
      if (audio.fadeId !== id) return;
      const t = Math.min(1, (now - start) / ms);
      audio.volume = 1 - t;
      if (t < 1) nextTick(step);
      else { audio.pause(); audio.volume = 1; }
    };
    nextTick(step);
  }

  // 切歌：旧的淡出，新的从 at 秒开始；她关了音乐的话只记住位置
  function switchTo(next, at = 0) {
    const prev = track;
    track = next;
    next.fadeId = (next.fadeId || 0) + 1;
    next.volume = 1;
    next.currentTime = at;
    if (muted) return;
    if (prev !== next) fadeOut(prev);
    play(next);
  }

  soundButton?.addEventListener("click", () => {
    muted = soundOn;
    if (soundOn) {
      wantSound = false;
      track.pause();
      setSound(false);
    } else {
      play(track);
    }
  });
  bgm.addEventListener("error", () => { if (soundButton && track === bgm) soundButton.hidden = true; });
  song.addEventListener("ended", () => { wantSound = false; setSound(false); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && soundOn) { track.pause(); setSound(false); }
  });

  // 微信有时会拦下不是点击直接触发的播放（比如吹灭蜡烛后自动接副歌），她下一次碰屏幕时补上
  ["touchend", "click"].forEach((type) => document.addEventListener(type, (event) => {
    if (wantSound && !muted && track.paused && !event.target.closest("#sound-toggle")) play(track);
  }, true));

  /* 真机排查用：链接末尾加 ?debug，左下角显示两首歌的播放状态 */
  if (location.search.includes("debug")) {
    const panel = document.createElement("pre");
    panel.className = "debug";
    document.body.append(panel);
    const describe = (audio) => `${audio.paused ? "⏸" : "▶"} ${audio.currentTime.toFixed(1)}s 缓冲${audio.readyState}${audio.error ? ` 出错${audio.error.code}` : ""}`;
    window.setInterval(() => {
      panel.textContent = `BGM   ${describe(bgm)}\n生日歌 ${describe(song)}\n该响 ${wantSound} 静音 ${muted} ${lastPlayError}`;
    }, 300);
  }

  /* ---------- 彩带 ---------- */
  const confettiColors = ["#ff5fa2", "#9b7bff", "#8fd3ff", "#ffd36e", "#ffffff", "#ffb3d4"];
  function confetti(amount = 60) {
    if (!confettiLayer || reduceMotion) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < amount; i += 1) {
      const piece = document.createElement("i");
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = confettiColors[i % confettiColors.length];
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      piece.style.setProperty("--t", `${2.2 + Math.random() * 1.6}s`);
      piece.style.setProperty("--dx", `${-80 + Math.random() * 160}px`);
      piece.style.setProperty("--rot", `${360 + Math.random() * 540}deg`);
      if (i % 3 === 0) piece.style.borderRadius = "50%";
      fragment.appendChild(piece);
    }
    confettiLayer.appendChild(fragment);
    window.setTimeout(() => confettiLayer.replaceChildren(), 4600);
  }

  function countUp(el, target, ms = 1200) {
    if (reduceMotion) { el.textContent = target; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = Math.round(target * (1 - (1 - t) ** 3));
      if (t < 1) nextTick(step);
    };
    nextTick(step);
  }

  const reveal = (el, block = "end") => {
    if (!el) return;
    el.hidden = false;
    window.setTimeout(() => el.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block}), reduceMotion ? 0 : 350);
  };

  /* ---------- 认识的日子：2022.10.30 认识，按她打开网页的那天算（预览可加 ?today=2026-10-25） ---------- */
  const MET = new Date(2022, 9, 30);
  const fakeToday = location.search.match(/today=(\d{4})-(\d{1,2})-(\d{1,2})/);
  const today = fakeToday ? new Date(+fakeToday[1], fakeToday[2] - 1, +fakeToday[3]) : new Date();
  today.setHours(0, 0, 0, 0);
  const DAYS_KNOWN = Math.round((today - MET) / 86400000) + 1; // 认识那天算第 1 天
  const WHEN = (() => {
    const years = today.getFullYear() - MET.getFullYear();
    const toAnniversary = Math.round((new Date(today.getFullYear(), 9, 30) - today) / 86400000);
    const cn = "零一二三四五六七八九十"[years] || years;
    if (toAnniversary === 0) return `今天刚好认识${cn}周年的`;
    if (toAnniversary > 0 && toAnniversary <= 30) return `再过${toAnniversary}天就认识${cn}周年的`;
    return `认识第 ${DAYS_KNOWN} 天的`;
  })();
  document.querySelectorAll("[data-when]").forEach((el) => { el.textContent = WHEN; });
  document.querySelectorAll("[data-days]").forEach((el) => { el.textContent = DAYS_KNOWN.toLocaleString("en-US"); });

  /* ---------- 点赞栏：每次打开随机挑 2~3 个马甲（其实全是同一个人，片尾揭晓） ---------- */
  const ALIASES = ["粉毛小帅", "病娇男大", "大廖一世", "非酋陪跑员", "奶茶搭子候选人", "两点睡觉监督员", "5s 寻物启事发起人"];
  document.querySelectorAll("[data-likers]").forEach((likers) => {
    const pool = [...ALIASES];
    const picked = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    likers.replaceChildren(...picked.flatMap((name, i) => {
      const span = document.createElement("span");
      span.className = "me";
      span.textContent = name;
      return i ? ["，", span] : [span];
    }));
  });

  /* ---------- 彩蛋：连点 5 下任意一个马甲 ---------- */
  const egg = document.querySelector("#egg");
  let eggTaps = 0;
  let eggTimer = 0;
  document.addEventListener("click", (event) => {
    const me = event.target.closest(".me");
    if (!me || !egg) return;
    me.classList.remove("is-poked");
    void me.offsetWidth; // 重新触发闪一下的动画
    me.classList.add("is-poked");
    eggTaps += 1;
    window.clearTimeout(eggTimer);
    eggTimer = window.setTimeout(() => { eggTaps = 0; }, 1500);
    if (eggTaps < 5) return;
    eggTaps = 0;
    egg.hidden = false;
    navigator.vibrate?.(40);
    confetti(50);
  });
  document.querySelector("#egg-close")?.addEventListener("click", () => { egg.hidden = true; });
  egg?.addEventListener("click", (event) => { if (event.target === egg) egg.hidden = true; });

  /* ---------- 迟到的评论：翻到这一页，马甲们的评论一个字一个字打出来 ---------- */
  document.querySelectorAll(".post__reply [data-type]").forEach((reply) => {
    const typed = document.createElement("span");
    const ghost = document.createElement("span");
    ghost.className = "ghost"; // 没打出来的字先隐形占位，打字时不会跳行
    ghost.textContent = reply.textContent;
    reply.replaceChildren(typed, ghost);
    reply.parentElement.classList.add("is-waiting");
  });

  async function typeReply(reply, delay = 0) {
    if (!reply || reply.dataset.state) return;
    reply.dataset.state = "typing";
    const [typed, ghost] = reply.children;
    const chars = [...ghost.textContent];
    await wait(delay);
    reply.parentElement.classList.remove("is-waiting");
    reply.closest(".post")?.classList.add("is-liked");
    typed.classList.add("caret");
    for (let i = 1; i <= chars.length; i += 1) {
      typed.textContent = chars.slice(0, i).join("");
      ghost.textContent = chars.slice(i).join("");
      await wait("，。！？：".includes(chars[i - 1]) ? 260 : 75);
    }
    typed.classList.remove("caret");
    reply.dataset.state = "done";
  }

  /* ---------- 00 打字机开场 ---------- */
  const lines = [...document.querySelectorAll("#typewriter [data-line]")];
  const startButton = document.querySelector("#start");
  const skipButton = document.querySelector("#skip-type");
  const fullText = lines.map((line) => line.textContent);
  let typingDone = false;

  function finishTyping() {
    if (typingDone) return;
    typingDone = true;
    lines.forEach((line, i) => {
      line.textContent = fullText[i];
      line.classList.add("is-typed");
      line.classList.remove("caret");
    });
    if (startButton) startButton.hidden = false;
    if (skipButton) skipButton.hidden = true;
  }

  async function typeIntro() {
    if (reduceMotion) return finishTyping();
    lines.forEach((line) => { line.textContent = ""; });
    await wait(500);
    for (let i = 0; i < lines.length; i += 1) {
      if (typingDone) return;
      const line = lines[i];
      line.classList.add("is-typed", "caret");
      for (const char of fullText[i]) {
        if (typingDone) return;
        line.textContent += char;
        await wait(char === "，" || char === "：" ? 220 : 75);
      }
      line.classList.remove("caret");
      await wait(i === 1 || i === 5 ? 650 : 320);
    }
    finishTyping();
  }

  skipButton?.addEventListener("click", finishTyping);
  startButton?.addEventListener("click", () => {
    if (soundButton) soundButton.hidden = false;
    play(bgm);
    show(1);
    confetti(40);
  });

  /* ---------- 02 被折叠的朋友圈 ---------- */
  const moment = document.querySelector("#moment");
  document.querySelector("#unfold")?.addEventListener("click", (event) => {
    moment?.classList.add("is-open");
    event.currentTarget.setAttribute("aria-expanded", "true");
    const hint = document.querySelector("#unfold-hint");
    if (hint) hint.hidden = true;
    window.setTimeout(() => {
      const next = document.querySelector("#folded-next");
      if (next) next.hidden = false;
      next?.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "end"});
    }, reduceMotion ? 0 : 900);
  });

  /* ---------- 03 发圈日历：4/20—10/23 每天发了几条，是对着她的相册录屏逐日数出来的 ---------- */
  const DAILY = [4,1,4,4,2,1,2,1,2,0,3,2,4,3,5,2,3,4,4,5,5,2,4,4,2,3,1,1,3,2,3,2,5,4,4,2,3,4,4,3,3,1,5,5,4,4,3,2,1,1,3,0,2,3,2,3,4,7,1,3,3,2,2,4,2,4,5,4,2,1,2,2,3,1,4,4,1,2,1,2,4,5,4,1,4,3,1,3,6,1,2,4,2,7,4,2,4,4,0,5,3,2,4,5,3,3,5,6,6,1,4,3,2,5,4,4,5,4,2,5,5,6,3,3,5,3,2,2,3,5,4,3,4,3,3,5,5,2,5,4,3,2,3,4,1,0,2,2,1,5,5,2,2,4,1,6,1,2,3,5,3,2,5,8,4,2,6,5,2,2,5,10,1,3,3,0,2,3,1,2,0,3,7,6,2,1,2];
  const CAL_START = new Date(2026, 3, 20);
  const calStories = {
    "4-25": "爬了 2778 层楼梯，咖啡店满座 😭",
    "5-1": "宣布要玩一辈子第五人格（bushi）",
    "5-3": "分享了 Someone to Love 🎵",
    "5-6": "广州 · 幸福的响铃是翔霖 🔔",
    "5-12": "暴力裙撑，一天坐塌",
    "6-15": "稻城亚丁去不了，就去蜜雪冰城 🍋",
    "6-16": "问大家：有没有被折叠呀？",
    "7-21": "三条项链送闺蜜，善行结善缘 🍀",
    "7-28": "爱吃薯条的女孩，运气不会太差 🍟",
    "8-30": "90 块的地宫忘了领",
    "9-4": "喜茶闭店噩耗 💔",
    "9-15": "《寻找 iPhone 5s》开播",
    "9-16": "头发比仇人的家产还直",
    "9-22": "第 1810 把，300 万项链出了！💎",
    "9-27": "立下「两点前睡觉」flag",
    "10-8": "一天 10 条，年度最高纪录 🏆",
    "10-18": "好不容易上了四颗星 ⭐",
    "10-21": "只睡了五个小时，萎得不行",
    "10-23": "快递说后天才到——后天就是 10.25 🎁",
  };
  const calGrid = document.querySelector("#cal-grid");
  const calReadout = document.querySelector("#cal-readout");
  let hotCell = null;

  if (calGrid) {
    const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
    let html = "";
    for (let m = 4; m <= 10; m += 1) {
      html += `<span>${m}月</span>`;
      for (let d = 1; d <= 31; d += 1) {
        const date = new Date(2026, m - 1, d);
        const index = Math.round((date - CAL_START) / 86400000);
        if (date.getMonth() !== m - 1 || index < 0 || index >= DAILY.length) {
          html += `<i class="is-out"></i>`;
          continue;
        }
        const n = DAILY[index];
        const key = `${m}-${d}`;
        html += `<i class="lv${level(n)}${calStories[key] ? " is-tag" : ""}${n === 10 ? " is-max" : ""}" data-key="${key}" data-n="${n}" style="--d:${index}"></i>`;
      }
    }
    calGrid.innerHTML = html;
  }

  function highlight(cell) {
    if (!cell || cell === hotCell) return;
    hotCell?.classList.remove("is-hot");
    hotCell = cell;
    cell.classList.add("is-hot");
    const [m, d] = cell.dataset.key.split("-");
    const n = Number(cell.dataset.n);
    const story = calStories[cell.dataset.key];
    if (calReadout) calReadout.innerHTML = `${m} 月 ${d} 日 · ${n ? `<b>${n} 条</b>` : "这天没发 🫥"}${story ? `<small>${story}</small>` : ""}`;
  }

  const cellAt = (event) => document.elementFromPoint(event.clientX, event.clientY)?.closest("#cal-grid i[data-key]");
  calGrid?.addEventListener("pointerdown", (event) => {
    try { calGrid.setPointerCapture(event.pointerId); } catch { /* 部分浏览器不支持 */ }
    highlight(cellAt(event));
  });
  calGrid?.addEventListener("pointermove", (event) => highlight(cellAt(event)));

  enterHooks.calendar = (slide) => {
    slide.querySelectorAll("[data-count]").forEach((el) => countUp(el, Number(el.dataset.count)));
    // 先替她点亮纪录那天，示范一下格子能划
    window.setTimeout(() => { if (!hotCell) highlight(calGrid?.querySelector(".is-max")); }, reduceMotion ? 0 : 2400);
  };

  /* ---------- 04 小测验 ---------- */
  const quiz = document.querySelector("#quiz");
  const quizHint = document.querySelector("#quiz-hint");
  const quizAnswer = document.querySelector("#quiz-answer");
  const wrongHints = ["不对哦～再想想你最爱说的那个数 🤔", "差一点！提示：楼梯、围观、道歉……"];
  let wrongCount = 0;

  quiz?.addEventListener("click", (event) => {
    const option = event.target.closest(".opt");
    if (!option || quiz.classList.contains("is-solved")) return;
    if (option.dataset.answer === "yes") {
      quiz.classList.add("is-solved");
      option.classList.add("is-right");
      if (quizHint) quizHint.textContent = "";
      if (quizAnswer) quizAnswer.hidden = false;
      confetti(70);
      window.setTimeout(() => quizAnswer?.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "start"}), 350);
    } else {
      option.classList.remove("is-wrong");
      void option.offsetWidth;
      option.classList.add("is-wrong");
      if (quizHint) quizHint.textContent = wrongHints[Math.min(wrongCount, wrongHints.length - 1)];
      wrongCount += 1;
    }
  });

  /* ---------- 05 好舒服呀计数 ---------- */
  const comfyCount = document.querySelector("#comfy-count");
  enterHooks.comfy = () => {
    if (!comfyCount) return;
    const target = 12;
    if (reduceMotion) { comfyCount.textContent = target; return; }
    let n = 0;
    comfyCount.textContent = "0";
    window.setTimeout(function tick() {
      n += 1;
      comfyCount.textContent = n;
      if (n < target) window.setTimeout(tick, 60 + n * 12);
    }, 500);
  };

  /* ---------- 炸开特效：闪光、冲击波、碎片、拟声字，屏幕跟着抖一抖（泡泡、出项链、盖章共用） ---------- */
  const boomWords = ["啪！", "砰！", "BOOM!", "爆！", "没了！", "嘭！"];
  const shardColors = ["#ff5fa2", "#9b7bff", "#8fd3ff", "#ffd36e", "#ffb3d4"];

  function explode(x, y, big, word = boomWords[Math.floor(Math.random() * boomWords.length)]) {
    const boom = document.createElement("div");
    boom.className = big ? "boom boom--big" : "boom";
    boom.style.left = `${x}px`;
    boom.style.top = `${y}px`;
    let html = `<b class="boom__flash"></b><b class="boom__ring"></b><b class="boom__word">${word}</b>`;
    const count = big ? 44 : 30;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = (big ? 150 : 95) + Math.random() * (big ? 140 : 95);
      const kind = i % 4 === 0 ? "boom__star" : i % 3 === 0 ? "boom__chip" : "";
      html += `<i class="${kind}" style="--dx:${Math.round(Math.cos(angle) * dist)}px;--dy:${Math.round(Math.sin(angle) * dist)}px;--s:${Math.round(8 + Math.random() * 11)}px;--c:${shardColors[i % shardColors.length]};--r:${Math.round(Math.random() * 720 - 360)}deg">${kind === "boom__star" ? "✦" : ""}</i>`;
    }
    boom.innerHTML = html;
    document.body.append(boom);
    window.setTimeout(() => boom.remove(), 1100);
    const inner = slides[current].querySelector(".slide__inner");
    inner?.classList.remove("is-shaking");
    void inner?.offsetWidth;
    inner?.classList.add("is-shaking");
    try { navigator.vibrate?.(big ? [40, 30, 70] : 30); } catch { /* 有的浏览器不让震 */ }
  }

  const centerOf = (el) => {
    const box = el.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  };

  /* ---------- 07 摸项链：先亲手开三把，再一路快进到第 1810 把出 300 万 ---------- */
  const gacha = document.querySelector("#gacha");
  const gachaButton = document.querySelector("#gacha-pull");
  const gachaN = document.querySelector("#gacha-n");
  const gachaNeck = document.querySelector("#gacha-neck");
  const gachaResult = document.querySelector("#gacha-result");
  const firstGames = [["💧 摸到一条项链，鉴定完……不是 300 万", 1], ["🙃 这把没摸到项链，下一把", 0], ["🔍 又一条，鉴定……还是不是 300 万", 1]];
  const rushLines = ["鉴定：不是 300 万", "没摸到", "项链 +1，不是 300 万", "撤离！", "又不是", "……", "差一点", "再来一把"];
  let games = 0;
  let necklaces = 0;

  function setGacha(n, neck, line) {
    if (gachaN) gachaN.textContent = n;
    if (gachaNeck) gachaNeck.textContent = neck;
    if (gachaResult && line) gachaResult.textContent = line;
  }

  gachaButton?.addEventListener("click", () => {
    if (games < firstGames.length) {
      const [line, got] = firstGames[games];
      games += 1;
      necklaces += got;
      setGacha(games, necklaces, line);
      gachaResult?.classList.remove("is-bump");
      void gachaResult?.offsetWidth;
      gachaResult?.classList.add("is-bump");
      if (games === firstGames.length) gachaButton.textContent = "不打了，直接快进到第 1810 把 ⏩";
      return;
    }
    gachaButton.hidden = true;
    gacha?.classList.add("is-rushing");
    const from = games;
    const fromNeck = necklaces;
    const start = performance.now();
    const ms = reduceMotion ? 0 : 2800;
    let lineAt = 0;
    const step = (now) => {
      const t = ms ? Math.min(1, (now - start) / ms) : 1;
      const eased = 1 - (1 - t) ** 3;
      const fresh = now - lineAt > 110;
      if (fresh) lineAt = now;
      setGacha(Math.round(from + (1809 - from) * eased), Math.round(fromNeck + (88 - fromNeck) * eased),
        fresh ? rushLines[Math.floor(Math.random() * rushLines.length)] : "");
      if (t < 1) nextTick(step);
      else jackpot();
    };
    nextTick(step);
  });

  async function jackpot() {
    setGacha(1809, 88, "⏳ 第 1810 把……");
    await wait(700);
    gacha?.classList.remove("is-rushing");
    gacha?.classList.add("is-gold");
    setGacha(1810, 89);
    if (gachaResult) gachaResult.innerHTML = "💎 第 1810 把 · 第 89 条项链<br><b>鉴定结果：300 万！！</b>";
    if (gacha && !reduceMotion) explode(...centerOf(gacha), true, "300 万！");
    confetti(100);
    document.querySelector("#bushi")?.classList.add("is-cut");
    typeReply(document.querySelector('[data-slide="game"] [data-type]'), 900);
    reveal(document.querySelector("#gacha-done"));
  }

  /* ---------- 09 拨时钟：时针拖到哪都行，一松手就自己弹回凌晨 5:03 ---------- */
  const clock = document.querySelector("#clock");
  const handH = document.querySelector("#hand-h");
  const handM = document.querySelector("#hand-m");
  const clockMsg = document.querySelector("#clock-msg");
  const HOME = (5 + 3 / 60) * 30; // 5:03 时针的角度
  const clockLines = ["指针：不，我要回 5:03 🙃", "检测到熬夜惯性，拨不动 🙈", "好吧，flag 完成度：不予置评 😌"];
  let hourAngle = HOME;
  let dragAngle = null;
  let clockTries = 0;
  let springId = 0;

  const ticks = document.querySelector("#clock-ticks");
  if (ticks) ticks.innerHTML = Array.from({length: 12}, (_, i) => `<line class="clock__tick" y1="-87" y2="${i % 3 ? -81 : -77}" transform="rotate(${i * 30})"/>`).join("");

  function setHands(angle) {
    handH?.setAttribute("transform", `rotate(${angle})`);
    handM?.setAttribute("transform", `rotate(${angle * 12})`);
  }
  setHands(HOME);

  function pointerAngle(event) {
    const [cx, cy] = centerOf(clock);
    return (Math.atan2(event.clientX - cx, cy - event.clientY) * 180) / Math.PI;
  }

  function timeAt(angle) {
    const hours = ((((angle % 360) + 360) % 360) / 30);
    const h = Math.floor(hours);
    return `${h || 12}:${String(Math.floor((hours - h) * 60)).padStart(2, "0")}`;
  }

  clock?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    try { clock.setPointerCapture(event.pointerId); } catch { /* 部分浏览器不支持 */ }
    springId += 1;
    dragAngle = pointerAngle(event);
    clock.classList.add("is-dragging");
  });

  clock?.addEventListener("pointermove", (event) => {
    if (dragAngle === null) return;
    const angle = pointerAngle(event);
    hourAngle += ((angle - dragAngle + 540) % 360) - 180;
    dragAngle = angle;
    setHands(hourAngle);
    if (clockMsg) clockMsg.textContent = `🕑 ${timeAt(hourAngle)}`;
  });

  function releaseClock() {
    if (dragAngle === null) return;
    dragAngle = null;
    clock.classList.remove("is-dragging");
    if (clockMsg) clockMsg.textContent = clockLines[Math.min(clockTries, clockLines.length - 1)];
    clockTries += 1;
    // 弹回 5:03：时针回半圈以内，分针跟着嗖嗖转好几圈
    const from = hourAngle;
    const to = HOME + Math.round((from - HOME) / 360) * 360;
    const id = (springId += 1);
    const start = performance.now();
    const ms = reduceMotion ? 0 : 1100;
    const step = (now) => {
      if (id !== springId) return;
      const t = ms ? Math.min(1, (now - start) / ms) : 1;
      const k = 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2; // 回弹时冲过头一点
      hourAngle = from + (to - from) * k;
      setHands(hourAngle);
      if (t < 1) nextTick(step);
    };
    nextTick(step);
  }
  ["pointerup", "pointercancel"].forEach((type) => clock?.addEventListener(type, releaseClock));

  /* ---------- 10 戳泡泡 ---------- */
  const bubbles = [...document.querySelectorAll("#bubbles .pop")];
  const popCount = document.querySelector("#pop-count");
  const bubblesDone = document.querySelector("#bubbles-done");
  let popped = 0;

  bubbles.forEach((bubble) => {
    bubble.addEventListener("click", () => {
      if (bubble.classList.contains("is-popped") || bubble.classList.contains("is-swelling")) return;
      popped += 1;
      const left = bubbles.length - popped;
      bubble.classList.add("is-swelling");
      window.setTimeout(() => {
        const box = bubble.getBoundingClientRect();
        if (!reduceMotion) explode(box.left + box.width / 2, box.top + box.height / 2, !left);
        const original = bubble.innerHTML.replace(/<br>/g, "");
        bubble.classList.remove("is-swelling");
        bubble.classList.add("is-popped");
        bubble.innerHTML = `<small>${original}</small>${bubble.dataset.reply}`;
        bubble.setAttribute("aria-disabled", "true");
        if (popCount) popCount.textContent = left ? `还剩 ${left} 个` : "";
        if (!left) {
          if (bubblesDone) bubblesDone.hidden = false;
          confetti(80);
          window.setTimeout(() => bubblesDone?.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "center"}), 500);
        }
      }, reduceMotion ? 0 : 130);
    });
  });

  /* ---------- 11 应援棒：点亮后关灯，整屏变成一片蓝色灯海 ---------- */
  const concertSlide = document.querySelector(".slide--concert");
  const glowSea = document.querySelector("#glow-sea");

  document.querySelector("#glow")?.addEventListener("click", (event) => {
    event.currentTarget.hidden = true;
    if (glowSea && !glowSea.childElementCount) {
      let html = "";
      for (let i = 0; i < 48; i += 1) {
        const row = i % 4; // 第 0 排离得最近，越往后越小越暗
        html += `<i style="left:${(Math.random() * 100).toFixed(1)}%;bottom:${(row * 8 + Math.random() * 4).toFixed(1)}%;--s:${(1 - row * 0.18).toFixed(2)};animation-delay:${(row * 0.12 + Math.random() * 0.15).toFixed(2)}s"></i>`;
      }
      glowSea.innerHTML = html;
    }
    concertSlide?.classList.add("is-lit");
    try { navigator.vibrate?.(20); } catch { /* 有的浏览器不让震 */ }
    typeReply(document.querySelector('[data-slide="concert"] [data-type]'), 1000);
    reveal(document.querySelector("#glow-text"));
  });

  /* ---------- 13 人格鉴定书：按一下盖章 ---------- */
  document.querySelector("#stamp")?.addEventListener("click", (event) => {
    event.currentTarget.hidden = true;
    const seal = document.querySelector("#seal");
    seal?.classList.add("is-stamped");
    window.setTimeout(() => {
      if (seal && !reduceMotion) explode(...centerOf(seal), false, "盖章！");
      confetti(70);
      reveal(document.querySelector("#cert-next"), "center");
    }, reduceMotion ? 0 : 330);
  });

  /* ---------- 14 蛋糕仪式：关灯唱歌 → 写愿望 → 长按吹 → 副歌响起开灯 → 切蛋糕 ---------- */
  const cakeSlide = document.querySelector(".slide--cake");
  const stage = document.querySelector("#cake-stage");
  const note = document.querySelector("#note");
  const wishText = document.querySelector("#wish-text");
  const wishStar = document.querySelector("#wish-star");
  const blowButton = document.querySelector("#blow-hold");
  const cakeWrap = document.querySelector("#cake-wrap");
  const cake = document.querySelector("#cake");
  const lyrics = document.querySelector("#lyrics");
  const lyricLines = ["祝你生日快乐 🎵", "祝你生日快乐 🎵", "祝星星er生日快乐 🎂", "祝你生日快乐 🎉"];
  let lyricTimer = 0;

  function setStep(step) {
    if (stage) stage.dataset.step = step;
  }

  function startLyrics() {
    let i = 0;
    const nextLyric = () => {
      if (!lyrics) return;
      lyrics.textContent = lyricLines[i % lyricLines.length];
      lyrics.classList.remove("is-swap");
      void lyrics.offsetWidth;
      lyrics.classList.add("is-swap");
      i += 1;
    };
    nextLyric();
    lyricTimer = window.setInterval(nextLyric, 2600);
  }

  const stopLyrics = () => window.clearInterval(lyricTimer);
  song.addEventListener("ended", stopLyrics);

  // 生日歌必须在这次点击里开始放，iPhone 才不会拦
  document.querySelector("#lights-off")?.addEventListener("click", () => {
    cakeSlide?.classList.add("is-dark");
    switchTo(song);
    startLyrics();
    setStep("note");
  });

  async function toBlowStep(withStar) {
    if (withStar) {
      note?.classList.add("is-folding");
      await wait(850);
      note?.classList.remove("is-folding");
      if (wishText) wishText.value = "";
      wishStar?.classList.add("is-in");
    }
    setStep("blow");
  }

  document.querySelector("#fold-note")?.addEventListener("click", () => toBlowStep(Boolean(wishText?.value.trim())));
  document.querySelector("#skip-note")?.addEventListener("click", () => {
    if (wishText) wishText.value = "";
    toBlowStep(false);
  });

  // 长按吹气：按住时火苗慢慢变小，松手会慢慢恢复，累计约 1.8 秒吹灭
  const BLOW_MS = 1800;
  let blow = 0;
  let holding = false;
  let blownOut = false;
  let lastFrame = 0;
  let looping = false;

  function blowFrame(now) {
    const dt = now - lastFrame;
    lastFrame = now;
    blow = holding ? Math.min(1, blow + dt / BLOW_MS) : Math.max(0, blow - dt / (BLOW_MS * 1.5));
    stage?.style.setProperty("--blow", blow.toFixed(3));
    blowButton?.style.setProperty("--blow", blow.toFixed(3));
    if (blow >= 1) { looping = false; return candlesOut(); }
    if (holding || blow > 0) nextTick(blowFrame);
    else looping = false;
  }

  function startBlow(event) {
    if (blownOut) return;
    event.preventDefault();
    try { blowButton?.setPointerCapture(event.pointerId); } catch { /* 部分浏览器不支持 */ }
    holding = true;
    stage?.classList.add("is-blowing");
    if (!looping) {
      looping = true;
      lastFrame = performance.now();
      nextTick(blowFrame);
    }
  }

  function stopBlow() {
    holding = false;
    stage?.classList.remove("is-blowing");
  }

  blowButton?.addEventListener("pointerdown", startBlow);
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => blowButton?.addEventListener(type, stopBlow));
  blowButton?.addEventListener("contextmenu", (event) => event.preventDefault());

  function candlesOut() {
    if (blownOut) return;
    blownOut = true;
    holding = false;
    stopLyrics();
    stage?.classList.remove("is-blowing");
    stage?.classList.add("is-out");
    // 从副歌前那段安静处接回 Someone to Love，等副歌第一拍响起的那一刻开灯
    const lead = reduceMotion ? 0 : 0.9;
    switchTo(bgm, CHORUS_AT - lead);
    const startedAt = performance.now();
    const waitForChorus = (now) => {
      const playing = !bgm.paused;
      if ((playing && bgm.currentTime >= CHORUS_AT - 0.05) || now - startedAt >= (playing ? 2000 : lead * 1000)) lightsOn();
      else nextTick(waitForChorus);
    };
    nextTick(waitForChorus);
  }

  function lightsOn() {
    cakeSlide?.classList.remove("is-dark");
    setStep("lit");
    confetti(110);
  }

  // 切蛋糕：在蛋糕上竖着划一下，或者点“帮我切”
  let cutStartY = null;
  function cutCake() {
    if (!cake || !cakeWrap || stage?.dataset.step !== "lit") return;
    cakeWrap.classList.add("is-cutting");
    window.setTimeout(() => {
      const left = cake.cloneNode(true);
      const right = cake.cloneNode(true);
      [left, right].forEach((half) => {
        half.removeAttribute("id");
        half.querySelector("#wish-star")?.removeAttribute("id");
      });
      left.classList.add("cake--half", "cake--left");
      right.classList.add("cake--half", "cake--right");
      cake.hidden = true;
      cakeWrap.append(left, right);
      setStep("cut");
      window.setTimeout(() => cakeWrap.classList.add("is-cut"), 40);
      confetti(50);
    }, reduceMotion ? 0 : 420);
  }

  cakeWrap?.addEventListener("pointerdown", (event) => { cutStartY = event.clientY; });
  cakeWrap?.addEventListener("pointermove", (event) => {
    if (cutStartY !== null && event.clientY - cutStartY > 50) {
      cutStartY = null;
      cutCake();
    }
  });
  cakeWrap?.addEventListener("pointerup", () => { cutStartY = null; });
  document.querySelector("#cut-button")?.addEventListener("click", cutCake);

  /* ---------- 15 结尾 ---------- */
  enterHooks.final = () => window.setTimeout(() => confetti(90), 400);

  /* ---------- 16 片尾字幕：慢慢往上滚（按住屏幕快进），停在最后两句，再出卡片按钮 ---------- */
  const creditsSlide = document.querySelector(".slide--credits");
  const creditsRoll = document.querySelector("#credits-roll");
  const creditsActions = document.querySelector("#credits-actions");
  const creditsSkip = document.querySelector("#credits-skip");
  let rollId = 0;
  let rollTarget = 0;
  let rollBoost = false;

  function endCredits() {
    rollId += 1;
    if (creditsRoll) creditsRoll.style.transform = `translateY(${rollTarget}px)`;
    if (creditsSkip) creditsSkip.hidden = true;
    if (creditsActions?.hidden) {
      creditsActions.hidden = false;
      confetti(60);
    }
  }

  enterHooks.credits = (slide) => {
    if (!creditsRoll) return;
    const id = (rollId += 1);
    const end = creditsRoll.querySelector(".credits__end");
    rollTarget = Math.min(0, slide.clientHeight * 0.26 - (end?.offsetTop || 0));
    if (creditsActions) creditsActions.hidden = true;
    if (creditsSkip) creditsSkip.hidden = false;
    if (reduceMotion) return endCredits();
    let y = slide.clientHeight;
    let last = performance.now();
    creditsRoll.style.transform = `translateY(${y}px)`;
    const step = (now) => {
      if (id !== rollId || slides[current] !== slide) return;
      y -= ((now - last) / 1000) * (rollBoost ? 320 : 58);
      last = now;
      if (y <= rollTarget) return endCredits();
      creditsRoll.style.transform = `translateY(${y}px)`;
      nextTick(step);
    };
    nextTick(step);
  };

  creditsSlide?.addEventListener("pointerdown", (event) => { if (!event.target.closest("button")) rollBoost = true; });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => creditsSlide?.addEventListener(type, () => { rollBoost = false; }));
  creditsSkip?.addEventListener("click", endCredits);
  document.querySelector("#replay")?.addEventListener("click", () => show(1));

  const FONT = '"PingFang SC","HarmonyOS Sans SC","MiSans","Microsoft YaHei","Noto Sans SC",sans-serif';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function card(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "#e3d9ff";
    roundRect(ctx, x, y + 10, w, h, 34);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.92)";
    roundRect(ctx, x, y, w, h, 34);
    ctx.fill();
    ctx.restore();
  }

  function text(ctx, value, x, y, size, color, weight = 800, align = "left") {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function drawReportCard() {
    const W = 1080;
    const H = 1860;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "alphabetic";

    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, "#fde7f3");
    bg.addColorStop(0.48, "#e9e4ff");
    bg.addColorStop(1, "#dcefff");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    for (let y = 30; y < H; y += 56) for (let x = 30; x < W; x += 56) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#fff";
    for (let x = 15; x < W + 30; x += 30) { ctx.beginPath(); ctx.arc(x, 0, 15, 0, Math.PI); ctx.fill(); }

    text(ctx, "2026 · BIRTHDAY EDITION", W / 2, 150, 30, "#9b7bff", 800, "center");
    text(ctx, "星星er", W / 2, 300, 130, "#6b4fbf", 900, "center");
    const pill = ctx.createLinearGradient(290, 0, 790, 0);
    pill.addColorStop(0, "#ff5fa2");
    pill.addColorStop(1, "#9b7bff");
    ctx.fillStyle = pill;
    roundRect(ctx, 290, 340, 500, 84, 42);
    ctx.fill();
    text(ctx, "朋友圈年度报告", W / 2, 398, 48, "#fff", 900, "center");
    text(ctx, "凌晨营业 · 布蕾成瘾 · 非酋转欧 · 翔霖站岗", W / 2, 490, 36, "#ff5fa2", 800, "center");

    const cells = [
      ["年度数字", "2778", "好运 ×2778 发放中"],
      ["年度口头禅", "好舒服呀", "出现 12+ 次"],
      ["年度饮品", "布蕾珍珠", "惊为天人 🧋"],
      ["年度游戏", "第五人格", "300 万项链 · 已出"],
    ];
    cells.forEach(([label, value, note], i) => {
      const x = 70 + (i % 2) * 485;
      const y = 540 + Math.floor(i / 2) * 330;
      card(ctx, x, y, 455, 300);
      text(ctx, label, x + 40, y + 70, 32, "#9b7bff");
      if (value === "2778") {
        ctx.font = `900 120px ${FONT}`;
        ctx.textAlign = "left";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#ffb3d4";
        ctx.strokeText(value, x + 46, y + 196);
        ctx.fillStyle = "#6b4fbf";
        ctx.fillText(value, x + 40, y + 190);
      } else {
        text(ctx, value, x + 40, y + 180, 76, "#6b4fbf", 900);
      }
      text(ctx, note, x + 40, y + 250, 30, "#ff5fa2", 700);
    });

    // 发圈日历：和第 3 页同一份数据，一行一个月
    card(ctx, 70, 1210, 940, 320);
    text(ctx, "发圈日历", 110, 1272, 32, "#9b7bff");
    text(ctx, "586 条 · 181 / 187 天", 970, 1272, 30, "#ff5fa2", 800, "right");
    const heat = ["#efe9f8", "#ffe3f0", "#ffc2dc", "#ff8fc0", "#ff5fa2"];
    const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
    for (let m = 4; m <= 10; m += 1) {
      const rowY = 1300 + (m - 4) * 30;
      text(ctx, `${m}月`, 110, rowY + 21, 20, "#6f6390", 700);
      for (let d = 1; d <= 31; d += 1) {
        const date = new Date(2026, m - 1, d);
        const index = Math.round((date - CAL_START) / 86400000);
        if (date.getMonth() !== m - 1 || index < 0 || index >= DAILY.length) continue;
        ctx.fillStyle = DAILY[index] === 10 ? "#9b7bff" : heat[level(DAILY[index])];
        roundRect(ctx, 166 + (d - 1) * 26, rowY, 22, 22, 5);
        ctx.fill();
      }
    }

    text(ctx, "「爱吃薯条的女孩，运气不会太差。」", W / 2, 1620, 50, "#6b4fbf", 900, "center");
    text(ctx, "🎂 10.25 · 生日快乐", W / 2, 1715, 56, "#ff5fa2", 900, "center");
    text(ctx, "数据整理：凯凯（和他的 7 个马甲）", W / 2, 1790, 28, "#6f6390", 500, "center");

    return canvas.toDataURL("image/png");
  }

  const modal = document.querySelector("#card-modal");
  const cardImg = document.querySelector("#card-img");
  const cardDownload = document.querySelector("#card-download");
  let cardUrl = "";

  document.querySelector("#make-card")?.addEventListener("click", () => {
    if (!cardUrl) cardUrl = drawReportCard();
    if (cardImg) cardImg.src = cardUrl;
    if (cardDownload) cardDownload.href = cardUrl;
    if (modal) modal.hidden = false;
  });
  document.querySelector("#card-close")?.addEventListener("click", () => { if (modal) modal.hidden = true; });
  modal?.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });

  /* 预览用：链接末尾加 #s5 直接跳到第 5 页 */
  const jump = location.hash.match(/^#s(\d+)$/);
  if (jump) {
    finishTyping();
    show(Number(jump[1]));
  } else {
    typeIntro();
  }
})();
