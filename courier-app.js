// courier-app.js - VERSI LENGKAP DENGAN FITUR GPS DAN PERBAIKAN STABILITAS

const FREE_BACKEND_URL = 'https://backend-production-e12e5.up.railway.app';

let socket = null;
let whatsappStatus = 'disconnected';
let courierState = {
    jobs: [],
    history: [],
    balance: 185000,
    activeDeliveries: [],
    onlineMode: true,
};
let jobIdCounter = 1000;
let simulatedJobInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// === VARIABLES UNTUK CHAT & GPS ===
let currentChatJobId = null;
let chatMessages = {};
let currentLocation = null;
let locationWatchId = null;

// === GPS & MAPS FUNCTIONS - LENGKAP DAN DIPERBAIKI ===

// Fungsi untuk mendapatkan lokasi GPS saat ini
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('GPS tidak didukung di browser ini'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date()
                };
                currentLocation = location;
                resolve(location);
            },
            (error) => {
                const errorMessage = getLocationErrorMessage(error);
                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

// Fungsi untuk memulai tracking lokasi
function startLocationTracking() {
    if (!navigator.geolocation) {
        showNotification('GPS tidak didukung di perangkat Anda', 'error');
        return;
    }

    if (locationWatchId) {
        stopLocationTracking();
    }

    locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date()
            };
            
            // Update UI dengan lokasi terbaru
            updateLocationUI(currentLocation);
            
            // Kirim ke server jika terhubung
            if (socket && socket.connected) {
                socket.emit('location_update', {
                    courierId: 'courier_001',
                    location: currentLocation,
                    timestamp: new Date()
                });
            }
        },
        (error) => {
            console.error('GPS Error:', error);
            showNotification(`Error GPS: ${getLocationErrorMessage(error)}`, 'warning');
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000
        }
    );
    
    showNotification('Tracking lokasi dimulai', 'success');
    updateGPSControls(true);
}

// Fungsi untuk menghentikan tracking
function stopLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        showNotification('Tracking lokasi dihentikan', 'info');
        updateGPSControls(false);
    }
}

// Fungsi untuk update UI lokasi
function updateLocationUI(location) {
    const locationElement = document.getElementById('currentLocation');
    if (locationElement) {
        locationElement.textContent = 
            `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (±${Math.round(location.accuracy)}m)`;
    }
}

// Fungsi untuk update GPS controls
function updateGPSControls(isTracking) {
    const gpsControls = document.getElementById('gpsControls');
    if (gpsControls) {
        // Hanya tampilkan jika ada pengiriman aktif
        if (courierState.activeDeliveries.length > 0) {
            gpsControls.style.display = 'flex';
            // Update tombol (misalnya, tombol stop muncul jika isTracking true)
            const startBtn = gpsControls.querySelector('.gps-control-btn.start');
            const stopBtn = gpsControls.querySelector('.gps-control-btn.stop');
            
            if (startBtn && stopBtn) {
                startBtn.style.display = isTracking ? 'none' : 'flex';
                stopBtn.style.display = isTracking ? 'flex' : 'none';
            }
        } else {
            gpsControls.style.display = 'none';
        }
    }
}

// Fungsi untuk mendapatkan pesan error GPS
function getLocationErrorMessage(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            return "Akses GPS ditolak. Izinkan akses lokasi di pengaturan browser.";
        case error.POSITION_UNAVAILABLE:
            return "Informasi lokasi tidak tersedia.";
        case error.TIMEOUT:
            return "Permintaan lokasi timeout.";
        default:
            return "Error tidak diketahui.";
    }
}

// === GOOGLE MAPS INTEGRATION - PERBAIKAN LINK ===

// URL yang digunakan untuk menunjuk ke lokasi spesifik
function openLocationInGoogleMaps(latitude, longitude, label = 'Lokasi') {
    // Menggunakan URL Google Maps yang benar (hl=id untuk bahasa Indonesia)
    const url = `https://maps.google.com/?q=${latitude},${longitude}&hl=id`;
    window.open(url, '_blank');
    return url;
}

// URL yang digunakan untuk membuka navigasi rute
function openDirectionsInGoogleMaps(fromLat, fromLng, toLat, toLng) {
    const origin = `${fromLat},${fromLng}`;
    const destination = `${toLat},${toLng}`;
    // Menggunakan URL Google Maps yang benar untuk navigasi
    const url = `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&travelmode=driving&hl=id`;
    window.open(url, '_blank');
    return url;
}

