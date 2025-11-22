// courier-app.js - VERSI LENGKAP DENGAN SIMULASI BACKEND SOCKET.IO/RAILWAY

// GANTI DENGAN URL BACKEND ANDA DI RAILWAY YANG SUDAH JALAN (PASTIKAN MENGGUNAKAN https://)!
// Contoh: 'https://nama-aplikasi-anda.up.railway.app'
const FREE_BACKEND_URL = 'https://backend-production-e12e5.up.railway.app';

let socket = null;
let whatsappStatus = 'disconnected';
let courierState = {
    jobs: [], // Pesanan baru (belum diterima)
    history: [], // Riwayat (completed/cancelled)
    balance: 185000,
    activeDeliveries: [], // Pesanan yang sedang dikerjakan
    onlineMode: true,
};
let jobIdCounter = 1000;
let simulatedJobInterval = null;

// Di courier-app.js - TAMBAHKAN FUNGSI BERIKUT:

// === VARIABLES UNTUK CHAT ===
let currentChatJobId = null;
let chatMessages = {};

// === SHOW CHAT MODAL (DIPERBAIKI) ===
function showChatModal(jobId) {
    const modal = document.getElementById('chatModal');
    const jobIdEl = document.getElementById('chatJobId');
    const chatMessagesEl = document.getElementById('chatMessages');
    
    currentChatJobId = jobId;
    jobIdEl.textContent = jobId;
    
    // Minta history chat dari server
    if (socket) {
        socket.emit('get_chat_history', { jobId: jobId });
    }
    
    // Tampilkan modal
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    // Load existing messages jika ada
    loadChatMessages(jobId);
}

// === LOAD CHAT MESSAGES ===
function loadChatMessages(jobId) {
    const chatMessagesEl = document.getElementById('chatMessages');
    if (!chatMessagesEl) return;
    
    const messages = chatMessages[jobId] || [];
    chatMessagesEl.innerHTML = '';
    
    messages.forEach(msg => {
        const messageElement = createMessageElement(msg);
        chatMessagesEl.appendChild(messageElement);
    });
    
    // Scroll ke bawah
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// === CREATE MESSAGE ELEMENT ===
function createMessageElement(messageData) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${messageData.type === 'sent' ? 'sent' : 'received'}`;
    
    const time = new Date(messageData.timestamp).toLocaleTimeString('id-ID', { 
        hour: '2-digit', minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
        <div class="message-bubble">${messageData.message}</div>
        <div class="message-footer">
            <span class="message-time">${time}</span>
            ${messageData.type === 'sent' ? '<span class="message-status read">✓✓</span>' : ''}
        </div>
    `;
    
    return messageDiv;
}

// === SEND CHAT MESSAGE (DIPERBAIKI) ===
function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !currentChatJobId) return;
    
    // Tampilkan pesan langsung di UI (optimistic update)
    const tempMessage = {
        id: 'temp_' + Date.now(),
        sender: 'courier',
        message: message,
        timestamp: new Date(),
        type: 'sent'
    };
    
    addMessageToChat(currentChatJobId, tempMessage);
    input.value = '';
    
    // Kirim ke server
    if (socket) {
        socket.emit('send_message', {
            jobId: currentChatJobId,
            message: message
        });
    }
}

// === ADD MESSAGE TO CHAT ===
function addMessageToChat(jobId, messageData) {
    if (!chatMessages[jobId]) {
        chatMessages[jobId] = [];
    }
    
    // Hapus temporary message jika ada
    chatMessages[jobId] = chatMessages[jobId].filter(msg => msg.id !== messageData.id);
    
    // Tambahkan message baru
    chatMessages[jobId].push(messageData);
    
    // Sort by timestamp
    chatMessages[jobId].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Update UI jika chat sedang terbuka
    if (currentChatJobId === jobId) {
        loadChatMessages(jobId);
    }
}

