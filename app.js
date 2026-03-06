const btnToggleScan = document.getElementById('btn-toggle-scan');
const radarContainer = document.getElementById('radar-container');
const distanceDisplay = document.getElementById('distance-display');
const statusText = document.getElementById('status-text');
const evidenceAlert = document.getElementById('evidence-alert');
const btnOpenEvidence = document.getElementById('btn-open-evidence');
const uplinkStatus = document.getElementById('uplink-status');
const btnBackToScanner = document.getElementById('btn-back-to-scanner');
const scannerView = document.getElementById('scanner-view');
const evidenceView = document.getElementById('evidence-view');
const deviceContainer = document.getElementById('device-container');

let isScanning = false;
let watchId = null;
let evidenceData = null;
let currentNearestEvidence = null;
let evidenceOpened = false;

// Pobranie bazy punktów z pliku JSON
async function loadEvidenceData() {
    try {
        const response = await fetch('data.json');
        evidenceData = await response.json();
    } catch (error) {
        console.error("Błąd wczytywania danych JSON:", error);
    }
}

// Obliczanie odległości (wzór haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Promień Ziemi w metrach
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Zwraca odległość w metrach
}

function parseCoordinates(coordString) {
    const parts = coordString.split(',').map(s => parseFloat(s.trim()));
    return { lat: parts[0], lon: parts[1] };
}

function updateLocation(position) {
    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Jeżeli mamy odczyt, znaczy że lokalizacja jest aktywna i zgoda udzielona
    if (uplinkStatus.innerText !== "[ACTIVE]") {
        uplinkStatus.innerText = "[ACTIVE]";
        uplinkStatus.className = "status-active";
    }

    if (!evidenceData || !evidenceData.points || evidenceData.points.length === 0) {
        statusText.innerText = "Brak bazy danych";
        return;
    }

    let minDistance = Infinity;
    let nearestPoint = null;

    // Szukanie najbliższego punktu
    evidenceData.points.forEach(point => {
        const coords = parseCoordinates(point.coords);
        const distance = calculateDistance(userLat, userLon, coords.lat, coords.lon);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = point;
        }
    });

    // Aktualizacja interfejsu (wyświetlamy samą odległość w całkowitych metrach)
    const roundedDistance = Math.max(0, Math.round(minDistance));
    distanceDisplay.innerHTML = `${roundedDistance}<span class="unit">m</span>`;
    
    // Status precyzji sygnału
    if(accuracy > 30) {
        statusText.innerText = "SŁABY SYGNAŁ GPS";
        statusText.style.color = "var(--neon-red)";
    } else {
        statusText.innerText = "SKANOWANIE W TOKU...";
        statusText.style.color = "var(--neon-green)";
    }

    // Sprawdzenie czy gracz wszedł w obszar dowodu (radius m)
    if (roundedDistance <= 15 && nearestPoint) {
        triggerEvidenceFound(nearestPoint);
    } else {
        hideEvidenceAlert();
    }
}

function triggerEvidenceFound(point) {
    // Zapobiegaj ponownemu pokazaniu jeśli dowód już został otwarty (zależne od potrzeb gry)
    // Usunięcie warunku evidenceOpened zezwoli na ponowne pokazanie powiadomienia po powrocie do aplikacji
    
    if(!evidenceAlert.classList.contains('hidden')) return; // Już wyświetlone
    
    currentNearestEvidence = point;
    navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 500]); // Wibracja jeśli obsługiwana
    evidenceAlert.classList.remove('hidden');
}

function hideEvidenceAlert() {
    evidenceAlert.classList.add('hidden');
}

function handleLocationError(error) {
    let msg = "BŁĄD LOKALIZACJI";
    switch (error.code) {
        case error.PERMISSION_DENIED:
            msg = "BRAK ZGODY NA GPS";
            uplinkStatus.innerText = "[ERROR]";
            uplinkStatus.className = "status-error";
            break;
        case error.POSITION_UNAVAILABLE:
            msg = "ZBYT SŁABY SYGNAŁ";
            break;
        case error.TIMEOUT:
            msg = "PRZEKROCZONO CZAS";
            break;
    }
    statusText.innerText = msg;
    statusText.style.color = "var(--neon-red)";
    distanceDisplay.innerHTML = `--<span class="unit">m</span>`;
}