// Placeholder untuk Static Map (karena butuh API Key)
function getGoogleMapsStaticUrl(latitude, longitude, zoom = 15, size = '400x200') {
    // Menggunakan placeholder internal yang tidak bergantung pada domain yang bermasalah
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGVlIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJTYW5zLVNlcmlmIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzMzIj5NQVAgUFJFVklFVzwvdGV4dD4KICA8dGV4dCB4PSI1MCUiIHk9IjY1JSIgZm9udC1mYW1pbHk9IlNhbnMtU2VyaWYiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2NjYiPihDb29yZHM6ICRELFwgR0lWOyB6b29tOiAxNSk8L3RleHQ+Cjwvc3ZnPg==`.replace('$', latitude).replace('\\', longitude);
}

// === GPS MODAL FUNCTIONS ===

function showGPSModal(jobId, locationType = 'pickup') {
    console.log('🗺️ Membuka modal GPS untuk:', jobId, locationType);
    
    const modal = document.getElementById('gpsModal');
    const job = courierState.activeDeliveries.find(j => j.id === jobId) || 
                courierState.jobs.find(j => j.id === jobId);
    
    if (!modal || !job) {
        showNotification('Data lokasi tidak ditemukan', 'error');
        return;
    }

    const location = locationType === 'pickup' ? job.pickup : job.delivery;
    const modalTitle = document.getElementById('gpsModalTitle');
    const locationName = document.getElementById('gpsLocationName');
    const locationAddress = document.getElementById('gpsLocationAddress');
    const gpsLinkBtn = document.getElementById('gpsLinkBtn');
    const copyGpsBtn = document.getElementById('copyGpsBtn');
    const shareGpsBtn = document.getElementById('shareGpsBtn');
    const mapPreview = document.getElementById('mapPreview');

    if (modalTitle) modalTitle.textContent = `Lokasi ${locationType === 'pickup' ? 'Pickup' : 'Delivery'}`;
    if (locationName) locationName.textContent = location.name;
    if (locationAddress) locationAddress.textContent = location.address;

    // Ambil koordinat dari data job (diharapkan sudah diekstrak oleh server)
    // Gunakan dummy coordinates jika tidak ada (untuk simulasi)
    const gpsCoords = location.gps || generateDummyCoordinates();
    
    // Pastikan koordinat adalah objek yang valid
    const lat = parseFloat(gpsCoords.lat);
    const lng = parseFloat(gpsCoords.lng);
    const isValidCoords = !isNaN(lat) && !isNaN(lng);

    // Update GPS link
    if (gpsLinkBtn) {
        if (isValidCoords) {
            const url = openLocationInGoogleMaps(lat, lng, location.name);
            gpsLinkBtn.href = url; 
            gpsLinkBtn.onclick = (e) => {
                e.preventDefault();
                openLocationInGoogleMaps(lat, lng, location.name);
            };
        } else {
            gpsLinkBtn.href = '#';
            gpsLinkBtn.onclick = (e) => {
                e.preventDefault();
                showNotification('Koordinat GPS tidak valid. Harap hubungi Admin.', 'error');
            };
        }
    }

    // Copy GPS coordinates
    if (copyGpsBtn) {
        copyGpsBtn.onclick = () => {
            let coordsText;
            if (isValidCoords) {
                coordsText = `${location.name}\n${location.address}\nKoordinat: ${lat}, ${lng}`;
            } else {
                coordsText = `${location.name}\n${location.address}\nKoordinat: TIDAK VALID`;
                showNotification('Koordinat GPS tidak valid, hanya menyalin nama dan alamat.', 'warning');
            }
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(coordsText).then(() => {
                    showNotification('Koordinat/Alamat berhasil disalin!', 'success');
                }).catch(() => {
                    fallbackCopyText(coordsText);
                });
            } else {
                fallbackCopyText(coordsText);
            }
        };
    }

    // Share GPS location
    if (shareGpsBtn) {
        shareGpsBtn.onclick = () => {
            const shareText = `Lokasi ${locationType === 'pickup' ? 'Pickup' : 'Delivery'} - ${location.name}: ${location.address}`;
            const shareUrl = isValidCoords ? openLocationInGoogleMaps(lat, lng, location.name) : 'Lokasi tidak dapat dibagikan (koordinat tidak valid).';
            
            if (navigator.share) {
                navigator.share({
                    title: `Lokasi ${location.name}`,
                    text: shareText,
                    url: isValidCoords ? shareUrl : ''
                }).catch(() => {
                    showNotification('Berbagi lokasi dibatalkan', 'info');
                });
            } else {
                // Fallback untuk browser yang tidak support Web Share API
                const fallbackText = `${shareText}\n${isValidCoords ? shareUrl : 'Koordinat tidak valid.'}`;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(fallbackText).then(() => {
                        showNotification('Link lokasi berhasil disalin!', 'success');
                    }).catch(() => {
                        fallbackCopyText(fallbackText);
                    });
                } else {
                    fallbackCopyText(fallbackText);
                }
            }
        };
    }

    // Update map preview
    if (mapPreview) {
        if (isValidCoords) {
            mapPreview.innerHTML = `
                <div class="map-placeholder">
                    <img src="${getGoogleMapsStaticUrl(lat, lng)}" alt="Map Preview" style="width: 100%; height: 100%; object-fit: cover;">
                    <div class="map-overlay">
                        <button class="btn-open-maps" onclick="openLocationInGoogleMaps(${lat}, ${lng}, '${location.name.replace(/'/g, "\\'")}')">
                            <span class="map-icon">🗺️</span>
                            Buka di Google Maps
                        </button>
                    </div>
                    <div class="map-coordinates">
                        <small>Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
                    </div>
                </div>
            `;
        } else {
            mapPreview.innerHTML = `
                <div class="map-placeholder">
                    <div class="map-loading">Koordinat GPS tidak valid. Tidak dapat menampilkan peta.</div>
                </div>
            `;
        }
    }

    // Tampilkan modal
    modal.style.display = 'flex';
}

function closeGPSModal() {
    const modal = document.getElementById('gpsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fallback untuk copy text
function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showNotification('Koordinat/Alamat berhasil disalin!', 'success');
    } catch (err) {
        showNotification('Gagal menyalin koordinat', 'error');
    }
    document.body.removeChild(textArea);
}

// Fungsi untuk generate koordinat dummy (untuk demo)
function generateDummyCoordinates() {
    // Koordinat sekitar Jakarta
    const baseLat = -6.2;
    const baseLng = 106.8;
    
    return {
        lat: parseFloat((baseLat + (Math.random() - 0.5) * 0.1).toFixed(6)),
        lng: parseFloat((baseLng + (Math.random() - 0.5) * 0.1).toFixed(6))
    };
}

// === INTEGRASI GPS DENGAN JOB LIST ===

function addGPSButtonsToJobList() {
    // Tambahkan tombol GPS ke setiap job item
    const jobItems = document.querySelectorAll('.job-item, .job-preview-card');
    
    jobItems.forEach(jobItem => {
        const jobId = jobItem.querySelector('.job-id, .job-preview-id')?.textContent.replace('#', '');
        if (!jobId) return;
        
        // Cek apakah tombol GPS sudah ada
        const existingButtons = jobItem.querySelector('.gps-buttons');
        // Jika sudah ada, jangan tambahkan lagi
        if (existingButtons && existingButtons.closest('.job-item, .job-preview-card') === jobItem) return;
        
        const jobDetails = jobItem.querySelector('.job-details');
        const jobPreviewRoute = jobItem.querySelector('.job-preview-route');
        
        const gpsButtons = document.createElement('div');
        gpsButtons.className = 'gps-buttons';
        gpsButtons.innerHTML = `
            <button class="gps-small-btn" onclick="showGPSModal('${jobId}', 'pickup')" title="Lokasi Pickup">
                <span class="gps-icon">📍</span>
            </button>
            <button class="gps-small-btn" onclick="showGPSModal('${jobId}', 'delivery')" title="Lokasi Delivery">
                <span class="gps-icon">🏠</span>
            </button>
        `;
        
        if (jobPreviewRoute) {
            jobPreviewRoute.parentNode.insertBefore(gpsButtons, jobPreviewRoute.nextSibling);
        } else if (jobDetails) {
            // Di halaman Jobs, masukkan di dalam job-details setelah data lain
            const lastDetail = jobDetails.lastElementChild;
            if (lastDetail && lastDetail.tagName === 'P') {
                lastDetail.after(gpsButtons);
            } else {
                jobDetails.appendChild(gpsButtons);
            }
        }
    });
}

// === INITIALIZE GPS SYSTEM ===

function initGPSSystem() {
    console.log('🗺️ Menginisialisasi sistem GPS...');
    
    // Buat modal GPS jika belum ada
    if (!document.getElementById('gpsModal')) {
        createGPSModal();
    }
    
    // Setup event listeners untuk GPS
    setupGPSEventListeners();
    
    // Coba dapatkan lokasi saat ini
    getCurrentLocation().then(location => {
        console.log('📍 Lokasi saat ini:', location);
        showNotification('Lokasi GPS berhasil didapatkan', 'success');
    }).catch(error => {
        console.warn('⚠️ Tidak bisa dapatkan lokasi:', error.message);
        // showNotification('Tidak bisa mengakses GPS: ' + error.message, 'warning'); // Kurangi notifikasi di awal
    });
    
    // Tambahkan kontrol GPS ke halaman pengiriman aktif
    const activeDeliveryContent = document.querySelector('#active-delivery .main-content');
    if (activeDeliveryContent && !document.getElementById('gpsControls')) {
        const gpsControlsDiv = document.createElement('div');
        gpsControlsDiv.id = 'gpsControls';
        gpsControlsDiv.className = 'gps-controls';
        gpsControlsDiv.innerHTML = `
            <button class="gps-control-btn start" onclick="startLocationTracking()">
                <span class="btn-icon">▶️</span> Mulai Tracking GPS
            </button>
            <button class="gps-control-btn stop" style="display:none;" onclick="stopLocationTracking()">
                <span class="btn-icon">⏹️</span> Hentikan Tracking GPS
            </button>
        `;
        activeDeliveryContent.prepend(gpsControlsDiv);
    }
}

function createGPSModal() {
    // Pastikan modal GPS hanya dibuat sekali
    if (document.getElementById('gpsModal')) return;

    const modalHTML = `
        <div class="modal-overlay" id="gpsModal" style="display: none;">
            <div class="modal-content gps-modal">
                <button class="close-modal" onclick="closeGPSModal()">✕</button>
                <h3 id="gpsModalTitle">Lokasi GPS</h3>
                
                <div class="gps-info">
                    <div class="location-name" id="gpsLocationName" style="font-weight: 700; font-size: 1.2rem; margin-bottom: 8px;">Loading...</div>
                    <div class="location-address" id="gpsLocationAddress" style="color: var(--text-secondary); margin-bottom: 20px;">Loading...</div>
                    
                    <a href="#" class="gps-link-btn" id="gpsLinkBtn" target="_blank" style="display: block; text-align: center; padding: 12px; margin-bottom: 16px; background: var(--info); color: white; border-radius: 8px; text-decoration: none;">
                        <span class="gps-icon">🗺️</span> Buka di Google Maps
                    </a>
                    
                    <div class="gps-actions" style="display: flex; gap: 10px; justify-content: space-around;">
                        <button class="btn-copy-gps" id="copyGpsBtn" style="flex: 1; padding: 10px; border: 1px solid var(--primary); background: white; color: var(--primary); border-radius: 8px;">
                            <span class="btn-icon">📋</span> Salin Koordinat
                        </button>
                        <button class="btn-share-gps" id="shareGpsBtn" style="flex: 1; padding: 10px; border: none; background: var(--primary); color: white; border-radius: 8px;">
                            <span class="btn-icon">📤</span> Bagikan Lokasi
                        </button>
                    </div>
                </div>
                
                <div class="map-preview" id="mapPreview" style="margin-top: 20px;">
                    <div class="map-placeholder" style="height: 200px; background: #eee; display: flex; align-items: center; justify-content: center; border-radius: 8px; position: relative;">
                        <div class="map-loading">Memuat peta...</div>
                    </div>
                </div>
                
                <div class="gps-footer" style="text-align: center; margin-top: 16px;">
                    <small>📍 Gunakan untuk navigasi ke lokasi pickup/delivery</small>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function setupGPSEventListeners() {
    // Close modal ketika klik di luar
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('gpsModal');
        if (modal && e.target === modal) {
            closeGPSModal();
        }
    });
    
    // Close modal dengan ESC key
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('gpsModal');
        if (modal && e.key === 'Escape' && modal.style.display === 'flex') {
            closeGPSModal();
        }
    });
}

