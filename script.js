{\rtf1\ansi\ansicpg1252\cocoartf2821
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const tg = window.Telegram.WebApp;\
\
// --- DOM Elements ---\
const fileInput = document.getElementById('file-input');\
const fileInputLabel = document.getElementById('file-input-label');\
const fileLoader = document.getElementById('file-loader');\
const forwardedInfo = document.getElementById('forwarded-info');\
const playerUI = document.getElementById('player-ui');\
const audioPlayer = document.getElementById('audio-player');\
const fileInfoDisplay = document.getElementById('file-info');\
const playPauseButton = document.getElementById('play-pause-button');\
const stopButton = document.getElementById('stop-button');\
const seekSlider = document.getElementById('seek-slider');\
const volumeSlider = document.getElementById('volume-slider');\
const currentTimeDisplay = document.getElementById('current-time');\
const totalDurationDisplay = document.getElementById('total-duration');\
const contentIndexSection = document.getElementById('content-index');\
const tocList = document.getElementById('toc-list');\
const tocPlaceholder = document.getElementById('toc-placeholder');\
\
// --- State ---\
let currentAudioBlobUrl = null; // To manage object URLs\
\
// --- Initialization ---\
function initializeApp() \{\
    if (!tg) \{\
        console.error("Telegram WebApp API not found!");\
        // Optionally display an error message to the user\
        document.body.innerHTML = '<p style="color: red; padding: 20px;">Error: Could not initialize Telegram WebApp. Please ensure you are running this inside Telegram.</p>';\
        return;\
    \}\
    console.log("Mini App Initializing...");\
    tg.ready(); // Inform Telegram the app is ready\
    tg.expand(); // Expand the Mini App to full height\
\
    // Apply Telegram Theme Colors (Optional but Recommended)\
    applyThemeColors();\
\
    // Check if audio file info was passed from the bot (for forwarded files)\
    // This is a placeholder - actual implementation depends on how the bot sends data\
    // Use tg.initDataUnsafe for launch parameters - remember it's 'unsafe' client-side\
    // A backend should verify tg.initData for secure operations\
    const launchParams = new URLSearchParams(tg.initDataUnsafe.start_param ? ('?' + tg.initDataUnsafe.start_param) : '');\
    const forwardedFileId = launchParams.get('file_id'); // Example parameter name\
\
    if (forwardedFileId) \{\
         console.log("Found forwarded file_id:", forwardedFileId);\
         fileLoader.style.display = 'none'; // Hide manual loader\
         playerUI.style.display = 'flex';\
         fileInfoDisplay.textContent = `Loading forwarded file... (ID: $\{forwardedFileId.substring(0,10)\}...)`;\
         forwardedInfo.style.display = 'block';\
         // !!! CRITICAL: You CANNOT directly load by file_id here.\
         // You need a backend service that takes this file_id, uses your BOT TOKEN\
         // to get a temporary download URL or the file bytes from Telegram,\
         // and then serves it to this Mini App.\
         // This example proceeds assuming you handle this externally and get a playable URL.\
         // loadAudioFromUrl(`YOUR_BACKEND_ENDPOINT/get_audio?file_id=$\{forwardedFileId\}`);\
         tg.showAlert("Playing forwarded files requires a backend setup. This feature is not yet fully implemented in this demo.");\
         // Disable controls until backend provides URL (or show loading)\
         disableControls();\
         // Maybe show a loading spinner or different message\
         fileInfoDisplay.textContent = "Forwarded file playback requires backend.";\
\
    \} else \{\
        // Allow manual file selection if no forwarded file info\
        console.log("No forwarded file info found, enabling manual load.");\
        fileLoader.style.display = 'block';\
         forwardedInfo.style.display = 'none'; // Hide the notice\
    \}\
\
     // --- Event Listeners ---\
     // Ensure elements exist before adding listeners\
     if(fileInput) fileInput.addEventListener('change', handleFileSelect);\
     if(playPauseButton) playPauseButton.addEventListener('click', togglePlayPause);\
     if(stopButton) stopButton.addEventListener('click', stopPlayback);\
     if(seekSlider) seekSlider.addEventListener('input', handleSeek); // Use 'input' for live feedback during drag\
     if(volumeSlider) volumeSlider.addEventListener('input', handleVolume);\
     if(audioPlayer) \{\
         audioPlayer.addEventListener('loadedmetadata', handleMetadataLoaded);\
         audioPlayer.addEventListener('timeupdate', handleTimeUpdate);\
         audioPlayer.addEventListener('ended', handlePlaybackEnded);\
         audioPlayer.addEventListener('play', () => \{ if(playPauseButton) playPauseButton.textContent = '\uc0\u9208 \u65039 '; \}); // Pause icon\
         audioPlayer.addEventListener('pause', () => \{ if(playPauseButton) playPauseButton.textContent = '\uc0\u9654 \u65039 '; \}); // Play icon\
         audioPlayer.addEventListener('error', handleAudioError);\
     \}\
\
     console.log("Mini App Ready!");\
\
\}\
\
function applyThemeColors() \{\
     const root = document.documentElement;\
     if (tg.themeParams) \{\
         console.log("Applying theme colors:", tg.themeParams);\
         root.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');\
         root.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');\
         root.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');\
         root.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');\
         root.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#aaaaaa');\
         root.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#2481cc');\
         root.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f4f4f4');\
     \} else \{\
         console.log("No theme params found, using defaults.");\
     \}\
\}\
\
\
// --- File Handling ---\
function handleFileSelect(event) \{\
    const file = event.target.files[0];\
    if (file) \{\
        console.log("File selected:", file.name, file.type, file.size);\
        if (file.type.startsWith('audio/')) \{\
            loadAudioFromFile(file);\
            if(fileLoader) fileLoader.style.display = 'none'; // Hide loader\
            if(playerUI) playerUI.style.display = 'flex'; // Show player\
        \} else \{\
            tg.showAlert('Please select a valid audio file (MP3, WAV, OGG, AAC, M4A).');\
        \}\
    \}\
\}\
\
function loadAudioFromFile(file) \{\
    // Clean up previous audio object URL if exists\
    if (currentAudioBlobUrl) \{\
        URL.revokeObjectURL(currentAudioBlobUrl);\
        console.log("Revoked previous Object URL");\
    \}\
    resetPlayer(); // Reset UI before loading new file\
\
    currentAudioBlobUrl = URL.createObjectURL(file);\
    console.log("Created Object URL:", currentAudioBlobUrl);\
    if(audioPlayer) audioPlayer.src = currentAudioBlobUrl;\
    if(fileInfoDisplay) fileInfoDisplay.textContent = `File: $\{file.name\}`;\
    // Don't autoplay, wait for user interaction\
    // enableControls() will be called by handleMetadataLoaded or handleAudioError\
    disableControls(); // Keep disabled until metadata loaded\
\}\
\
// Placeholder for loading from a URL (e.g., from backend for forwarded files)\
function loadAudioFromUrl(url) \{\
     if (currentAudioBlobUrl) \{\
        URL.revokeObjectURL(currentAudioBlobUrl);\
        currentAudioBlobUrl = null;\
    \}\
    resetPlayer();\
    console.log("Loading audio from URL:", url);\
    if(audioPlayer) audioPlayer.src = url;\
    if(fileInfoDisplay) fileInfoDisplay.textContent = `Loading audio...`;\
    // Don't enable controls immediately, wait for loadedmetadata\
    disableControls();\
\}\
\
\
// --- Playback Controls ---\
function togglePlayPause() \{\
    if (!audioPlayer || !audioPlayer.src || audioPlayer.readyState < 2) \{ // Check if ready to play\
        console.warn("Audio not ready to play.");\
        return;\
    \}\
\
    if (audioPlayer.paused || audioPlayer.ended) \{\
        audioPlayer.play().catch(handleAudioError);\
    \} else \{\
        audioPlayer.pause();\
    \}\
\}\
\
function stopPlayback() \{\
    if (!audioPlayer) return;\
    audioPlayer.pause();\
    audioPlayer.currentTime = 0; // Reset time\
    // Slider and time display update via 'timeupdate' event\
\}\
\
function handleSeek() \{\
    if (!audioPlayer || isNaN(audioPlayer.duration)) return;\
     audioPlayer.currentTime = seekSlider.value;\
\}\
\
 function handleVolume() \{\
    if (!audioPlayer) return;\
    audioPlayer.volume = volumeSlider.value;\
\}\
\
// --- Audio Player Event Handlers ---\
function handleMetadataLoaded() \{\
    if (!audioPlayer) return;\
    console.log("Metadata loaded. Duration:", audioPlayer.duration);\
    if (!isNaN(audioPlayer.duration) && isFinite(audioPlayer.duration)) \{\
        if(seekSlider) \{\
            seekSlider.max = audioPlayer.duration;\
            seekSlider.disabled = false;\
        \}\
        if(totalDurationDisplay) totalDurationDisplay.textContent = formatTime(audioPlayer.duration);\
        enableControls(); // Enable controls now that we have duration\
        // !!! Placeholder for ToC Generation - VERY COMPLEX !!!\
        generateContentIndex();\
        if(tocPlaceholder) tocPlaceholder.style.display = 'block'; // Show placeholder text\
        if(tocList) tocList.innerHTML = ''; // Clear any previous ToC\
    \} else \{\
        // Handle cases like live streams or unknown/infinite duration\
        console.warn("Audio duration is unknown or infinite.");\
        if(totalDurationDisplay) totalDurationDisplay.textContent = "??:??";\
         if(seekSlider) seekSlider.disabled = true; // Can't seek without duration\
         enableControls(false); // Enable basic controls but not seeking\
         if(tocPlaceholder) tocPlaceholder.textContent = "Cannot generate index for this audio type.";\
         if(tocPlaceholder) tocPlaceholder.style.display = 'block';\
         if(tocList) tocList.innerHTML = '';\
    \}\
\}\
\
function handleTimeUpdate() \{\
    if (!audioPlayer || isNaN(audioPlayer.duration) || !isFinite(audioPlayer.duration)) return;\
\
    if(currentTimeDisplay) currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);\
    // Only update slider if the user isn't currently dragging it\
    // (avoids conflicts, though 'input' event usually handles this well)\
    if(seekSlider && !seekSlider.matches(':active')) \{\
        seekSlider.value = audioPlayer.currentTime;\
    \}\
