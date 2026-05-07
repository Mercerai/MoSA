/* =========================================================
   Academic project page – interactive bits
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Mobile navbar burger ---------- */
  document.querySelectorAll('.navbar-burger').forEach(b => {
    b.addEventListener('click', () => {
      const target = document.getElementById(b.dataset.target);
      b.classList.toggle('is-active');
      if (target) target.classList.toggle('is-active');
    });
  });

  /* ---------- Carousels ---------- */
  let resultsInstance = null;
  let robotInstance = null;

  // Capture originals before attach — bulma-carousel clones items for infinite loop.
  const robotEl = document.getElementById('robotCarousel');
  const robotItems = robotEl
    ? Array.from(robotEl.querySelectorAll(':scope > .item'))
    : [];
  const resultsEl = document.getElementById('resultsCarousel');
  const qualVideos = resultsEl
    ? Array.from(resultsEl.querySelectorAll(':scope > .item video'))
    : [];

  if (typeof bulmaCarousel !== 'undefined') {
    const r = bulmaCarousel.attach('#resultsCarousel', {
      slidesToScroll: 1,
      slidesToShow: 1,
      loop: true,
      infinite: true,
      autoplay: false,
      pagination: false,
      navigation: true,
    });
    resultsInstance = r && r[0];

    const rob = bulmaCarousel.attach('#robotCarousel', {
      slidesToScroll: 1,
      slidesToShow: 1,
      loop: true,
      infinite: true,
      autoplay: false,
      pagination: false,
      navigation: true,
    });
    robotInstance = rob && rob[0];
  }

  /* ---------- Robot pair carousel: gate playback to active slide ---------- */

  const stopRobotVideo = (v) => {
    try { v.pause(); } catch (_) {}
    try { v.currentTime = 0; } catch (_) {}
  };

  const playRobotSlide = (idx) => {
    robotItems.forEach((item, i) => {
      const isActive = i === idx;
      item.classList.toggle('is-current', isActive);
      const videos = item.querySelectorAll('video');
      videos.forEach(v => {
        if (isActive) {
          try { v.currentTime = 0; } catch (_) {}
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          stopRobotVideo(v);
        }
      });
    });
  };

  const currentRobotIndex = () => {
    // bulma-carousel only updates state.index after the transition ends, so during
    // before:show/show/after:show events state.next holds the target slide.
    // In infinite mode, state.next can be out-of-range during wrap-around (e.g.
    // length 3, going next from index 2 sets next=3); normalize back into range.
    const s = robotInstance && robotInstance.state;
    if (!s) return 0;
    const len = s.length || 1;
    const raw = typeof s.next === 'number' ? s.next
              : typeof s.index === 'number' ? s.index
              : 0;
    return ((raw % len) + len) % len;
  };

  if (robotInstance && typeof robotInstance.on === 'function') {
    robotInstance.on('before:show', () => playRobotSlide(currentRobotIndex()));
    robotInstance.on('show', () => playRobotSlide(currentRobotIndex()));
    robotInstance.on('after:show', () => playRobotSlide(currentRobotIndex()));
  }

  // Initial: play slide 0, pause/reset everything else
  playRobotSlide(0);

  /* ---------- Qualitative shared-slider scrubbing ---------- */
  const sharedSlider = document.getElementById('qualSharedSlider');
  let activeQualVideo = qualVideos[0] || null;
  let pendingSeek = null;

  const updateSliderFill = () => {
    if (!sharedSlider) return;
    const min = parseFloat(sharedSlider.min) || 0;
    const max = parseFloat(sharedSlider.max) || 1;
    const val = parseFloat(sharedSlider.value) || 0;
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    sharedSlider.style.setProperty('--qual-progress', pct + '%');
  };

  const syncSliderMax = () => {
    if (!sharedSlider || !activeQualVideo) return;
    if (Number.isFinite(activeQualVideo.duration) && activeQualVideo.duration > 0) {
      sharedSlider.max = activeQualVideo.duration.toFixed(2);
      updateSliderFill();
    }
  };

  const seekActiveQual = (t) => {
    if (!activeQualVideo || !Number.isFinite(t)) return;
    const dur = Number.isFinite(activeQualVideo.duration) && activeQualVideo.duration > 0
      ? activeQualVideo.duration
      : t;
    const safeT = Math.max(0, Math.min(t, dur));
    try {
      activeQualVideo.currentTime = safeT;
      pendingSeek = null;
      return;
    } catch (_) {
      pendingSeek = safeT;
    }
  };

  // Per-video init: load, show first frame, hook duration so the slider can adapt
  // when the active video changes.
  qualVideos.forEach(video => {
    // Force the browser to start fetching the full file so seeking works
    // even on basic local servers without HTTP Range support.
    try { video.load(); } catch (_) {}

    let firstFrameShown = false;
    const showFirstFrame = () => {
      if (firstFrameShown) return;
      firstFrameShown = true;
      try { video.currentTime = 0.001; } catch (_) {}
    };
    video.addEventListener('loadeddata', showFirstFrame, { once: true });
    video.addEventListener('canplay', showFirstFrame, { once: true });

    const handleMetadata = () => {
      if (video === activeQualVideo) {
        syncSliderMax();
        if (pendingSeek !== null) {
          const t = pendingSeek;
          pendingSeek = null;
          seekActiveQual(t);
        }
      }
    };
    video.addEventListener('loadedmetadata', handleMetadata);
    video.addEventListener('durationchange', handleMetadata);
    video.addEventListener('canplay', () => {
      if (video === activeQualVideo && pendingSeek !== null) {
        const t = pendingSeek;
        pendingSeek = null;
        seekActiveQual(t);
      }
    });
  });

  if (sharedSlider) {
    sharedSlider.addEventListener('input', () => {
      seekActiveQual(parseFloat(sharedSlider.value));
      updateSliderFill();
    });
    sharedSlider.addEventListener('change', () => {
      seekActiveQual(parseFloat(sharedSlider.value));
      updateSliderFill();
    });

    updateSliderFill();
  }

  const setActiveQualVideo = (idx) => {
    // Pause non-active videos so only the slide the user is on is "live".
    qualVideos.forEach((v, i) => {
      if (i !== idx) {
        try { v.pause(); } catch (_) {}
      }
    });
    activeQualVideo = qualVideos[idx] || null;
    if (!activeQualVideo) return;
    try { activeQualVideo.currentTime = 0; } catch (_) {}
    if (sharedSlider) {
      sharedSlider.value = 0;
      syncSliderMax();
      updateSliderFill();
    }
  };

  const currentResultsIndex = () => {
    // Same wrap-around quirk as the robot carousel: in infinite mode state.next
    // can be out of range during before:show/show/after:show (length 7, next from
    // index 6 sets next=7 until transitionend normalizes it). Normalize here too.
    const s = resultsInstance && resultsInstance.state;
    if (!s) return 0;
    const len = s.length || 1;
    const raw = typeof s.next === 'number' ? s.next
              : typeof s.index === 'number' ? s.index
              : 0;
    return ((raw % len) + len) % len;
  };

  if (resultsInstance && typeof resultsInstance.on === 'function') {
    resultsInstance.on('before:show', () => setActiveQualVideo(currentResultsIndex()));
    resultsInstance.on('show', () => setActiveQualVideo(currentResultsIndex()));
    resultsInstance.on('after:show', () => setActiveQualVideo(currentResultsIndex()));
  }

  setActiveQualVideo(0);

  /* ---------- BibTeX copy button ---------- */
  const copyBtn = document.getElementById('copyBibBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = document.querySelector('pre.bibtex code');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.innerText.trim());
        const label = copyBtn.querySelector('span:last-child');
        const original = label.textContent;
        label.textContent = 'Copied!';
        setTimeout(() => { label.textContent = original; }, 1500);
      } catch (e) {
        console.error('Copy failed', e);
      }
    });
  }

  /* ---------- Pause off-screen videos to save CPU ----------
     Skip videos marked data-noautoplay (qualitative slider videos
     and robot carousel pairs, both managed manually). */
  const autoVideos = document.querySelectorAll('video:not([data-noautoplay])');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const v = entry.target;
        if (entry.isIntersecting) {
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.15 });
    autoVideos.forEach(v => io.observe(v));
  }

  /* ---------- Pause robot videos when the section leaves the viewport ---------- */
  if ('IntersectionObserver' in window && robotEl) {
    const robotIo = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Resume the active slide only.
          playRobotSlide(currentRobotIndex());
        } else {
          robotItems.forEach(item => {
            item.querySelectorAll('video').forEach(stopRobotVideo);
          });
        }
      });
    }, { threshold: 0.1 });
    robotIo.observe(robotEl);
  }
});