function startScanning() {
    if (!navigator.geolocation) {
        statusText.innerText = "BŁĄD: BRAK MODUŁU GPS";
        return;
    }

    isScanning = true;
    btnToggleScan.innerText = "PRZERWIJ INFILTRACJĘ";
    btnToggleScan.classList.replace('primary', 'danger');
    radarContainer.classList.add('active');
    statusText.innerText = "NAWIĄZYWANIE POŁĄCZENIA...";
    statusText.style.color = "var(--text-muted)";
    distanceDisplay.innerHTML = `??<span class="unit">m</span>`;

    watchId = navigator.geolocation.watchPosition(
        updateLocation, 
        handleLocationError, 
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function stopScanning() {
    isScanning = false;
    btnToggleScan.innerText = "INICJUJ SKANOWANIE";
    btnToggleScan.classList.replace('danger', 'primary');
    radarContainer.classList.remove('active');
    statusText.innerText = "SYSTEM OFFLINE";
    statusText.style.color = "var(--text-muted)";
    distanceDisplay.innerHTML = `--<span class="unit">m</span>`;
    
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    hideEvidenceAlert();
}

btnToggleScan.addEventListener('click', () => {
    if (isScanning) {
        stopScanning();
    } else {
        startScanning();
    }
});

// Hakerski efekt cyferek na tytule co jakiś czas
const mainTitle = document.getElementById('main-title');
setInterval(() => {
    if(!mainTitle) return;
    if(Math.random() > 0.7 && !isScanning) return; // rzadziej gdy wyłączony
    const chars = '01QKZXVBM!@#$%^&*()';
    const originalText = 'HURALOKALIZATOR 2045';
    let newText = '';
    for(let i=0; i<originalText.length; i++) {
        if(originalText[i] === ' ' || originalText[i] === '-') {
            newText += originalText[i];
            continue;
        }
        if(Math.random() > 0.8) {
            newText += chars[Math.floor(Math.random() * chars.length)];
        } else {
            newText += originalText[i];
        }
    }
    mainTitle.innerText = newText;
    mainTitle.style.color = 'var(--neon-green)';
    mainTitle.style.textShadow = '0 0 10px var(--neon-green-glow)';
    
    setTimeout(() => {
        mainTitle.innerText = originalText;
        mainTitle.style.color = 'var(--text-primary)';
        mainTitle.style.textShadow = '0 0 5px var(--neon-green-glow)';
    }, 150);
}, 1000);

btnOpenEvidence.addEventListener('click', () => {
    if (currentNearestEvidence) {
        evidenceOpened = true;
        hideEvidenceAlert();
        
        // Zatrzymanie skanera
        if (isScanning) {
            stopScanning();
        }
        
        // Przekierowanie do dowodu w zależności od typu
        if (currentNearestEvidence.type === 'url') {
            window.open(currentNearestEvidence.content, '_blank');
        } else {
            // Ukrycie skanera i pokazanie dowodu
            showEvidence(currentNearestEvidence.id);
        }
    }
});

// Przycisk powrotu do skanera
btnBackToScanner.addEventListener('click', () => {
    // Otwiera nową kartę z główną stroną
    window.open(window.location.pathname, '_blank');
});

// Funkcja przełączania na widok dowodu
function showEvidence(evidenceId) {
    scannerView.classList.add('hidden');
    evidenceView.classList.add('active');
    deviceContainer.classList.add('evidence-mode');
    loadEvidence(evidenceId);
}

// Funkcja ładowania dowodu
async function loadEvidence(id) {
    const contentArea = document.getElementById('content-area');
    const header = document.getElementById('evidence-header');

    const setError = () => {
        header.innerHTML = 'DEKRYPTACJA <span style="animation: blinker 1s steps(2, start) infinite;">[ERROR]</span>';
        header.style.color = "var(--neon-red)";
        header.style.borderBottomColor = "var(--neon-red)";
        document.querySelector('.watermark').innerText = "[FAILED]";
    };

    if (!id) {
        contentArea.innerHTML = "<p>Błąd: Brak identyfikatora pliku.</p>";
        setError();
        return;
    }

    try {
        const response = await fetch('data.json');
        const data = await response.json();
        const item = data.points.find(p => p.id === id);

        if (!item) {
            contentArea.innerHTML = "<p>Brak pliku w bazie (Usunięty przez system?).</p>";
            setError();
            return;
        }

        const typeLabels = {
            'text': 'TYP: TEKSTOWY',
            'image': 'TYP: OBRAZ',
            'audio': 'TYP: NAGRANIE AUDIO',
            'url': 'TYP: ŁĄCZE SIECIOWE'
        };
        document.getElementById('evidence-type-label').innerText = typeLabels[item.type] || 'TYP: NIEZNANY';

        // Render based on type
        if (item.type === 'text') {
            contentArea.innerHTML = `<div class="evidence-item-wrapper"><div class="text-content">${item.content}</div></div>`;
        } else if (item.type === 'image') {
            contentArea.innerHTML = `<div class="evidence-item-wrapper"><img src="${item.content}" alt="Dowód fotograficzny"></div>`;
        } else if (item.type === 'audio') {
            contentArea.innerHTML = `<div class="evidence-item-wrapper"><audio controls src="${item.content}"></audio></div>`;
        } else {
            contentArea.innerHTML = "<p>Nieznany typ nośnika.</p>";
            setError();
        }

    } catch (err) {
        contentArea.innerHTML = "<p>Błąd połączenia z bazą główną.</p>";
        setError();
    }
}

// Sprawdzenie parametrów URL przy starcie (dla debugowania)
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const evidenceParam = urlParams.get('evidence');
    
    if (evidenceParam) {
        // Tryb debugowania - bezpośrednie wyświetlenie dowodu
        showEvidence(evidenceParam);
    }
}

// Inicjalizacja ładownia danych
loadEvidenceData();

// Sprawdzenie parametrów URL przy starcie
checkUrlParams();

// Sprawdzanie uprawnień do geolokalizacji na starcie
if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(function(permissionStatus) {
        function updateUplinkStatus() {
            if (permissionStatus.state === 'granted') {
                uplinkStatus.innerText = "[ACTIVE]";
                uplinkStatus.className = "status-active";
            } else if (permissionStatus.state === 'denied') {
                uplinkStatus.innerText = "[ERROR]";
                uplinkStatus.className = "status-error";
            } else {
                uplinkStatus.innerText = "[INACTIVE]";
                uplinkStatus.className = "status-inactive";
            }
        }
        updateUplinkStatus();
        permissionStatus.onchange = updateUplinkStatus;
    });
}