// === UPDATE EXISTING FUNCTIONS UNTUK INTEGRASI GPS ===

// Update fungsi loadJobs untuk menambahkan tombol GPS
const originalLoadJobs = loadJobs;
loadJobs = function() {
    originalLoadJobs();
    // Tunggu sebentar agar DOM ter-render dulu
    setTimeout(() => {
        addGPSButtonsToJobList();
    }, 100);
};

// Update fungsi acceptJob untuk inisialisasi GPS
const originalAcceptJob = acceptJob;
acceptJob = function(jobId) {
    originalAcceptJob(jobId);
    // Setelah menerima job, pastikan GPS tracking aktif
    setTimeout(() => {
        startLocationTracking();
    }, 2000);
};

// Update fungsi completeDelivery untuk menghentikan tracking
const originalCompleteDelivery = completeDelivery;
completeDelivery = function() {
    originalCompleteDelivery();
    // Setelah selesai, hentikan tracking
    stopLocationTracking();
};

// === TELEPHONE FUNCTIONS ===

function callCustomer(jobId) {
    console.log('📞 [TELEPON] Memulai panggilan ke customer untuk job:', jobId);
    
    if (!jobId) {
        showNotification('Tidak ada job yang aktif untuk dipanggil', 'error');
        return;
    }

    const activeJob = courierState.activeDeliveries.find(job => job.id === jobId) || 
                     courierState.jobs.find(job => job.id === jobId);
    
    console.log('📞 Job details:', activeJob);

    if (!socket || socket.disconnected) {
        showNotification('Koneksi backend terputus. Tidak dapat melakukan panggilan.', 'error');
        return;
    }

    console.log('📞 [TELEPON] Mengirim request nomor customer untuk job:', jobId);
    
    showNotification('Mencari nomor customer...', 'info');
    
    socket.emit('get_customer_phone', { 
        jobId: jobId,
        timestamp: Date.now()
    });

    const callTimeout = setTimeout(() => {
        showNotification('Timeout: Tidak dapat mendapatkan nomor customer', 'error');
    }, 10000);

    socket.once('customer_phone_received', function(data) {
        clearTimeout(callTimeout);
        handlePhoneResponse(data, jobId);
    });
}

function handlePhoneResponse(data, jobId) {
    console.log('📞 Response telepon:', data);
    
    if (data && data.success && data.phone) {
        const formattedPhone = formatPhoneForCall(data.phone);
        const telUrl = `tel:${formattedPhone}`;
        
        console.log('🔗 Membuka telepon:', telUrl);
        
        window.location.href = telUrl;
        showNotification(`Membuka panggilan ke ${formattedPhone}`, 'success');
    } else {
        const errorMsg = data?.error || 'Nomor tidak tersedia';
        console.error('❌ Error telepon:', errorMsg);
        showNotification(`Gagal memanggil: ${errorMsg}`, 'error');
    }
}

function formatPhoneForCall(phone) {
    let cleaned = phone.replace(/\D/g, '');
    
    console.log('📞 Formatting phone:', cleaned);
    
    if (cleaned.startsWith('62')) {
        const localFormat = '0' + cleaned.substring(2);
        console.log('📞 Converted 62 to local:', localFormat);
        return localFormat;
    }
    
    if (cleaned.length >= 10 && cleaned.length <= 12 && !cleaned.startsWith('0')) {
        const localFormat = '0' + cleaned;
        console.log('📞 Added leading 0:', localFormat);
        return localFormat;
    }
    
    console.log('📞 Using original format:', cleaned);
    return cleaned;
}