// === SOCKET EVENT LISTENERS (TAMBAHKAN) ===
function setupChatSocketListeners() {
    if (!socket) return;
    
    // Terima pesan baru dari customer
    socket.on('new_message', (data) => {
        console.log('📨 Pesan baru dari customer:', data);
        addMessageToChat(data.jobId, data.message);
        
        // Show notification jika chat tidak sedang terbuka
        if (currentChatJobId !== data.jobId) {
            showNotification(`Pesan baru dari Customer #${data.jobId}`, 'info');
        }
    });
    
    // Konfirmasi pesan terkirim
    socket.on('message_sent', (data) => {
        if (data.success && data.message) {
            addMessageToChat(data.jobId, data.message);
        } else if (!data.success) {
            showNotification(`Gagal mengirim pesan: ${data.error}`, 'error');
        }
    });
    
    // Terima history chat
    socket.on('chat_history', (data) => {
        chatMessages[data.jobId] = data.messages;
        if (currentChatJobId === data.jobId) {
            loadChatMessages(data.jobId);
        }
    });
}

// === INIT CHAT SYSTEM ===
function initChatSystem() {
    // Enter key untuk kirim pesan
    document.getElementById('chatInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    setupChatSocketListeners();
}

// Panggil di initCourierApp()
function initCourierApp() {
    // ... kode existing ...
    
    initChatSystem(); // Tambahkan ini
}
// --- UTILITY FUNCTIONS ---

// Fungsi notifikasi sederhana
function showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.prepend(notification); // Tambah di atas
    
    setTimeout(() => {
        notification.classList.add('hide');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 5000);
}

// Fungsi untuk memperbarui status WhatsApp di UI
function updateWhatsAppStatusUI(status) {
    const statusElement = document.getElementById('whatsappStatusText');
    const dotElement = document.getElementById('whatsappStatusDot');
    const headerDotElement = document.querySelector('.header-left .status-dot');
    const headerTextElement = document.querySelector('.header-left .status-text');
    
    if (!statusElement) return;

    whatsappStatus = status;
    statusElement.textContent = `WhatsApp: ${status.toUpperCase().replace('_', ' ')}`;
    
    // Update Sidebar Dot
    dotElement.className = 'status-dot';
    if (status === 'connected') {
        dotElement.classList.add('online');
    } else if (status === 'qr_received' || status === 'connecting') {
        dotElement.classList.add('warning');
    } else {
        dotElement.classList.add('offline');
    }

    // Update Header Status
    headerDotElement.className = 'status-dot';
    if (courierState.onlineMode) {
        if (status === 'connected') {
            headerDotElement.classList.add('online');
            headerTextElement.textContent = 'Online';
        } else {
            headerDotElement.classList.add('warning');
            headerTextElement.textContent = 'Disconnected';
        }
    } else {
        headerDotElement.classList.add('offline');
        headerTextElement.textContent = 'Offline';
    }
}

// Fungsi Modal QR Code
function showQRCodeModal(qrData) {
    const modal = document.getElementById('qrCodeModal');
    const qrImage = document.getElementById('qrCodeImage');
    const qrStatusText = document.getElementById('qrStatusText');
    if (modal && qrImage) {
        qrImage.src = qrData;
        qrStatusText.textContent = 'QR Code tersedia. Scan sekarang!';
        modal.style.display = 'flex';
    }
}

function closeQRCodeModal() {
    document.getElementById('qrCodeModal').style.display = 'none';
}

// Fungsi untuk memperbarui badge dan count
function updateBadges() {
    const jobCount = courierState.jobs.length;
    const badgeElementSidebar = document.querySelector('.sidebar-nav .nav-item[data-page="jobs"] .nav-badge');
    const jobsCountElement = document.getElementById('jobsCount');
    
    if (badgeElementSidebar) {
        badgeElementSidebar.textContent = jobCount;
        badgeElementSidebar.style.display = jobCount > 0 ? 'flex' : 'none';
    }
    if (jobsCountElement) {
        jobsCountElement.textContent = jobCount;
    }
    
    // Update Balance
    const balanceElement = document.querySelector('.balance-amount');
    if (balanceElement) {
         balanceElement.textContent = `Rp ${courierState.balance.toLocaleString('id-ID')}`;
    }
}

// Fungsi untuk memuat dan menampilkan daftar jobs
function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    const jobsPreviewList = document.getElementById('jobsPreviewList');
    if (!jobsList || !jobsPreviewList) return;
    
    jobsList.innerHTML = '';
    jobsPreviewList.innerHTML = '';

    const sortedJobs = [...courierState.jobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (sortedJobs.length === 0) {
        jobsList.innerHTML = '<div class="no-data">Tidak ada pesanan baru saat ini.</div>';
        jobsPreviewList.innerHTML = '<div class="no-data">Tidak ada pesanan baru.</div>';
        return;
    }

    sortedJobs.forEach((job, index) => {
        // Render di halaman Jobs
        const jobItem = document.createElement('div');
        jobItem.className = 'job-item';
        jobItem.innerHTML = `
            <div class="job-info">
                <span class="job-id">#${job.id}</span>
                <span class="job-time">${new Date(job.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="job-details">
                <p><strong>Pickup:</strong> ${job.pickup.name} - ${job.pickup.address.substring(0, 30)}...</p>
                <p><strong>Delivery:</strong> ${job.delivery.name} - ${job.delivery.address.substring(0, 30)}...</p>
                <p><strong>Jarak:</strong> ${job.distance} km | <strong>Est. Waktu:</strong> ${job.estimate} min</p>
            </div>
            <div class="job-actions">
                <button class="btn btn-accept" onclick="acceptJob('${job.id}')">TERIMA (Rp ${job.payment.toLocaleString('id-ID')})</button>
                <button class="btn btn-reject" onclick="rejectJob('${job.id}')">TOLAK</button>
            </div>
        `;
        jobsList.appendChild(jobItem);

        // Render di Dashboard Preview (max 2)
        if (index < 2) {
            const previewCard = document.createElement('div');
            previewCard.className = `job-preview-card ${job.payment > 50000 ? 'urgent' : ''}`;
            previewCard.innerHTML = `
                <div class="job-preview-header">
                    <span class="job-preview-id">#${job.id}</span>
                    <span class="job-preview-badge">BARU</span>
                </div>
                <div class="job-preview-route">
                    <span class="job-preview-from">${job.pickup.name}</span>
                    <span class="job-preview-arrow">→</span>
                    <span class="job-preview-to">${job.delivery.name}</span>
                </div>
                <div class="job-preview-footer">
                    <span class="job-preview-price">Rp ${job.payment.toLocaleString('id-ID')}</span>
                    <button class="view-job-btn" onclick="showPage('jobs');">Lihat Detail</button>
                </div>
            `;
            jobsPreviewList.appendChild(previewCard);
        }
    });
}

// Fungsi untuk memuat dan menampilkan daftar riwayat (history)
function loadHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    historyList.innerHTML = '';

    const filter = document.getElementById('historyFilter').value;
    const filteredHistory = courierState.history.filter(job => filter === 'all' || job.status === filter);

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

// Fungsi untuk memuat dan menampilkan daftar penghasilan (earnings)
function loadEarnings() {
    const totalEarningsEl = document.getElementById('totalEarnings');
    const earningsListEl = document.getElementById('earningsList');
    if (!totalEarningsEl || !earningsListEl) return;
    
    // Simulasi: Hitung total dari riwayat yang 'completed'
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

// Fungsi untuk memperbarui tampilan pengiriman aktif (Dashboard & Active Delivery Page)
function updateActiveDeliveryUI() {
    const activeDeliveryCard = document.getElementById('activeDeliveryCard');
    const fullDeliveryCard = document.getElementById('fullDeliveryCard');
    const deliveryActions = document.getElementById('deliveryActions');
    const timerElement = document.getElementById('deliveryTimer');

    if (courierState.activeDeliveries.length > 0) {
        const activeDelivery = courierState.activeDeliveries[0];
        
        // Update Dashboard Preview
        activeDeliveryCard.style.display = 'block';
        document.getElementById('deliveryId').textContent = `#${activeDelivery.id}`;
        document.getElementById('deliveryAddress').textContent = activeDelivery.delivery.address.substring(0, 30) + '...';

        // Update Full Delivery Page
        fullDeliveryCard.innerHTML = `
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
                    </div>
                </div>
                <div class="location-row">
                    <span class="location-icon end"><i class="fas fa-map-marker-alt"></i></span>
                    <div class="location-details">
                        <div class="location-type">TUJUAN KE</div>
                        <div class="location-address">${activeDelivery.delivery.name} (${activeDelivery.delivery.address})</div>
                    </div>
                </div>
            </div>
            <div class="delivery-stats">
                <div class="stat-item">
                    <span>Jarak:</span> <strong>${activeDelivery.distance} km</strong>
                </div>
                <div class="stat-item">
                    <span>Estimasi Selesai:</span> <strong>${activeDelivery.estimate} min</strong>
                </div>
                <div class="stat-item">
                    <span>Pembayaran:</span> <strong>Rp ${activeDelivery.payment.toLocaleString('id-ID')}</strong>
                </div>
            </div>
        `;
        fullDeliveryCard.classList.remove('no-data');
        
        deliveryActions.style.display = 'flex';
        
        // Update Timer & Progress
        const startedAt = activeDelivery.startedAt ? new Date(activeDelivery.startedAt) : new Date();
        const duration = (new Date() - startedAt) / 1000;
        
        function updateActiveDeliveryTimer() {
            const now = new Date();
            const elapsed = Math.floor((now - startedAt) / 1000);
            const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
            const seconds = String(elapsed % 60).padStart(2, '0');
            
            if (timerElement) {
                timerElement.textContent = `${hours}:${minutes}:${seconds}`;
            }

            // Simulasi Progress Bar (random 10-90%)
            const progressBar = document.getElementById('routeProgress');
            const courierMarker = document.querySelector('.current-position');
            if (progressBar) {
                const randomProgress = Math.min(90, Math.max(10, Math.floor(Math.random() * 80) + 10)); // 10% to 90%
                progressBar.style.width = `${randomProgress}%`;
                courierMarker.style.left = `${randomProgress}%`;
            }
        }

        if (!window.deliveryTimerInterval) {
            updateActiveDeliveryTimer(); 
            window.deliveryTimerInterval = setInterval(updateActiveDeliveryTimer, 1000);
        }

    } else {
        activeDeliveryCard.style.display = 'none';
        fullDeliveryCard.innerHTML = '<div class="no-data">Anda tidak sedang dalam pengiriman aktif.</div>';
        fullDeliveryCard.classList.add('no-data');
        deliveryActions.style.display = 'none';

        if (window.deliveryTimerInterval) {
            clearInterval(window.deliveryTimerInterval);
            window.deliveryTimerInterval = null;
        }
    }
}

// Tombol Selesai Pengiriman
function completeDelivery() {
    if (courierState.activeDeliveries.length === 0) return;

    const completedJob = courierState.activeDeliveries.shift();
    completedJob.status = 'completed';
    
    courierState.balance += completedJob.payment;
    const balanceElement = document.querySelector('.balance-amount');
    if (balanceElement) {
         balanceElement.textContent = `Rp ${courierState.balance.toLocaleString('id-ID')}`;
    }

    // Kirim event ke backend
    if (socket) socket.emit('job_completed', { jobId: completedJob.id, courierId: 'courier_001' });

    showNotification(`Pengiriman #${completedJob.id} Selesai! Saldo bertambah.`, 'success');
    updateActiveDeliveryUI();
    showPage('dashboard');
    loadHistory(); // Refresh Riwayat
    loadEarnings(); // Refresh Penghasilan
}


// --- MAIN LOGIC --- 

// Fungsi untuk menerima job
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
    
    // Pindahkan job dari jobs ke activeDeliveries
    const job = courierState.jobs.splice(jobIndex, 1)[0];
    job.status = 'on_delivery';
    job.startedAt = new Date(); // Catat waktu mulai
    courierState.activeDeliveries.push(job);
    
    // Kirim event ke backend (jika socket terhubung)
    if (socket) {
        socket.emit('job_accepted', { jobId: jobId, courierId: 'courier_001' });
    }
    showNotification(`Pesanan #${jobId} Diterima! Mulai pengiriman.`, 'success');
    updateBadges();
    loadJobs(); // Refresh daftar jobs
    updateActiveDeliveryUI();
    showPage('active-delivery'); // Pindah ke halaman pengiriman aktif
}

// Fungsi untuk menolak job
function rejectJob(jobId) {
    const jobIndex = courierState.jobs.findIndex(job => job.id === jobId);
    if (jobIndex === -1) return;
    
    // Pindahkan job ke history sebagai 'cancelled'
    const job = courierState.jobs.splice(jobIndex, 1)[0];
    job.status = 'cancelled';
    courierState.history.push(job);
    
    if (socket) {
        socket.emit('job_rejected', { jobId: jobId, courierId: 'courier_001' });
    }
    showNotification(`Pesanan #${jobId} Ditolak.`, 'warning');
    updateBadges();
    loadJobs();
    loadHistory(); // Refresh Riwayat
}

// Fungsi simulasi job baru (hanya berjalan saat offline/disconnected)
function simulateNewJob(showNotif = true) {
    jobIdCounter++;
    const newJobId = 'SIM' + jobIdCounter; 
    const locations = [
        { name: 'Toko Baju A', address: 'Jl. Riau No. 50' },
        { name: 'Warung Cepat Saji', address: 'Jl. Pemuda No. 101' },
        { name: 'Gudang Logistik X', address: 'Jl. Raya Bekasi KM 20' },
        { name: 'Kantor Pusat', address: 'Jl. HR Rasuna Said' },
    ];
    
    const pickup = locations[Math.floor(Math.random() * locations.length)];
    const delivery = locations[Math.floor(Math.random() * locations.length)];
    const payment = Math.floor(Math.random() * 80 + 30) * 1000; // 30k - 110k

    const newJob = {
        id: newJobId,
        pickup: pickup,
        delivery: delivery,
        distance: (Math.random() * 5 + 2).toFixed(1), // 2.0 - 7.0 km
        estimate: Math.floor(Math.random() * 20 + 15), // 15 - 35 min
        payment: payment,
        status: 'new',
        createdAt: new Date(),
        customer: { id: 'CUST'+jobIdCounter, name: 'Pelanggan ' + jobIdCounter },
    };
    
    courierState.jobs.push(newJob);
    if (showNotif) {
        showNotification(`Pesanan baru #${newJobId} tersedia! (Simulasi)`, 'info');
    }
}

// Fungsi untuk memuat data dari backend (atau simulasi)
function loadOrdersFromBackend() {
    if (courierState.jobs.length === 0) {
        // Jika tidak ada koneksi backend, jalankan simulasi
        if (!socket || socket.disconnected) {
            simulateNewJob(false);
            simulateNewJob(false);
            showNotification('Koneksi backend terputus, menggunakan data simulasi.', 'warning');
        } else {
            // Jika terhubung, minta data awal (simulasi di backend)
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
    // Pastikan URL sudah diganti sebelum koneksi
    if (FREE_BACKEND_URL.includes('https://backend-production-e12e5.up.railway.app')) 
    
    try {
        // Tambahkan transportasi 'websocket' eksplisit
        socket = io(FREE_BACKEND_URL, {
            query: { role: 'courier', courierId: 'courier_001' },
            transports: ['websocket', 'polling'] 
        });

        socket.on('connect', () => {
            console.log('✅ Connected to FREE backend!');
            showNotification('Koneksi backend berhasil!', 'success');
            // Hentikan simulasi jika terhubung
            if (simulatedJobInterval) {
                clearInterval(simulatedJobInterval);
                simulatedJobInterval = null;
            }
            // Minta status WA terbaru
            socket.emit('get_whatsapp_status');
            // Minta data job awal
            loadOrdersFromBackend();
        });

        // Handle event job baru dari backend (real-time)
        socket.on('new_job_available', (job) => {
            courierState.jobs.push(job);
            updateBadges();
            loadJobs(); // Refresh UI
            showNotification(`📢 Pesanan baru #${job.id} tersedia! (Rp ${job.payment.toLocaleString('id-ID')})`, 'info');
        });
        
        // Handle data job awal dari backend
        socket.on('initial_jobs', (jobs) => {
             // Pastikan hanya menambahkan yang belum ada
            jobs.forEach(job => {
                if (!courierState.jobs.find(j => j.id === job.id)) {
                    courierState.jobs.push(job);
                }
            });
            updateBadges();
            loadJobs();
        });


        // Handle status WhatsApp dari backend
        socket.on('whatsapp_status', (data) => {
            updateWhatsAppStatusUI(data.status);
            if (data.status === 'qr_received' && data.qr) {
                showQRCodeModal(data.qr);
                showNotification('Harap scan QR Code WhatsApp Anda.', 'warning');
            } else if (data.status === 'connected') {
                closeQRCodeModal();
                showNotification('WhatsApp berhasil terhubung!', 'success');
            } else if (data.status === 'disconnected') {
                closeQRCodeModal();
                showNotification('WhatsApp terputus: ' + data.status, 'error');
            }
        });

        // Handle pesan masuk (dari customer via backend)
        socket.on('new_message', (data) => {
            showNotification(`Pesan baru dari Customer #${data.jobId}`, 'info');
            // Logika untuk menampilkan pesan di chat modal (diabaikan untuk kesederhanaan, hanya notifikasi)
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from FREE backend');
            updateWhatsAppStatusUI('disconnected');
            showNotification('Koneksi backend terputus', 'error');
            // Mulai simulasi lokal jika terputus
            if (!simulatedJobInterval) {
                simulatedJobInterval = setInterval(() => simulateNewJob(), 30000); // Setiap 30 detik
            }
        });
        
        // Hentikan simulasi jika terhubung
        socket.on('connect', () => {
            if (simulatedJobInterval) {
                clearInterval(simulatedJobInterval);
                simulatedJobInterval = null;
            }
        });

    } catch (error) {
        console.error('Error connecting to Socket.IO:', error);
        showNotification('Gagal terhubung ke Socket.IO. Cek URL backend Anda.', 'error');
        // Mulai simulasi lokal jika gagal koneksi
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

        // Update nav item active status
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Refresh konten spesifik
        if (pageId === 'jobs') loadJobs();
        if (pageId === 'history') loadHistory();
        if (pageId === 'earnings') loadEarnings();
        if (pageId === 'active-delivery') updateActiveDeliveryUI();
    }
}

// Fungsi inisialisasi awal
function initCourierApp() {
    // Tombol menu sidebar
    document.getElementById('menuBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    });
    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    });
    document.getElementById('overlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    });

    // Navigasi halaman
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            showPage(pageId);
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('overlay').classList.remove('active');
        });
    });

    // Toggle status online/offline
    document.getElementById('statusToggle').addEventListener('change', function() {
        courierState.onlineMode = this.checked;
        showNotification(`Mode ${this.checked ? 'Online' : 'Offline'}`, this.checked ? 'success' : 'warning');
        updateWhatsAppStatusUI(whatsappStatus); // Refresh header status
    });
    
    // Inisialisasi tampilan
    updateBadges();
    loadHistory(); 
    loadEarnings();
    updateActiveDeliveryUI(); 
    
    // Tambahkan container notifikasi jika belum ada
    if (!document.getElementById('notificationContainer')) {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        document.body.appendChild(container);
    }
}

