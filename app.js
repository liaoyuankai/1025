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
  const bgm = new Audio("assets/bgm.m4a");
  bgm.loop = true;
  const song = new Audio("assets/happy-birthday.m4a");
  const CHORUS_AT = 96; // 1:36 副歌第一拍，前面约 1 秒几乎没声
  // iPhone 不让网页调音量（volume 永远是 1），所以两首歌已在文件里调成一样响，那边切歌直接停/放
  const canFade = (() => { const probe = new Audio(); probe.volume = 0.5; return probe.volume === 0.5; })();
  let track = bgm;
  let soundOn = false;
  let muted = false; // 她自己点了暂停

  function setSound(playing) {
    soundOn = playing;
    soundButton?.setAttribute("aria-pressed", String(playing));
    soundButton?.setAttribute("aria-label", playing ? "暂停音乐" : "播放音乐");
    if (soundLabel) soundLabel.textContent = playing ? "播放中" : "音乐";
  }

  async function play(audio) {
    try {
      await audio.play();
      setSound(true);
    } catch {
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
      track.pause();
      setSound(false);
    } else {
      play(track);
    }
  });
  bgm.addEventListener("error", () => { if (soundButton && track === bgm) soundButton.hidden = true; });
  song.addEventListener("ended", () => setSound(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && soundOn) { track.pause(); setSound(false); }
  });

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

  /* ---------- 03 小测验 ---------- */
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

  /* ---------- 04 好舒服呀计数 ---------- */
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

  /* ---------- 09 戳泡泡 ---------- */
  const bubbles = [...document.querySelectorAll("#bubbles .pop")];
  const popCount = document.querySelector("#pop-count");
  const bubblesDone = document.querySelector("#bubbles-done");
  let popped = 0;

  bubbles.forEach((bubble) => {
    bubble.addEventListener("click", () => {
      if (bubble.classList.contains("is-popped")) return;
      const original = bubble.innerHTML.replace(/<br>/g, "");
      bubble.classList.add("is-popped");
      bubble.innerHTML = `<small>${original}</small>${bubble.dataset.reply}`;
      bubble.setAttribute("aria-disabled", "true");
      popped += 1;
      const left = bubbles.length - popped;
      if (popCount) popCount.textContent = left ? `还剩 ${left} 个` : "";
      if (!left) {
        if (bubblesDone) bubblesDone.hidden = false;
        confetti(80);
        window.setTimeout(() => bubblesDone?.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "center"}), 300);
      }
    });
  });

  /* ---------- 12 蛋糕仪式：关灯唱歌 → 写愿望 → 长按吹 → 副歌响起开灯 → 切蛋糕 ---------- */
  const cakeSlide = document.querySelector(".slide--cake");
  const stage = document.querySelector("#cake-stage");
  const note = document.querySelector("#note");
  const wishText = document.querySelector("#wish-text");
  const wishStar = document.querySelector("#wish-star");
  const blowButton = document.querySelector("#blow-hold");
  const cakeWrap = document.querySelector("#cake-wrap");
  const cake = document.querySelector("#cake");
  const lyrics = document.querySelector("#lyrics");
  const lyricLines = ["祝你生日快乐 🎵", "祝你生日快乐 🎵", "祝可欣生日快乐 🎂", "祝你生日快乐 🎉"];
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

  /* ---------- 13 结尾 + 年度报告卡片 ---------- */
  enterHooks.final = () => window.setTimeout(() => confetti(90), 400);
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
    const H = 1760;
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
    text(ctx, "可欣", W / 2, 300, 130, "#6b4fbf", 900, "center");
    const pill = ctx.createLinearGradient(290, 0, 790, 0);
    pill.addColorStop(0, "#ff5fa2");
    pill.addColorStop(1, "#9b7bff");
    ctx.fillStyle = pill;
    roundRect(ctx, 290, 340, 500, 84, 42);
    ctx.fill();
    text(ctx, "朋友圈年度报告", W / 2, 398, 48, "#fff", 900, "center");

    const cells = [
      ["年度数字", "2778", "好运 ×2778 发放中"],
      ["年度口头禅", "好舒服呀", "出现 12+ 次"],
      ["年度饮品", "布蕾珍珠", "惊为天人 🧋"],
      ["年度游戏", "第五人格", "300 万项链 · 已出"],
    ];
    cells.forEach(([label, value, note], i) => {
      const x = 70 + (i % 2) * 485;
      const y = 480 + Math.floor(i / 2) * 330;
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

    card(ctx, 70, 1150, 940, 230);
    text(ctx, "年度现场", 110, 1220, 32, "#9b7bff");
    text(ctx, "广州 · 幸福的响铃是翔霖 🔔", 110, 1280, 44, "#4a3d6b", 800);
    text(ctx, "年度连续剧", 110, 1336, 28, "#9b7bff");
    text(ctx, "《寻找 iPhone 5s》📱", 300, 1336, 28, "#4a3d6b", 700);

    text(ctx, "「爱吃薯条的女孩，运气不会太差。」", W / 2, 1490, 50, "#6b4fbf", 900, "center");
    text(ctx, "🎂 10.25 · 生日快乐", W / 2, 1590, 56, "#ff5fa2", 900, "center");
    text(ctx, "数据整理：一位四年的忠实点赞用户", W / 2, 1670, 28, "#6f6390", 500, "center");

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