// === CHAT FUNCTIONS ===

function showChatModal(jobId) {
    console.log('💬 Membuka chat modal untuk job:', jobId);
    
    const modal = document.getElementById('chatModal');
    const jobIdEl = document.getElementById('chatJobId');
    
    if (!modal || !jobIdEl) {
        console.error('Element chat modal tidak ditemukan');
        return;
    }
    
    currentChatJobId = jobId;
    jobIdEl.textContent = jobId;
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.value = '';
    
    if (socket) {
        console.log('📥 Meminta history chat untuk:', jobId);
        socket.emit('get_chat_history', { jobId: jobId });
    }
    
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    loadChatMessages(jobId);
}

function closeChatModal() {
    const modal = document.getElementById('chatModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function loadChatMessages(jobId) {
    const chatMessagesEl = document.getElementById('chatMessages');
    if (!chatMessagesEl) return;
    
    const messages = chatMessages[jobId] || [];
    console.log('📨 Memuat pesan untuk', jobId, ':', messages.length, 'pesan');
    
    chatMessagesEl.innerHTML = '';
    
    if (messages.length === 0) {
        chatMessagesEl.innerHTML = `
            <div class="no-chat-messages">
                Belum ada pesan. Mulai percakapan dengan customer.
            </div>
        `;
        return;
    }
    
    messages.forEach(msg => {
        const messageElement = createMessageElement(msg);
        chatMessagesEl.appendChild(messageElement);
    });
    
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function createMessageElement(messageData) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${messageData.sender === 'courier' ? 'sent' : 'received'}`;
    
    const time = new Date(messageData.timestamp).toLocaleTimeString('id-ID', { 
        hour: '2-digit', minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-bubble">${messageData.message}</div>
        <div class="message-footer">
            <span class="message-time">${time}</span>
            ${messageData.sender === 'courier' ? '<span class="message-status read">✓✓</span>' : ''}
        </div>
    `;
    
    return messageDiv;
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    const message = input.value.trim();
    
    if (!message || !currentChatJobId) return;
    
    const tempMessage = {
        id: 'temp_' + Date.now(),
        sender: 'courier',
        message: message,
        timestamp: new Date(),
        type: 'sent'
    };
    
    addMessageToChat(currentChatJobId, tempMessage);
    input.value = '';
    
    if (socket) {
        socket.emit('send_message', {
            jobId: currentChatJobId,
            message: message
        });
    }
}

function addMessageToChat(jobId, messageData) {
    if (!chatMessages[jobId]) {
        chatMessages[jobId] = [];
    }
    
    chatMessages[jobId] = chatMessages[jobId].filter(msg => 
        !(msg.id && messageData.id && msg.id === messageData.id)
    );
    
    chatMessages[jobId].push(messageData);
    
    chatMessages[jobId].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (currentChatJobId === jobId) {
        loadChatMessages(jobId);
    }
}

// === SOCKET EVENT LISTENERS ===

function setupSocketListeners() {
    if (!socket) return;
    
    console.log('🔧 Setup semua socket listeners termasuk telepon biasa');
    
    socket.off('new_job_available');
    socket.on('new_job_available', (job) => {
        console.log('📦 Menerima pesanan baru dari admin:', job);
        
        const existingJobIndex = courierState.jobs.findIndex(j => j.id === job.id);
        if (existingJobIndex === -1) {
            const formattedJob = {
                id: job.id,
                pickup: job.pickup,
                delivery: job.delivery,
                distance: job.distance,
                estimate: job.estimate,
                payment: job.payment,
                status: 'new',
                createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
                customer: job.customer || { id: 'CUST'+job.id, name: job.customerName || 'Customer' },
                priority: job.priority || 'standard'
            };
            
            courierState.jobs.push(formattedJob);
            updateBadges();
            loadJobs();
            showNotification(`📢 Pesanan baru #${job.id} dari Admin! (Rp ${job.payment.toLocaleString('id-ID')})`, 'info');
        }
    });

    socket.off('initial_jobs');
    socket.on('initial_jobs', (jobs) => {
        console.log('📦 Received initial jobs from server:', jobs);
        if (jobs && jobs.length > 0) {
            const formattedJobs = jobs.map(job => ({
                id: job.id,
                pickup: job.pickup,
                delivery: job.delivery,
                distance: job.distance,
                estimate: job.estimate,
                payment: job.payment,
                status: 'new',
                createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
                customer: job.customer || { id: 'CUST'+job.id, name: job.customerName || 'Customer' },
                priority: job.priority || 'standard'
            }));
            
            courierState.jobs = formattedJobs;
            updateBadges();
            loadJobs();
            showNotification(`✅ Loaded ${jobs.length} pesanan dari server`, 'success');
        }
    });

    socket.off('customer_phone_received');
    socket.on('customer_phone_received', function handleCustomerPhone(data) {
        console.log('📞 [CLIENT] Response customer_phone_received:', data);
        
        if (data && data.success && data.phone) {
            const formattedPhone = formatPhoneForCall(data.phone);
            const telUrl = `tel:${formattedPhone}`;
            
            console.log('🔗 Telepon biasa URL:', telUrl);
            console.log('📞 Memanggil customer:', formattedPhone);
            
            window.location.href = telUrl;
            
            showNotification(`Membuka panggilan ke customer ${formattedPhone}...`, 'success');
            
        } else {
            const errorMsg = data?.error || 'Tidak dapat mendapatkan nomor customer';
            console.error('❌ Error telepon:', errorMsg);
            showNotification(`Gagal memanggil customer: ${errorMsg}`, 'error');
        }
    });
    
    socket.off('new_message');
    socket.off('message_sent');
    socket.off('chat_history');
    
    socket.on('new_message', (data) => {
        console.log('📨 Pesan baru dari server:', data);
        
        if (data && data.jobId && data.message) {
            const messageData = data.message;
            console.log(`💬 Memproses pesan untuk job ${data.jobId}:`, messageData);
            
            addMessageToChat(data.jobId, messageData);
            
            if (currentChatJobId !== data.jobId) {
                showNotification(`Pesan baru dari Customer #${data.jobId}`, 'info');
            }
        } else {
            console.error('❌ Struktur data new_message tidak valid:', data);
        }
    });
    
    socket.on('message_sent', (data) => {
        console.log('✅ Konfirmasi pengiriman pesan:', data);
        
        if (data.success && data.message) {
            addMessageToChat(data.jobId, data.message);
        } else if (!data.success) {
            showNotification(`Gagal mengirim pesan: ${data.error}`, 'error');
        }
    });
    
    socket.on('chat_history', (data) => {
        console.log('📂 Menerima history chat:', data);
        if (data.jobId && data.messages) {
            chatMessages[data.jobId] = data.messages;
            if (currentChatJobId === data.jobId) {
                loadChatMessages(data.jobId);
            }
        }
    });

    socket.off('whatsapp_status');
    socket.on('whatsapp_status', (data) => {
        console.log('WhatsApp Status:', data);
        if (data && data.status) {
            updateWhatsAppStatusUI(data.status);
            // === LOGIKA QR CODE YANG DIPERBAIKI ===
            if (data.status === 'qr_received' && data.qr) {
                showQRCodeModal(data.qr);
                showNotification('Harap scan QR Code WhatsApp Anda.', 'warning');
            } else if (data.status === 'connected') {
                closeQRCodeModal();
                showNotification('WhatsApp berhasil terhubung!', 'success');
            } else if (data.status === 'disconnected') {
                 closeQRCodeModal();
                 showNotification('WhatsApp terputus, coba lagi.', 'error');
            }
            // =================================
        }
    });

    socket.offAny();
    socket.onAny((eventName, ...args) => {
        if (eventName !== 'customer_phone_received') {
            console.log(`🔍 [CLIENT] Socket Event: ${eventName}`, args);
        }
    });
}

function initChatSystem() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
    
    document.addEventListener('click', function(e) {
        const callBtn = e.target.closest('.call-customer-btn');
        if (callBtn) {
            e.preventDefault();
            console.log('🔘 Call button clicked, currentChatJobId:', currentChatJobId);
            
            if (currentChatJobId) {
                callBtn.classList.add('ringing');
                setTimeout(() => {
                    callBtn.classList.remove('ringing');
                }, 500);
                
                callCustomer(currentChatJobId);
            } else {
                console.error('❌ No currentChatJobId available');
                showNotification('Tidak ada customer yang aktif untuk dipanggil', 'error');
            }
        }
    });
}

