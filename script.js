(function () {
  // -------- DOM elements ----------
  const $ = (sel) => document.querySelector(sel);
  const wordInput = $('#wordInput');
  const form = $('#searchForm');
  const resultContainer = $('#resultContainer');
  const themeToggleBtn = $('#themeToggleBtn');
  const themeIcon = $('#themeIcon');

  const STORAGE_KEY = 'lexicon_recent_words';
  const THEME_STORAGE_KEY = 'lexicon_theme';
  let recentWords = [];

  // -------- Theme toggle logic dark/light ui  --------
  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
      themeIcon.className = 'fas fa-sun';
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      themeIcon.className = 'fas fa-moon';
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  };

  const toggleTheme = () => {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      applyTheme('light');
    } else {
      applyTheme('dark');
    }
  };

  const loadSavedTheme = () => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
      applyTheme('dark');
    } else if (savedTheme === 'light') {
      applyTheme('light');
    } else {
      applyTheme('light');
    }
  };

  // -------- Recent words logic ----------
  const loadRecent = () => {
    try {
      recentWords = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      recentWords = [];
    }
    recentWords = [
      ...new Map(recentWords.map((w) => [w.toLowerCase(), w])).values(),
    ].slice(0, 8);
  };
  const saveRecent = () =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentWords));
  const addRecent = (word) => {
    if (!word) return;
    const norm = word.trim().toLowerCase();
    recentWords = recentWords.filter((w) => w.toLowerCase() !== norm);
    recentWords.unshift(word.trim());
    recentWords = recentWords.slice(0, 8);
    saveRecent();
    renderRecent();
  };
  const clearRecent = () => {
    recentWords = [];
    saveRecent();
    renderRecent();
    refreshContentPreserve();
  };

  // make recent badges show on top
  const renderRecent = () => {
    let panel = $('#recentWordsPanel');
    if (panel) panel.remove();
    if (!recentWords.length) return;
    const html = `
        <div id="recentWordsPanel" class="recent-section">
          <div class="recent-header">
            <div class="recent-title"><i class="fas fa-clock"></i> Recent searches</div>
            <button class="clear-recent" id="clearRecentBtn"><i class="fas fa-trash-alt"></i> Clear</button>
          </div>
          <div class="recent-badges">
            ${recentWords.map((w) => `<span class="recent-word" data-word="${escapeHtml(w)}"><i class="fas fa-history"></i> ${escapeHtml(w)}</span>`).join('')}
          </div>
        </div>
      `;
    resultContainer.insertAdjacentHTML('afterbegin', html);
    document.querySelectorAll('.recent-word').forEach((el) => {
      el.addEventListener('click', () => {
        wordInput.value = el.dataset.word;
        fetchWord(el.dataset.word);
      });
    });
    $('#clearRecentBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearRecent();
    });
  };

  const escapeHtml = (str) =>
    str
      ? str.replace(
          /[&<>]/g,
          (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m],
        )
      : '';

  // Show/hide states
  const showLoading = () => {
    resultContainer.innerHTML = `<div class="loading-container"><div class="spinner-circle"></div><div class="loading-text"><i class="fas fa-book"></i> Loading definitions...</div></div>`;
    renderRecent();
  };
  const showError = (msg) => {
    resultContainer.innerHTML = `<div class="fallback-message error-message"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(msg)}<br><span style="font-size:0.85rem;"><i class="fas fa-lightbulb"></i> Try another word like "happiness" or "brilliant".</span></div>`;
    renderRecent();
  };
  const showWelcome = () => {
    resultContainer.innerHTML = `<div class="fallback-message"><i class="fas fa-gem"></i> Enter a word above — definitions, pronunciation, synonyms and audio will appear here.</div>`;
    renderRecent();
  };
  const refreshContentPreserve = () => {
    if (
      resultContainer.children.length === 1 &&
      resultContainer.children[0]?.id !== 'recentWordsPanel'
    )
      renderRecent();
    else if (resultContainer.children.length > 0) renderRecent();
    else showWelcome();
  };

  // ---------- API data extractors ----------
  const getPhonetic = (data) =>
    data[0]?.phonetic || data[0]?.phonetics?.find((p) => p.text)?.text || null;
  const getAudio = (data) =>
    data[0]?.phonetics?.find((p) => p.audio)?.audio || null;
  const getSynonyms = (data) => {
    const syns =
      data[0]?.meanings?.flatMap((m) => [
        ...(m.synonyms || []),
        ...(m.definitions?.flatMap((d) => d.synonyms || []) || []),
      ]) || [];
    return [...new Set(syns.filter((s) => s && typeof s === 'string'))].slice(
      0,
      14,
    );
  };
  const getDefinitions = (data) => {
    const defs = [];
    data[0]?.meanings?.forEach((meaning) => {
      meaning.definitions?.forEach((def) => {
        if (def.definition?.trim())
          defs.push({
            part: meaning.partOfSpeech || 'unknown',
            definition: def.definition,
            example: def.example || null,
          });
      });
    });
    return defs.slice(0, 8);
  };

  // Audio player attachment
  const attachAudio = (btn, url) => {
    if (!url || !btn) return;
    const playHandler = () => {
      btn.innerHTML = `<i class="fas fa-spinner fa-pulse"></i> Playing...`;
      const audio = new Audio(url);
      audio.play().catch(() => {
        btn.innerHTML = `<i class="fas fa-volume-mute"></i> Error`;
        setTimeout(() => {
          if (btn) btn.innerHTML = `<i class="fas fa-play"></i> Play audio`;
        }, 1200);
      });
      audio.onended = () => {
        if (btn) btn.innerHTML = `<i class="fas fa-play"></i> Play audio`;
      };
    };
    btn.replaceWith(btn.cloneNode(true));
    const newBtn = resultContainer.querySelector('#playAudioBtn');
    if (newBtn) newBtn.addEventListener('click', playHandler);
  };

  // Render word results
  const renderWord = (data, searchedWord) => {
    if (!data || !data[0])
      return showError(`"${escapeHtml(searchedWord)}" not found.`);
    const word = data[0].word || searchedWord;
    const phonetic = getPhonetic(data);
    const audioUrl = getAudio(data);
    const synonyms = getSynonyms(data);
    const definitions = getDefinitions(data);
    if (!definitions.length)
      return showError(`No definitions for "${escapeHtml(word)}".`);

    let defHtml = definitions
      .map(
        (d) => `
        <div class="definition-card">
          <div class="part-of-speech"><i class="fas fa-tag"></i> ${escapeHtml(d.part)}</div>
          <div class="definition-text">${escapeHtml(d.definition)}</div>
          ${d.example ? `<div class="example-text"><i class="fas fa-quote-left"></i> “${escapeHtml(d.example)}”</div>` : ''}
        </div>
      `,
      )
      .join('');

    const synHtml = synonyms.length
      ? `<div class="definitions-title"><i class="fas fa-code-branch"></i> Synonyms</div>
         <div class="definition-card"><div class="synonyms-area">${synonyms.map((s) => `<span class="synonym-badge"><i class="fas fa-link"></i> ${escapeHtml(s)}</span>`).join('')}</div></div>`
      : `<div class="definitions-title"><i class="fas fa-code-branch"></i> Synonyms</div><div class="definition-card"><span style="color:#6f5b62;"><i class="fas fa-info-circle"></i> No synonyms found.</span></div>`;

    const pronHtml = phonetic
      ? `<div class="pronunciation-text"><i class="fas fa-microphone"></i> /${escapeHtml(phonetic)}/</div>`
      : `<div class="pronunciation-text" style="opacity:0.7;"><i class="fas fa-ear-deaf"></i> pronunciation not available</div>`;
    const audioBtnHtml = audioUrl
      ? `<button class="audio-btn" id="playAudioBtn"><i class="fas fa-play"></i> Play audio</button>`
      : `<button class="audio-btn" disabled style="opacity:0.6;"><i class="fas fa-volume-off"></i> No audio</button>`;

    resultContainer.innerHTML = `
        <div class="word-header">
          <div>
            <div class="word-title"><i class="fas fa-book"></i> ${escapeHtml(word)}</div>
            <div class="pronunciation-block">${pronHtml} ${audioBtnHtml}</div>
          </div>
        </div>
        <div class="definitions-title"><i class="fas fa-list-ul"></i> Definitions</div>
        ${defHtml}
        ${synHtml}
      `;
    renderRecent();
    if (audioUrl) {
      const audioButton = document.getElementById('playAudioBtn');
      if (audioButton) attachAudio(audioButton, audioUrl);
    }
  };

  // ---------- API fetch using async/await & error handling ----------
  const fetchWord = async (word) => {
    const rawWord = word?.trim();
    if (!rawWord) return showError('Please enter a word.');
    showLoading();
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(rawWord.toLowerCase())}`,
      );
      if (response.status === 404) throw new Error(`"${rawWord}" not found.`);
      if (!response.ok) throw new Error(`Server error (${response.status})`);
      const data = await response.json();
      if (!data || !data.length) throw new Error('No results.');
      addRecent(rawWord.toLowerCase());
      renderWord(data, rawWord);
    } catch (err) {
      showError(err.message || 'Network issue. Please try again.');
    }
  };

  // Event handling
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    fetchWord(wordInput.value);
  });

  // Theme toggle event
  themeToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleTheme();
  });

  // Initialize theme from localStorage
  loadSavedTheme();

  // Initialize recent and show welcome
  loadRecent();
  showWelcome();
})();
