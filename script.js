// script.js

const tg = window.Telegram.WebApp;

// --- DOM Elements ---
const fileInput = document.getElementById('file-input');
const fileInputLabel = document.getElementById('file-input-label');
const fileLoader = document.getElementById('file-loader');
const forwardedInfo = document.getElementById('forwarded-info');
const playerUI = document.getElementById('player-ui');
const audioPlayer = document.getElementById('audio-player');
const fileInfoDisplay = document.getElementById('file-info');
const playPauseButton = document.getElementById('play-pause-button');
const stopButton = document.getElementById('stop-button');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const currentTimeDisplay = document.getElementById('current-time');
const totalDurationDisplay = document.getElementById('total-duration');
const contentIndexSection = document.getElementById('content-index');
const tocList = document.getElementById('toc-list');
const tocPlaceholder = document.getElementById('toc-placeholder');

// --- State ---
let currentAudioBlobUrl = null; // To manage object URLs for local files
let currentAudioSourceUrl = null; // To store the URL provided by the backend

// --- Configuration ---
// !!! WICHTIG: Ersetze dies durch die URL deines Backend-Endpunkts !!!
const BACKEND_API_ENDPOINT = '/api/get-audio-url'; // Beispiel: Relativer Pfad, wenn Backend auf gleicher Domain läuft
// oder const BACKEND_API_ENDPOINT = 'https://dein-backend.example.com/api/get-audio-url';

// --- Initialization ---
function initializeApp() {
    if (!tg) {
        console.error("Telegram WebApp API not found!");
        document.body.innerHTML = '<p style="color: red; padding: 20px;">Error: Could not initialize Telegram WebApp. Please ensure you are running this inside Telegram.</p>';
        return;
    }
    console.log("Mini App Initializing...");
    tg.ready();
    tg.expand();

    applyThemeColors();

    // --- NEU: Prüfen auf Startparameter (file_id) ---
    let startFileId = null;
    if (tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
        try {
            const params = new URLSearchParams(tg.initDataUnsafe.start_param);
            startFileId = params.get('file_id');
        } catch (e) {
            console.error("Could not parse start_param:", tg.initDataUnsafe.start_param, e);
        }
    }
    // --- Ende NEU ---

    if (startFileId) {
        console.log("Found forwarded file_id:", startFileId);
        // UI für weitergeleitete Datei vorbereiten
        if(fileLoader) fileLoader.style.display = 'none';
        if(forwardedInfo) forwardedInfo.style.display = 'none'; // Keine extra Info nötig
        if(playerUI) playerUI.style.display = 'flex';
        if(fileInfoDisplay) fileInfoDisplay.textContent = `Loading forwarded audio...`;
        disableControls(); // Steuerung deaktivieren, bis URL da ist

        // --- NEU: URL vom Backend holen ---
        fetchAudioUrlFromBackend(startFileId);

    } else {
        // Normaler Modus: Manuelle Dateiauswahl erlauben
        console.log("No forwarded file info found, enabling manual load.");
        if(fileLoader) fileLoader.style.display = 'block';
        if(playerUI) playerUI.style.display = 'none'; // Player ausblenden
        if(forwardedInfo) forwardedInfo.style.display = 'none';
        resetPlayer(); // Sicherstellen, dass alles zurückgesetzt ist
    }

     // --- Event Listeners ---
     if(fileInput) fileInput.addEventListener('change', handleFileSelect);
     if(playPauseButton) playPauseButton.addEventListener('click', togglePlayPause);
     if(stopButton) stopButton.addEventListener('click', stopPlayback);
     if(seekSlider) seekSlider.addEventListener('input', handleSeek);
     if(volumeSlider) volumeSlider.addEventListener('input', handleVolume);
     if(audioPlayer) {
         audioPlayer.addEventListener('loadedmetadata', handleMetadataLoaded);
         audioPlayer.addEventListener('timeupdate', handleTimeUpdate);
         audioPlayer.addEventListener('ended', handlePlaybackEnded);
         audioPlayer.addEventListener('play', () => { if(playPauseButton) playPauseButton.textContent = '⏸️'; });
         audioPlayer.addEventListener('pause', () => { if(playPauseButton) playPauseButton.textContent = '▶️'; });
         audioPlayer.addEventListener('error', handleAudioError);
         // 'canplay' event might be useful to enable controls sooner
         audioPlayer.addEventListener('canplay', () => {
             console.log("Audio is ready to play (canplay event).");
             // Enable controls if metadata is already loaded (duration known)
             if (!isNaN(audioPlayer.duration) && isFinite(audioPlayer.duration)) {
                 enableControls();
             }
         });
     }

     console.log("Mini App Ready!");
}