// --- UTILITY FUNCTIONS ---

function showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.prepend(notification);
    
    setTimeout(() => {
        notification.classList.add('hide');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 5000);
}

function updateWhatsAppStatusUI(status) {
    const statusElement = document.getElementById('whatsappStatusText');
    const dotElement = document.getElementById('whatsappStatusDot');
    const headerDotElement = document.querySelector('.header-left .status-dot');
    const headerTextElement = document.querySelector('.header-left .status-text');
    
    if (!statusElement) return;

    whatsappStatus = status;
    statusElement.textContent = `WhatsApp: ${status.toUpperCase().replace('_', ' ')}`;
    
    if (dotElement) {
        dotElement.className = 'status-dot';
        if (status === 'connected') {
            dotElement.classList.add('online');
        } else if (status === 'qr_received' || status === 'connecting') {
            dotElement.classList.add('warning');
        } else {
            dotElement.classList.add('offline');
        }
    }

    if (headerDotElement && headerTextElement) {
        headerDotElement.className = 'status-dot';
        
        if (courierState.onlineMode) {
            if (status === 'connected') {
                headerDotElement.classList.add('online');
                headerTextElement.textContent = 'Online';
            } else {
                headerDotElement.classList.add('warning');
                headerTextElement.textContent = 'WA Disconnect'; // Perbarui teks agar lebih jelas
            }
        } else {
            headerDotElement.classList.add('offline');
            headerTextElement.textContent = 'Offline';
        }
    }
}

// === FUNGSI PERBAIKAN UTAMA QR CODE ===
function showQRCodeModal(qrData) {
    const modal = document.getElementById('qrCodeModal');
    const qrImage = document.getElementById('qrCodeImage');
    const qrStatusText = document.getElementById('qrStatusText');
    
    if (modal && qrImage) {
        // Hapus src sebelumnya untuk memaksa browser memuat ulang
        qrImage.src = ''; 
        
        // Atur src ke data URL QR Code dari backend
        qrImage.src = qrData; 
        
        qrStatusText.textContent = 'QR Code tersedia. Scan sekarang!';
        
        // Tampilkan modal
        modal.style.display = 'flex';
        modal.classList.add('active'); 
    }
}

function closeQRCodeModal() {
    const modal = document.getElementById('qrCodeModal');
    if (modal) {
        modal.classList.remove('active');
        // Sembunyikan setelah transisi (jika ada)
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}
// =====================================

function updateBadges() {
    const jobCount = courierState.jobs.length;
    const badgeElementSidebar = document.querySelector('.sidebar-nav .nav-item[data-page="jobs"] .nav-badge');
    const badgeElementDashboard = document.getElementById('jobsBadge');
    const jobsCountElement = document.getElementById('jobsCount');
    
    if (badgeElementSidebar) {
        badgeElementSidebar.textContent = jobCount;
        badgeElementSidebar.style.display = jobCount > 0 ? 'flex' : 'none';
    }
    if (badgeElementDashboard) {
        badgeElementDashboard.textContent = jobCount;
    }
    if (jobsCountElement) {
        jobsCountElement.textContent = jobCount + ' pesanan';
    }
    
    const balanceElement = document.querySelector('.balance-amount');
    if (balanceElement) {
         balanceElement.textContent = `Rp ${courierState.balance.toLocaleString('id-ID')}`;
    }
}

function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    const jobsPreviewList = document.getElementById('jobsPreviewList');
    if (!jobsList || !jobsPreviewList) return;
    
    jobsList.innerHTML = '';
    jobsPreviewList.innerHTML = '';

    if (courierState.jobs.length === 0) {
        jobsList.innerHTML = '<div class="no-data">Tidak ada pesanan baru saat ini.</div>';
        jobsPreviewList.innerHTML = '<div class="no-data">Tidak ada pesanan baru.</div>';
        return;
    }

    const sortedJobs = [...courierState.jobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    sortedJobs.forEach(job => {
        const jobItem = document.createElement('div');
        jobItem.className = `job-item ${job.priority === 'urgent' ? 'urgent' : ''}`;
        jobItem.innerHTML = `
            <div class="job-info">
                <span class="job-id">#${job.id}</span>
                <span class="job-time">${new Date(job.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="job-details">
                <p><strong>Pickup:</strong> ${job.pickup.name} - ${job.pickup.address.substring(0, 30)}...</p>
                <p><strong>Delivery:</strong> ${job.delivery.name} - ${job.delivery.address.substring(0, 30)}...</p>
                <p><strong>Jarak:</strong> ${job.distance} | <strong>Est. Waktu:</strong> ${job.estimate}</p>
            </div>
            <div class="job-actions">
                <button class="btn btn-accept" onclick="acceptJob('${job.id}')">TERIMA (Rp ${job.payment.toLocaleString('id-ID')})</button>
                <button class="btn btn-reject" onclick="rejectJob('${job.id}')">TOLAK</button>
            </div>
        `;
        jobsList.appendChild(jobItem);
    });
    
    // Panggil ulang untuk menambahkan tombol GPS setelah elemen diisi
    setTimeout(() => addGPSButtonsToJobList(), 0);

    sortedJobs.slice(0, 2).forEach(job => {
        const previewCard = document.createElement('div');
        previewCard.className = `job-preview-card ${job.priority === 'urgent' ? 'urgent' : ''}`;
        previewCard.innerHTML = `
            <div class="job-preview-header">
                <div class="job-meta">
                    <span class="job-preview-id">#${job.id}</span>
                    <span class="job-time">${new Date(job.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <span class="job-preview-badge ${job.priority === 'urgent' ? 'urgent' : ''}">${job.priority === 'urgent' ? 'URGENT' : 'STANDARD'}</span>
            </div>
            <div class="job-preview-route">
                <div class="route-from">
                    <span class="route-icon">🏪</span>
                    <span class="route-text">${job.pickup.name}</span>
                </div>
                <span class="route-arrow">→</span>
                <div class="route-to">
                    <span class="route-icon">🏠</span>
                    <span class="route-text">${job.delivery.name}</span>
                </div>
            </div>
            <div class="job-preview-details">
                <div class="detail">
                    <span class="detail-label">Jarak:</span>
                    <span class="detail-value">${job.distance}</span>
                </div>
                <div class="detail">
                    <span class="detail-label">Estimasi:</span>
                    <span class="detail-value">${job.estimate}</span>
                </div>
            </div>
            <div class="job-preview-footer">
                <span class="job-preview-price">Rp ${job.payment.toLocaleString('id-ID')}</span>
                <button class="view-job-btn" onclick="showPage('jobs')">Ambil</button>
            </div>
        `;
        jobsPreviewList.appendChild(previewCard);
    });
    
    // Panggil ulang untuk menambahkan tombol GPS setelah elemen diisi
    setTimeout(() => addGPSButtonsToJobList(), 0);
}

function loadHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    historyList.innerHTML = '';

    const filter = document.getElementById('historyFilter');
    const filterValue = filter ? filter.value : 'all';
    const filteredHistory = courierState.history.filter(job => filterValue === 'all' || job.status === filterValue);

    if (filteredHistory.length === 0) {
        historyList.innerHTML = '<div class="no-data">Tidak ada riwayat untuk filter ini.</div>';
        return;
    }

    filteredHistory.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)).forEach(job => {
        const item = document.createElement('div');
        item.className = `history-item ${job.status}`;
        item.innerHTML = `
            <div class="history-header">
                <span class="history-id">#${job.id}</span>
                <span class="history-status ${job.status}">${job.status.toUpperCase()}</span>
            </div>
            <div class="history-details">
                <p>Pickup: ${job.pickup.name}</p>
                <p>Delivery: ${job.delivery.name}</p>
                <p>Pembayaran: <strong>Rp ${job.payment.toLocaleString('id-ID')}</strong></p>
                <span class="history-date">${new Date(job.completedAt || job.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
        `;
        historyList.appendChild(item);
    });
}