\}\
\
function handlePlaybackEnded() \{\
    console.log("Playback ended.");\
    if(playPauseButton) playPauseButton.textContent = '\uc0\u9654 \u65039 '; // Show play icon again\
    // Optional: Reset time to 0? Depends on desired behavior.\
    // if (audioPlayer) audioPlayer.currentTime = 0;\
    // if (seekSlider) seekSlider.value = 0;\
    // if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(0);\
\}\
\
function handleAudioError(e) \{\
    console.error("Audio Player Error:", e, audioPlayer.error);\
    let message = "An error occurred while trying to load or play the audio.";\
    if (audioPlayer.error) \{\
        switch (audioPlayer.error.code) \{\
            case MediaError.MEDIA_ERR_ABORTED:\
                message = 'Audio playback aborted.';\
                break;\
            case MediaError.MEDIA_ERR_NETWORK:\
                message = 'A network error caused audio download to fail.';\
                break;\
            case MediaError.MEDIA_ERR_DECODE:\
                message = 'Audio playback aborted due to decoding error.';\
                break;\
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:\
                message = 'The audio format is not supported.';\
                break;\
            default:\
                message = 'An unknown audio error occurred.';\
                break;\
        \}\
    \}\
    tg.showAlert(message);\
    if(fileInfoDisplay) fileInfoDisplay.textContent = "Error loading file.";\
    resetPlayer(); // Reset to initial state on error\
    if(fileLoader) fileLoader.style.display = 'block'; // Show file loader again\
    if(playerUI) playerUI.style.display = 'none'; // Hide player\
\}\
\
\
// --- Content Index (ToC) ---\
// !!! THIS IS A MAJOR CHALLENGE CLIENT-SIDE !!!\
function generateContentIndex() \{\
    if(tocPlaceholder) tocPlaceholder.style.display = 'none'; // Hide placeholder if generating\
    if(tocList) tocList.innerHTML = ''; // Clear previous list\
\
    console.warn("Automatic ToC generation is not implemented due to complexity.");\
    // **Option 1: Placeholder / Manual (Example)**\
    // addTocItem("Introduction", 0);\
    // addTocItem("Chapter 1 Start", 65); // Example: Add at 1:05\
\
    // If no ToC can be generated:\
    if (tocList && tocList.children.length === 0) \{\
         if(tocPlaceholder) tocPlaceholder.style.display = 'block';\
         if(tocPlaceholder) tocPlaceholder.textContent = "Automatic content index generation is complex and may require specific audio formats or server-side analysis. This feature is planned for future updates."; // Reset text\
    \}\
\}\
\
function addTocItem(title, timeSeconds) \{\
    if(!tocList || !tocPlaceholder) return;\
\
    const li = document.createElement('li');\
    li.textContent = `$\{formatTime(timeSeconds)\} - $\{title\}`;\
    li.dataset.time = timeSeconds; // Store time in data attribute\
    li.addEventListener('click', () => \{\
        if (audioPlayer && !isNaN(audioPlayer.duration)) \{\
            audioPlayer.currentTime = timeSeconds;\
            if(audioPlayer.paused) \{\
                 audioPlayer.play().catch(handleAudioError);\
            \}\
        \}\
    \});\
    tocList.appendChild(li);\
    tocPlaceholder.style.display = 'none';\
\}\
\
\
// --- Utility Functions ---\
function formatTime(totalSeconds) \{\
    if (isNaN(totalSeconds) || !isFinite(totalSeconds) || totalSeconds < 0) \{\
        return "00:00";\
    \}\
    const minutes = Math.floor(totalSeconds / 60);\
    const secs = Math.floor(totalSeconds % 60);\
    return `$\{minutes.toString().padStart(2, '0')\}:$\{secs.toString().padStart(2, '0')\}`;\
\}\
\
function resetPlayer() \{\
    console.log("Resetting player state.");\
     if(audioPlayer) \{\
         audioPlayer.pause();\
         audioPlayer.removeAttribute('src'); // Remove source\
         audioPlayer.load(); // Important to reset internal state\
         // Remove previous event listeners to avoid duplicates if re-initializing\
         // (Though loading in head with defer usually runs script once)\
         // It's safer to ensure they are only added once in initializeApp\
     \}\
\
    if(fileInfoDisplay) fileInfoDisplay.textContent = 'No file loaded';\
    if(currentTimeDisplay) currentTimeDisplay.textContent = '00:00';\
    if(totalDurationDisplay) totalDurationDisplay.textContent = '00:00';\
    if(seekSlider) \{\
        seekSlider.value = 0;\
        seekSlider.max = 1; // Reset max\
    \}\
    disableControls();\
    if(tocList) tocList.innerHTML = ''; // Clear ToC\
    if(tocPlaceholder) tocPlaceholder.style.display = 'block';\
    if(playPauseButton) playPauseButton.textContent = '\uc0\u9654 \u65039 '; // Ensure play icon shows\
\
    // Don't revoke currentAudioBlobUrl here, do it *before* creating a new one in loadAudioFromFile\
\}\
\
function enableControls(enableSeeking = true) \{\
    console.log("Enabling controls", enableSeeking ? "(with seeking)" : "(without seeking)");\
    if(playPauseButton) playPauseButton.disabled = false;\
    if(stopButton) stopButton.disabled = false;\
    if(seekSlider) seekSlider.disabled = !enableSeeking;\
    if(volumeSlider) volumeSlider.disabled = false;\
\}\
 function disableControls() \{\
    console.log("Disabling controls");\
    if(playPauseButton) playPauseButton.disabled = true;\
    if(stopButton) stopButton.disabled = true;\
    if(seekSlider) seekSlider.disabled = true;\
    // if(volumeSlider) volumeSlider.disabled = true; // Volume can usually be set anytime, keep enabled?\
\}\
\
\
// --- Start the App ---\
// Use defer in the script tag, so DOMContentLoaded is not strictly necessary\
// but adding it can sometimes help ensure everything is absolutely ready.\
// If using defer, initializeApp will run after HTML is parsed but maybe before\
// all resources like images are loaded. For this app, it's fine.\
initializeApp();\
\
// Alternatively, wrap in DOMContentLoaded if you prefer:\
// document.addEventListener('DOMContentLoaded', initializeApp);}