function applyThemeColors() {
     const root = document.documentElement;
     if (tg.themeParams) {
         console.log("Applying theme colors:", tg.themeParams);
         root.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
         root.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
         root.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
         root.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
         root.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#aaaaaa');
         root.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#2481cc');
         root.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f4f4f4');
     } else {
         console.log("No theme params found, using defaults.");
     }
}

// --- NEUE Funktion: Holt die temporäre Audio-URL vom Backend ---
async function fetchAudioUrlFromBackend(fileId) {
    console.log(`Fetching audio URL for file_id: ${fileId}`);
    if(fileInfoDisplay) fileInfoDisplay.textContent = `Requesting audio URL...`;
    disableControls(); // Sicherstellen, dass Steuerung deaktiviert ist

    try {
        // Baue die vollständige URL zum Backend-Endpunkt
        const requestUrl = new URL(BACKEND_API_ENDPOINT, window.location.origin); // Nimmt Basis-URL der Mini App an
        requestUrl.searchParams.append('file_id', fileId);

        // Sende die Anfrage an dein Backend
        const response = await fetch(requestUrl.toString());

        if (!response.ok) {
            // Fehler vom Backend (z.B. 404, 500)
            const errorText = await response.text();
            console.error(`Backend error: ${response.status} - ${errorText}`);
            throw new Error(`Backend could not provide URL (Status: ${response.status})`);
        }

        const data = await response.json(); // Erwarte JSON-Antwort mit { "url": "..." }

        if (data && data.url) {
            console.log("Received temporary audio URL from backend:", data.url);
            loadAudioFromUrl(data.url); // Lade Audio mit der erhaltenen URL
        } else {
            console.error("Backend response did not contain a valid URL:", data);
            throw new Error("Invalid response from backend.");
        }

    } catch (error) {
        console.error("Error fetching audio URL from backend:", error);
        if(fileInfoDisplay) fileInfoDisplay.textContent = "Error loading forwarded audio.";
        tg.showAlert(`Could not load the forwarded audio: ${error.message}`);
        // Optional: UI zurücksetzen oder Fehlermeldung anzeigen
        resetPlayer();
         if(playerUI) playerUI.style.display = 'none'; // Player ausblenden
         if(fileLoader) fileLoader.style.display = 'block'; // Uploader wieder zeigen? Oder Fehlermeldung lassen.

    }
}


// --- File Handling (Manuelle Auswahl) ---
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        console.log("File selected:", file.name, file.type, file.size);
        if (file.type.startsWith('audio/')) {
            loadAudioFromFile(file); // Lokale Datei laden
            if(fileLoader) fileLoader.style.display = 'none';
            if(playerUI) playerUI.style.display = 'flex';
        } else {
            tg.showAlert('Please select a valid audio file (MP3, WAV, OGG, AAC, M4A).');
        }
    }
}

// Lädt Audio aus einer lokalen Datei (Blob URL)
function loadAudioFromFile(file) {
    cleanupAudioSources(); // Alte Quellen bereinigen
    resetPlayer();

    currentAudioBlobUrl = URL.createObjectURL(file);
    currentAudioSourceUrl = null; // Keine Backend-URL für diese Datei
    console.log("Created Object URL:", currentAudioBlobUrl);
    if(audioPlayer) audioPlayer.src = currentAudioBlobUrl;
    if(fileInfoDisplay) fileInfoDisplay.textContent = `File: ${file.name}`;
    disableControls(); // Warten auf Metadaten
}