function loadEarnings() {
    const totalEarningsEl = document.getElementById('totalEarnings');
    const earningsListEl = document.getElementById('earningsList');
    if (!totalEarningsEl || !earningsListEl) return;
    
    const completedJobs = courierState.history.filter(j => j.status === 'completed');
    const totalEarnings = completedJobs.reduce((sum, job) => sum + job.payment, 0);

    totalEarningsEl.textContent = `Rp ${totalEarnings.toLocaleString('id-ID')}`;
    earningsListEl.innerHTML = '';
    
    if (completedJobs.length === 0) {
        earningsListEl.innerHTML = '<div class="no-data">Belum ada transaksi bulan ini.</div>';
        return;
    }
    
    completedJobs.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).forEach(job => {
        const item = document.createElement('div');
        item.className = 'earning-item';
        item.innerHTML = `
            <div class="earning-details">
                <div class="earning-description">Pengiriman #${job.id} Selesai</div>
                <div class="earning-date">${new Date(job.completedAt).toLocaleDateString('id-ID')}</div>
            </div>
            <div class="earning-amount">+ Rp ${job.payment.toLocaleString('id-ID')}</div>
        `;
        earningsListEl.appendChild(item);
    });
}

function updateActiveDeliveryUI() {
    const activeDeliveryCard = document.getElementById('activeDeliveryCard');
    const fullDeliveryCard = document.getElementById('fullDeliveryCard');
    const deliveryActions = document.getElementById('deliveryActions');
    const timerElement = document.getElementById('deliveryTimer');
    const gpsControls = document.getElementById('gpsControls');

    if (courierState.activeDeliveries.length > 0) {
        const activeDelivery = courierState.activeDeliveries[0];
        
        if (activeDeliveryCard) activeDeliveryCard.style.display = 'block';
        // GPS Controls akan dihidupkan/dimatikan di fungsi updateGPSControls
        
        // Pengecekan Null untuk elemen di dashboard preview
        const previewIdEl = activeDeliveryCard ? activeDeliveryCard.querySelector('.delivery-id') : null;
        const previewPriorityEl = activeDeliveryCard ? activeDeliveryCard.querySelector('.priority-badge') : null;
        
        if (previewIdEl) previewIdEl.textContent = `#${activeDelivery.id}`;
        if (previewPriorityEl) {
             previewPriorityEl.textContent = activeDelivery.priority.toUpperCase();
             previewPriorityEl.className = `priority-badge ${activeDelivery.priority}`;
        }

        if (fullDeliveryCard) {
            fullDeliveryCard.innerHTML = `
                <div class="delivery-card">
                    <div class="delivery-header">
                        <span class="delivery-id">#${activeDelivery.id}</span>
                        <span class="delivery-status-badge">ON DELIVERY</span>
                    </div>
                    <div class="delivery-locations">
                        <div class="location-row">
                            <span class="location-icon"><i class="fas fa-store"></i></span>
                            <div class="location-details">
                                <div class="location-type">PICKUP DARI</div>
                                <div class="location-address">${activeDelivery.pickup.name} (${activeDelivery.pickup.address})</div>
                                <button class="gps-action-btn" onclick="showGPSModal('${activeDelivery.id}', 'pickup')">
                                    <span class="gps-icon">📍</span> Lihat Lokasi
                                </button>
                            </div>
                        </div>
                        <div class="location-row">
                            <span class="location-icon end"><i class="fas fa-map-marker-alt"></i></span>
                            <div class="location-details">
                                <div class="location-type">TUJUAN KE</div>
                                <div class="location-address">${activeDelivery.delivery.name} (${activeDelivery.delivery.address})</div>
                                <button class="gps-action-btn" onclick="showGPSModal('${activeDelivery.id}', 'delivery')">
                                    <span class="gps-icon">🏠</span> Lihat Lokasi
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="delivery-metrics">
                        <div class="metric-item">
                            <div class="metric-value">${activeDelivery.distance}</div>
                            <div class="metric-label">Jarak</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">${activeDelivery.estimate}</div>
                            <div class="metric-label">Estimasi</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">Rp ${activeDelivery.payment.toLocaleString('id-ID')}</div>
                            <div class="metric-label">Pembayaran</div>
                        </div>
                    </div>
                </div>
            `;
            fullDeliveryCard.classList.remove('no-data');
        }
        
        if (deliveryActions) deliveryActions.style.display = 'flex';
        
        const startedAt = activeDelivery.startedAt ? new Date(activeDelivery.startedAt) : new Date();
        
        function updateActiveDeliveryTimer() {
            // CRITICAL NULL CHECK: Keluar jika job sudah selesai (mencegah error di acceptJob)
            if (courierState.activeDeliveries.length === 0) {
                if (window.deliveryTimerInterval) {
                    clearInterval(window.deliveryTimerInterval);
                    window.deliveryTimerInterval = null;
                }
                return;
            }

            const now = new Date();
            const elapsed = Math.floor((now - startedAt) / 1000);
            const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
            const seconds = String(elapsed % 60).padStart(2, '0');
            
            const timerEl = document.getElementById('deliveryTimer');
            if (timerEl) {
                timerEl.textContent = `${hours}:${minutes}:${seconds}`;
            }

            const progressBar = document.getElementById('routeProgress');
            const courierMarker = document.querySelector('.current-position');
            
            // Pengecekan Null untuk elemen di dashboard preview
            const dashboardDistanceEl = document.querySelector('.delivery-preview-card .detail-item:nth-child(1) .detail-value');
            const dashboardTimeEl = document.querySelector('.delivery-preview-card .detail-item:nth-child(2) .detail-value');

            if (progressBar && courierMarker && dashboardDistanceEl && dashboardTimeEl) {
                // Simulasi pergerakan sederhana
                const distanceValue = parseFloat(activeDelivery.distance.split(' ')[0] || 5);
                const timeValue = parseInt(activeDelivery.estimate.split(' ')[0] || 15);
                
                // Hitung progres berdasarkan waktu berlalu (simulasi)
                const totalDurationInSeconds = timeValue * 60;
                let simulatedProgress = Math.min(100, (elapsed / totalDurationInSeconds) * 100);
                
                // Batasi visual progress 10% - 90%
                simulatedProgress = Math.min(90, Math.max(10, simulatedProgress));

                progressBar.style.width = `${simulatedProgress}%`;
                courierMarker.style.left = `${simulatedProgress}%`;
                
                // Update detail preview 
                const distanceRemaining = (distanceValue * (1 - simulatedProgress / 100)).toFixed(1);
                const timeRemaining = Math.max(1, Math.floor(timeValue * (1 - simulatedProgress / 100)));
                
                dashboardDistanceEl.textContent = `${distanceRemaining} km`;
                dashboardTimeEl.textContent = `${timeRemaining} menit`;
            }
        }

        if (window.deliveryTimerInterval) {
            clearInterval(window.deliveryTimerInterval);
        }
        updateActiveDeliveryTimer(); 
        window.deliveryTimerInterval = setInterval(updateActiveDeliveryTimer, 1000);
        updateGPSControls(locationWatchId !== null); // Update status GPS controls

    } else {
        if (activeDeliveryCard) activeDeliveryCard.style.display = 'none';
        if (fullDeliveryCard) {
            fullDeliveryCard.innerHTML = '<div class="no-data">Anda tidak sedang dalam pengiriman aktif.</div>';
            fullDeliveryCard.classList.add('no-data');
        }
        if (deliveryActions) deliveryActions.style.display = 'none';
        if (gpsControls) updateGPSControls(false); // Pastikan GPS controls nonaktif
        
        if (window.deliveryTimerInterval) {
            clearInterval(window.deliveryTimerInterval);
            window.deliveryTimerInterval = null;
        }
    }
}

