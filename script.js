document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const breathingCircle = document.getElementById('breathing-circle');
    const instructionDisplay = document.getElementById('instruction');
    const timerDisplay = document.getElementById('timer');
    const roundCounterDisplay = document.getElementById('round-counter');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const voiceSelect = document.getElementById('voice-select');
    const soundSelect = document.getElementById('sound-select');


    // Audio Elements
    const audioElements = {
        rain: document.getElementById('rain-sound'),
        forest: document.getElementById('forest-sound'),
    };

    // Configuration Inputs
    const configInputs = {
        inhale: document.getElementById('inhale-duration'),
        hold1: document.getElementById('hold1-duration'),
        exhale: document.getElementById('exhale-duration'),
        hold2: document.getElementById('hold2-duration'),
        rounds: document.getElementById('rounds'),
    };

    // Constants
    const PHASES = {
        INHALE: 'Inhale',
        HOLD: 'Hold',
        EXHALE: 'Exhale',
        GET_READY: 'Get Ready',
    };
    const MESSAGES = {
        SESSION_STOPPED: 'Session Stopped',
        MEDITATION_COMPLETE: 'Meditation Complete!',
        PRESS_START: 'Press Start to Begin'
    };

    // LocalStorage Key
    const SETTINGS_KEY = 'meditationTimerSettings';

    // State
    let isRunning = false;
    let currentRound = 0;
    let totalRounds = 0;
    let sessionTimeoutId = null;
    let countdownInterval = null;
    let voices = [];
    let currentAudio = null;
    let wakeLock = null;
    const wakeLockVideo = document.getElementById('wake-lock-video');

    // Web Speech API for audio prompts
    const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;

    // Translations for prompts
    const translations = {
        'en': { [PHASES.INHALE]: 'Inhale', [PHASES.HOLD]: 'Hold', [PHASES.EXHALE]: 'Exhale', [PHASES.GET_READY]: 'Get Ready', [MESSAGES.SESSION_STOPPED]: 'Session stopped.', [MESSAGES.MEDITATION_COMPLETE]: 'Meditation complete.', [MESSAGES.PRESS_START]: 'Press Start to Begin' },
        'ta': { [PHASES.INHALE]: 'மூச்சை உள்ளிழு', [PHASES.HOLD]: 'நிறுத்து', [PHASES.EXHALE]: 'மூச்சை வெளியிடு', [PHASES.GET_READY]: 'தயாராகுங்கள்', [MESSAGES.SESSION_STOPPED]: 'அமர்வு நிறுத்தப்பட்டது', [MESSAGES.MEDITATION_COMPLETE]: 'தியானம் முடிந்தது', [MESSAGES.PRESS_START]: 'தொடங்க ஸ்டார்ட் அழுத்தவும்' }
    };

    function populateVoiceList() {
        voices = synth.getVoices();
        const currentSelection = voiceSelect.value;
        voiceSelect.innerHTML = '';

        voices
            .filter(voice => voice.lang.startsWith('en') || voice.lang.startsWith('ta'))
            .forEach(voice => {
                const option = document.createElement('option');
                option.textContent = `${voice.name} (${voice.lang})`;
                option.setAttribute('data-lang', voice.lang);
                option.setAttribute('data-name', voice.name);
                voiceSelect.appendChild(option);
            });
        loadSettings(); // Load settings after voices are populated
        updateStaticText();
    }

    function getSelectedLanguage() {
        const selectedOption = voiceSelect.selectedOptions[0];
        if (!selectedOption) return 'en'; // Default to English
        return selectedOption.getAttribute('data-lang').substring(0, 2);
    }

    function getTranslatedText(textKey) {
        const lang = getSelectedLanguage();
        return (translations[lang] && translations[lang][textKey]) ? translations[lang][textKey] : textKey;
    }

    function speak(textKey) {
        if (!synth) return; // Speech synthesis not supported
        // Cancel any ongoing speech to ensure prompts don't overlap
        if (synth.speaking) {
            synth.cancel();
        }
        const selectedOption = voiceSelect.selectedOptions[0];
        const textToSpeak = getTranslatedText(textKey);

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        const selectedVoice = voices.find(voice => voice.name === selectedOption?.getAttribute('data-name'));
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        synth.speak(utterance);
    }
    
    // Awaitable delay helper using a Promise
    function delay(ms) {
        return new Promise(resolve => {
            // Clear previous timeout if stop is called
            clearTimeout(sessionTimeoutId);
            sessionTimeoutId = setTimeout(resolve, ms);
        });
    }

    function updateCountdown(duration) {
        clearInterval(countdownInterval); // Ensure no multiple intervals are running

        let timeLeft = duration;
        timerDisplay.textContent = `${timeLeft}s`;

        if (timeLeft <= 0) return;

        countdownInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = `${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);
    }

    async function runPhase(nameKey, duration) {
        instructionDisplay.textContent = getTranslatedText(nameKey);
        speak(nameKey);
        updateCountdown(duration);

        // Animation control
        if (nameKey === PHASES.INHALE) {
            breathingCircle.style.transitionDuration = `${duration}s`;
            breathingCircle.classList.add('grow');
        } else if (nameKey === PHASES.EXHALE) {
            breathingCircle.style.transitionDuration = `${duration}s`;
            breathingCircle.classList.remove('grow');
        }

        await delay(duration * 1000);
    }

    async function runMeditationCycle() {
        const durations = {
            inhale: parseInt(configInputs.inhale.value, 10),
            hold1: parseInt(configInputs.hold1.value, 10),
            exhale: parseInt(configInputs.exhale.value, 10),
            hold2: parseInt(configInputs.hold2.value, 10),
        };

        const cyclePhases = [
            { name: PHASES.INHALE, duration: durations.inhale },
            { name: PHASES.HOLD, duration: durations.hold1 },
            { name: PHASES.EXHALE, duration: durations.exhale },
            { name: PHASES.HOLD, duration: durations.hold2 },
        ];

        // "Get Ready" phase before starting
        await runPhase(PHASES.GET_READY, 3);
        if (!isRunning) return; // Stop if user cancelled during "Get Ready"

        while (isRunning && currentRound <= totalRounds) {
            roundCounterDisplay.textContent = `Round ${currentRound} of ${totalRounds}`;

            for (const phase of cyclePhases) {
                if (!isRunning) break;
                if (phase.duration > 0) await runPhase(phase.name, phase.duration);
            }

            if (isRunning) { // Only increment if the round completed without being stopped
                currentRound++;
            }
        }

        // If the loop finished naturally (wasn't stopped by the user)
        if (isRunning) {
            finishMeditation();
        }
    }

    async function startMeditation() {
        if (isRunning) return;

        if (!synth) {
            alert("Sorry, your browser does not support text-to-speech. The visual guide will still work.");
            voiceSelect.disabled = true;
        }

        isRunning = true;

        totalRounds = parseInt(configInputs.rounds.value, 10);
        currentRound = 1;

        saveSettings();

        await requestWakeLock();

        // UI updates for running state
        startBtn.disabled = true;
        stopBtn.disabled = false;
        Object.values(configInputs).forEach(input => input.disabled = true);
        voiceSelect.disabled = true;
        soundSelect.disabled = true;

        // Start background sound
        const selectedSound = soundSelect.value;
        if (selectedSound !== 'none') {
            currentAudio = audioElements[selectedSound];
            if (currentAudio) {
                currentAudio.loop = true;
                // play() returns a promise, which we should handle
                currentAudio.play().catch(e => console.error("Audio play failed:", e));
            }
        }
        
        runMeditationCycle();
    }

    function resetUI(messageKey) {
        instructionDisplay.textContent = getTranslatedText(messageKey);
        timerDisplay.textContent = '0s';
        roundCounterDisplay.textContent = '';
        startBtn.disabled = false;
        stopBtn.disabled = true;
        Object.values(configInputs).forEach(input => input.disabled = false);
        // Re-enable voice select only if supported
        voiceSelect.disabled = false;
        soundSelect.disabled = false;
        speak(messageKey);

        releaseWakeLock();

        // Stop background sound
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }

        // Reset animation
        breathingCircle.classList.remove('grow');
        breathingCircle.style.transitionDuration = '0.5s';
    }

    function updateStaticText() {
        if (isRunning) return;
        instructionDisplay.textContent = getTranslatedText(MESSAGES.PRESS_START);
    }

    function stopMeditation() {
        if (!isRunning) return;
        isRunning = false;
        clearTimeout(sessionTimeoutId);
        clearInterval(countdownInterval);
        countdownInterval = null;
        if (synth) {
            synth.cancel(); // Immediately stop any active speech
        }
        resetUI(MESSAGES.SESSION_STOPPED);
    }

    function finishMeditation() {
        isRunning = false; // Set to false as the session is over
        resetUI(MESSAGES.MEDITATION_COMPLETE);
    }

    // --- Wake Lock ---
    async function requestWakeLock() {
        // Use Screen Wake Lock API if supported
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => {
                    // This can happen if the user switches tabs, etc.
                    console.log('Screen Wake Lock was released');
                });
                console.log('Screen Wake Lock is active.');
            } catch (err) {
                console.error(`Wake Lock request failed: ${err.name}, ${err.message}`);
                // Fallback to video method if Wake Lock fails
                wakeLockVideo.play().catch(e => console.error("Wake Lock video fallback failed:", e));
            }
        } else {
            // Fallback for older browsers: play a silent video
            wakeLockVideo.play().catch(e => console.error("Wake Lock video fallback failed:", e));
        }
    }

    function releaseWakeLock() {
        wakeLock?.release().then(() => wakeLock = null);
        wakeLockVideo.pause();
    }

    function saveSettings() {
        const settings = {
            inhale: configInputs.inhale.value,
            hold1: configInputs.hold1.value,
            exhale: configInputs.exhale.value,
            hold2: configInputs.hold2.value,
            rounds: configInputs.rounds.value,
            voice: voiceSelect.value,
            sound: soundSelect.value,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            configInputs.inhale.value = settings.inhale || '6';
            configInputs.hold1.value = settings.hold1 || '6';
            configInputs.exhale.value = settings.exhale || '8';
            configInputs.hold2.value = settings.hold2 || '4';
            configInputs.rounds.value = settings.rounds || '10';
            soundSelect.value = settings.sound || 'none';

            // Wait for voices to be populated before setting the voice
            const voiceInterval = setInterval(() => {
                if (voiceSelect.options.length > 0) {
                    voiceSelect.value = settings.voice;
                    // If the saved voice is no longer available, it will default to the first option
                    clearInterval(voiceInterval);
                }
            }, 100);
        }
    }

    function initialize() {
        // Load settings first, then populate voices which might override voice selection
        loadSettings();
        populateVoiceList();
        if (synth && speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
        // Add event listeners to save settings on change
        Object.values(configInputs).forEach(input => input.addEventListener('change', saveSettings));
        soundSelect.addEventListener('change', saveSettings);
        voiceSelect.addEventListener('change', () => {
            saveSettings();
            updateStaticText();
        });
    }

    // Event Listeners
    startBtn.addEventListener('click', startMeditation);
    stopBtn.addEventListener('click', stopMeditation);

    initialize();
});