// Lädt Audio von einer URL (vom Backend erhalten)
function loadAudioFromUrl(url) {
    cleanupAudioSources(); // Alte Quellen bereinigen
    resetPlayer();

    currentAudioSourceUrl = url; // Backend-URL speichern
    currentAudioBlobUrl = null;  // Keine Blob-URL
    console.log("Loading audio from URL:", url);
    if(audioPlayer) audioPlayer.src = url;
    if(fileInfoDisplay) fileInfoDisplay.textContent = `Loading forwarded audio...`; // Update Text
    disableControls(); // Warten auf Metadaten
}

// Bereinigt Blob-URLs und setzt Source zurück
function cleanupAudioSources() {
    if (currentAudioBlobUrl) {
        URL.revokeObjectURL(currentAudioBlobUrl);
        console.log("Revoked previous Object URL");
        currentAudioBlobUrl = null;
    }
    currentAudioSourceUrl = null;
    if (audioPlayer && audioPlayer.src) {
        audioPlayer.removeAttribute('src');
        audioPlayer.load(); // Wichtig, um alte Quelle komplett zu entfernen
    }
}


// --- Playback Controls ---
// (togglePlayPause, stopPlayback, handleSeek, handleVolume bleiben im Grunde gleich)
function togglePlayPause() {
    if (!audioPlayer || !audioPlayer.src || audioPlayer.readyState < 1) { // readyState 1 (HAVE_METADATA) reicht oft schon
        console.warn("Audio not ready to play or no source set.");
        return;
    }

    if (audioPlayer.paused || audioPlayer.ended) {
        audioPlayer.play().catch(handleAudioError);
    } else {
        audioPlayer.pause();
    }
}

function stopPlayback() {
    if (!audioPlayer) return;
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
}

function handleSeek() {
    if (!audioPlayer || isNaN(audioPlayer.duration) || !isFinite(audioPlayer.duration)) return;
     audioPlayer.currentTime = seekSlider.value;
}

 function handleVolume() {
    if (!audioPlayer) return;
    audioPlayer.volume = volumeSlider.value;
}

// --- Audio Player Event Handlers ---
// (handleMetadataLoaded, handleTimeUpdate, handlePlaybackEnded, handleAudioError bleiben im Grunde gleich)
// handleMetadataLoaded wird jetzt sowohl für Blob-URLs als auch für Backend-URLs getriggert.
function handleMetadataLoaded() {
    if (!audioPlayer) return;
    console.log("Metadata loaded. Duration:", audioPlayer.duration);
    if (!isNaN(audioPlayer.duration) && isFinite(audioPlayer.duration)) {
        if(seekSlider) {
            seekSlider.max = audioPlayer.duration;
            // seekSlider.disabled = false; // Wird in enableControls gemacht
        }
        if(totalDurationDisplay) totalDurationDisplay.textContent = formatTime(audioPlayer.duration);

        // Update file info if it was a forwarded file
        if (currentAudioSourceUrl && fileInfoDisplay && fileInfoDisplay.textContent.startsWith('Loading')) {
             fileInfoDisplay.textContent = `Forwarded Audio (${formatTime(audioPlayer.duration)})`;
        }

        enableControls(); // Steuerung aktivieren
        generateContentIndex(); // ToC versuchen zu generieren
        if(tocPlaceholder) tocPlaceholder.style.display = 'block';
        if(tocList) tocList.innerHTML = '';
    } else {
        console.warn("Audio duration is unknown or infinite.");
        if(totalDurationDisplay) totalDurationDisplay.textContent = "??:??";
        if(fileInfoDisplay && fileInfoDisplay.textContent.startsWith('Loading')) {
             fileInfoDisplay.textContent = `Forwarded Audio (Unknown duration)`;
        }
         enableControls(false); // Grundsteuerung ja, Seeking nein
         if(tocPlaceholder) tocPlaceholder.textContent = "Cannot generate index for this audio type.";
         if(tocPlaceholder) tocPlaceholder.style.display = 'block';
         if(tocList) tocList.innerHTML = '';
    }
}