function completeDelivery() {
    if (courierState.activeDeliveries.length === 0) return;

    // Tambahkan konfirmasi sebelum menyelesaikan
    const isConfirmed = confirm(`Apakah Anda yakin ingin menyelesaikan pengiriman #${courierState.activeDeliveries[0].id}?`);
    
    if (!isConfirmed) return;

    const completedJob = courierState.activeDeliveries.shift();
    completedJob.status = 'completed';
    completedJob.completedAt = new Date();
    
    completedJob.payment = completedJob.payment || 0;
    courierState.balance = (courierState.balance || 0) + completedJob.payment;
    courierState.history.push(completedJob);
    
    const balanceElement = document.querySelector('.balance-amount');
    if (balanceElement) {
         balanceElement.textContent = `Rp ${courierState.balance.toLocaleString('id-ID')}`;
    }

    if (socket) socket.emit('job_completed', { jobId: completedJob.id, courierId: 'courier_001' });

    showNotification(`Pengiriman #${completedJob.id} Selesai! Saldo bertambah.`, 'success');
    updateActiveDeliveryUI();
    showPage('dashboard');
    loadHistory();
    loadEarnings();
}

// --- MAIN LOGIC --- 

function acceptJob(jobId) {
    if (courierState.activeDeliveries.length > 0) {
        showNotification('Anda sudah memiliki pengiriman aktif! Selesaikan dulu.', 'warning');
        return;
    }
    const jobIndex = courierState.jobs.findIndex(job => job.id === jobId);
    if (jobIndex === -1) {
        showNotification('Pesanan tidak ditemukan.', 'error');
        return;
    }
    
    const job = courierState.jobs.splice(jobIndex, 1)[0];
    job.status = 'on_delivery';
    job.startedAt = new Date();
    courierState.activeDeliveries.push(job);
    
    if (socket) {
        socket.emit('job_accepted', { jobId: jobId, courierId: 'courier_001' });
    }
    showNotification(`Pesanan #${jobId} Diterima! Mulai pengiriman.`, 'success');
    updateBadges();
    loadJobs();
    updateActiveDeliveryUI();
    showPage('active-delivery');
}

function rejectJob(jobId) {
    const isConfirmed = confirm(`Anda yakin menolak pesanan #${jobId}? Menolak terlalu sering dapat mempengaruhi rating Anda.`);
    if (!isConfirmed) return;
    
    const jobIndex = courierState.jobs.findIndex(job => job.id === jobId);
    if (jobIndex === -1) return;
    
    const job = courierState.jobs.splice(jobIndex, 1)[0];
    job.status = 'cancelled';
    job.completedAt = new Date();
    courierState.history.push(job);
    
    if (socket) {
        socket.emit('job_rejected', { jobId: jobId, courierId: 'courier_001' });
    }
    showNotification(`Pesanan #${jobId} Ditolak.`, 'warning');
    updateBadges();
    loadJobs();
    loadHistory();
}