function showChatModal(jobId) {
    const modal = document.getElementById('chatModal');
    const jobIdEl = document.getElementById('chatJobId');
    const chatMessagesEl = document.getElementById('chatMessages');
    jobIdEl.textContent = jobId;
    modal.classList.add('active');
    modal.style.display = 'flex';
    // Scroll ke bawah saat chat dibuka
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function closeChatModal() {
    document.getElementById('chatModal').classList.remove('active');
    setTimeout(() => {
        document.getElementById('chatModal').style.display = 'none';
    }, 300);
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    const jobId = document.getElementById('chatJobId').textContent;
    const chatMessagesEl = document.getElementById('chatMessages');

    // 1. Tambahkan pesan ke UI (Simulasi)
    const sentMessage = document.createElement('div');
    sentMessage.className = 'message-item sent';
    sentMessage.innerHTML = `
        <div class="message-bubble">${message}</div>
        <div class="message-footer">
            <span class="message-time">${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="message-status read">✓✓</span>
        </div>
    `;
    chatMessagesEl.appendChild(sentMessage);

    // 2. Kirim ke backend (Socket.IO)
    if (socket) {
        socket.emit('send_message', {
            jobId: jobId,
            sender: 'courier_001',
            message: message
        });
    }

    // 3. Bersihkan input dan scroll ke bawah
    input.value = '';
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// Anda bisa menghapus baris di bawah karena sudah ada di index.html:
/* document.addEventListener('DOMContentLoaded', function() {
    initCourierApp();
    connectWebSocket();
    // Load orders dari backend (atau simulasi) setelah delay singkat
    setTimeout(() => {
        loadOrdersFromBackend();
    }, 500); 
    updateActiveDeliveryUI();
}); */