function handleTimeUpdate() {
    if (!audioPlayer || isNaN(audioPlayer.duration) || !isFinite(audioPlayer.duration)) return;
    if(currentTimeDisplay) currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
    if(seekSlider && !seekSlider.matches(':active')) {
        seekSlider.value = audioPlayer.currentTime;
    }
}

function handlePlaybackEnded() {
    console.log("Playback ended.");
    if(playPauseButton) playPauseButton.textContent = '▶️';
}

function handleAudioError(e) {
    console.error("Audio Player Error:", e, audioPlayer ? audioPlayer.error : 'N/A');
    let message = "An error occurred while trying to load or play the audio.";
    // ... (Fehlercode-Auswertung wie zuvor) ...
    tg.showAlert(message);
    if(fileInfoDisplay) fileInfoDisplay.textContent = "Error loading file.";
    resetPlayer();
    // Entscheiden, ob Uploader oder Player UI gezeigt werden soll
    if(playerUI) playerUI.style.display = 'none';
    if(fileLoader) fileLoader.style.display = 'block'; // Zeige Uploader wieder an
}

// --- Content Index (ToC) ---
// (generateContentIndex, addTocItem bleiben gleich - weiterhin komplex)
function generateContentIndex() {
    // ... (Keine Änderungen hier) ...
    console.warn("Automatic ToC generation is not implemented due to complexity.");
    if (tocList && tocList.children.length === 0) {
        if(tocPlaceholder) tocPlaceholder.style.display = 'block';
        if(tocPlaceholder) tocPlaceholder.textContent = "Automatic content index generation is complex...";
   } else if (tocPlaceholder) {
        tocPlaceholder.style.display = 'none';
   }
}
function addTocItem(title, timeSeconds) {
    // ... (Keine Änderungen hier) ...
}


// --- Utility Functions ---
// (formatTime bleibt gleich)
function formatTime(totalSeconds) {
    // ... (Keine Änderungen hier) ...
     if (isNaN(totalSeconds) || !isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
    const minutes = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Reset Player UI and state
function resetPlayer() {
     console.log("Resetting player state.");
     // Stoppe Wiedergabe und entferne Quelle NICHT hier, wird in cleanupAudioSources gemacht
     if(audioPlayer) {
         audioPlayer.pause();
         // audioPlayer.removeAttribute('src'); // Wird in cleanup gemacht
         // audioPlayer.load(); // Wird in cleanup gemacht
     }

    if(fileInfoDisplay) fileInfoDisplay.textContent = 'No file loaded';
    if(currentTimeDisplay) currentTimeDisplay.textContent = '00:00';
    if(totalDurationDisplay) totalDurationDisplay.textContent = '00:00';
    if(seekSlider) {
        seekSlider.value = 0;
        seekSlider.max = 1;
    }
    disableControls();
    if(tocList) tocList.innerHTML = '';
    if(tocPlaceholder) tocPlaceholder.style.display = 'block';
    if(playPauseButton) playPauseButton.textContent = '▶️';

    // Alte Blob URL wird in cleanupAudioSources entfernt
}

// Enable/Disable Controls
function enableControls(enableSeeking = true) {
    console.log("Enabling controls", enableSeeking ? "(with seeking)" : "(without seeking)");
    if(playPauseButton) playPauseButton.disabled = false;
    if(stopButton) stopButton.disabled = false;
    if(seekSlider) seekSlider.disabled = !enableSeeking;
    if(volumeSlider) volumeSlider.disabled = false;
}
 function disableControls() {
    console.log("Disabling controls");
    if(playPauseButton) playPauseButton.disabled = true;
    if(stopButton) stopButton.disabled = true;
    if(seekSlider) seekSlider.disabled = true;
    if(volumeSlider) volumeSlider.disabled = true; // Auch Lautstärke erstmal deaktivieren
}

// --- Start the App ---
initializeApp();