function simulateNewJob(showNotif = true) {
    jobIdCounter++;
    const newJobId = 'SIM' + jobIdCounter; 
    const locations = [
        { name: 'Toko Baju A', address: 'Jl. Riau No. 50', distance: '3.5 km', estimate: '18 menit', gps: { lat: -6.210000, lng: 106.813000 } },
        { name: 'Warung Cepat Saji', address: 'Jl. Pemuda No. 101', distance: '2.8 km', estimate: '15 menit', gps: { lat: -6.220000, lng: 106.820000 } },
        { name: 'Gudang Logistik X', address: 'Jl. Raya Bekasi KM 20', distance: '7.2 km', estimate: '35 menit', gps: { lat: -6.150000, lng: 106.900000 } },
        { name: 'Kantor Pusat', address: 'Jl. HR Rasuna Said', distance: '4.1 km', estimate: '22 menit', gps: { lat: -6.225000, lng: 106.830000 } },
    ];
    
    const pickup = locations[Math.floor(Math.random() * locations.length)];
    let delivery;
    do {
        delivery = locations[Math.floor(Math.random() * locations.length)];
    } while (delivery === pickup);
    
    const payment = Math.floor(Math.random() * 80 + 30) * 1000;

    const newJob = {
        id: newJobId,
        pickup: { name: pickup.name, address: pickup.address, gps: pickup.gps },
        delivery: { name: delivery.name, address: delivery.address, gps: delivery.gps },
        distance: pickup.distance, // Menggunakan data simulasi distance/estimate
        estimate: pickup.estimate,
        payment: payment,
        status: 'new',
        createdAt: new Date(),
        customer: { id: 'CUST'+jobIdCounter, name: 'Pelanggan ' + jobIdCounter },
        priority: Math.random() > 0.7 ? 'urgent' : 'standard'
    };
    
    courierState.jobs.push(newJob);
    updateBadges();
    loadJobs();
    if (showNotif) {
        showNotification(`Pesanan baru #${newJobId} tersedia! (Simulasi)`, 'info');
    }
}

function loadOrdersFromBackend() {
    if (courierState.jobs.length === 0) {
        if (!socket || socket.disconnected) {
            simulateNewJob(false);
            simulateNewJob(false);
            showNotification('Koneksi backend terputus, menggunakan data simulasi.', 'warning');
        } else {
            socket.emit('request_initial_data', { courierId: 'courier_001' });
        }
    }
    updateBadges();
    loadJobs();
    loadHistory();
    loadEarnings();
}

// --- SOCKET.IO CONNECTION ---

function connectWebSocket() {
    try {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        console.log('🔄 Menghubungkan ke backend...');
        socket = io(FREE_BACKEND_URL, {
            query: { role: 'courier', courierId: 'courier_001' },
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        socket.on('connect', () => {
            console.log('✅ Connected to FREE backend! Socket ID:', socket.id);
            showNotification('Koneksi backend berhasil!', 'success');
            reconnectAttempts = 0;
            
            if (simulatedJobInterval) {
                clearInterval(simulatedJobInterval);
                simulatedJobInterval = null;
            }
            
            setupSocketListeners();
            
            socket.emit('get_whatsapp_status');
            socket.emit('request_initial_data', { courierId: 'courier_001' });
        });

        socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from FREE backend:', reason);
            updateWhatsAppStatusUI('disconnected');
            showNotification('Koneksi backend terputus', 'error');
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`Mencoba reconnect dalam ${delay}ms (percobaan ${reconnectAttempts})`);
                
                setTimeout(() => {
                    if (!socket || socket.disconnected) {
                        connectWebSocket();
                    }
                }, delay);
            } else {
                console.log('Max reconnection attempts reached. Using simulation mode.');
                if (!simulatedJobInterval) {
                    simulatedJobInterval = setInterval(() => simulateNewJob(), 30000);
                }
            }
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            showNotification('Gagal terhubung ke backend', 'error');
            updateWhatsAppStatusUI('disconnected');
        });

    } catch (error) {
        console.error('Error connecting to Socket.IO:', error);
        showNotification('Gagal terhubung ke Socket.IO. Menggunakan mode simulasi.', 'error');
        updateWhatsAppStatusUI('disconnected');
        
        if (!simulatedJobInterval) {
            simulatedJobInterval = setInterval(() => simulateNewJob(), 30000);
        }
    }
}

// --- NAVIGATION & UI HANDLERS ---
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    const activePage = document.getElementById(pageId);
    if (activePage) {
        activePage.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        if (pageId === 'jobs') loadJobs();
        if (pageId === 'history') loadHistory();
        if (pageId === 'earnings') loadEarnings();
        if (pageId === 'active-delivery') updateActiveDeliveryUI();
        // === AKTIVASI FITUR PLACEHOLDER ===
        if (pageId === 'profile') {
             console.log('👤 Memuat halaman profil...');
             showNotification('Halaman Profil dimuat!', 'info');
        }
        if (pageId === 'performance') {
             console.log('📈 Memuat halaman performa...');
             showNotification('Halaman Performa dimuat (Data Simulasi)', 'info');
        }
        if (pageId === 'settings') {
             console.log('⚙️ Memuat halaman pengaturan...');
             showNotification('Halaman Pengaturan dimuat', 'info');
        }
        if (pageId === 'help') {
             console.log('🆘 Memuat halaman bantuan...');
             showNotification('Halaman Bantuan dimuat', 'info');
        }
        // =================================
        
        if (pageId === 'dashboard') {
            const currentDateEl = document.getElementById('currentDate');
            if (currentDateEl) {
                const now = new Date();
                currentDateEl.textContent = now.toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
        }
    }
}

function initCourierApp() {
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('active');
            document.getElementById('overlay').classList.add('active');
        });
    }
    
    const closeSidebar = document.getElementById('closeSidebar');
    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('overlay').classList.remove('active');
        });
    }
    
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('overlay').classList.remove('active');
        });
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            showPage(pageId);
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('overlay').classList.remove('active');
        });
    });

    const statusToggle = document.getElementById('statusToggle');
    if (statusToggle) {
        statusToggle.addEventListener('change', function() {
            courierState.onlineMode = this.checked;
            showNotification(`Mode ${this.checked ? 'Online' : 'Offline'}`, this.checked ? 'success' : 'warning');
            updateWhatsAppStatusUI(whatsappStatus);
            
            // Jika mode online diaktifkan dan terputus, coba sambungkan kembali
            if (this.checked && (!socket || socket.disconnected)) {
                connectWebSocket();
            }
        });
    }
    
    if (!document.getElementById('notificationContainer')) {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        document.body.appendChild(container);
    }
    
    updateBadges();
    loadHistory(); 
    loadEarnings();
    updateActiveDeliveryUI();
    
    initChatSystem();
    initGPSSystem();
    
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        const now = new Date();
        currentDateEl.textContent = now.toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Courier App...');
    initCourierApp();
    // Panggil connectWebSocket di sini
    connectWebSocket(); 
});

// === ERROR BOUNDARY UNTUK HANDLE GLOBAL ERRORS ===
window.addEventListener('error', function(e) {
    console.error('🔥 Global Error:', e.error);
    // showNotification('Terjadi error di sistem: ' + e.error?.message, 'error'); // Menonaktifkan notif global error untuk debugging yang lebih bersih
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('🔥 Unhandled Promise Rejection:', e.reason);
    // showNotification('Terjadi error: ' + e.reason?.message, 'error'); // Menonaktifkan notif global error
});