// courier-app.js - VERSI LENGKAP DENGAN SIMULASI BACKEND SOCKET.IO/RAILWAY

// GANTI DENGAN URL BACKEND ANDA DI RAILWAY YANG SUDAH JALAN!
// Contoh: 'https://nama-aplikasi-anda.up.railway.app'
const FREE_BACKEND_URL = 'backend-production-e12e5.up.railway.app'; // <--- GANTI INI!!!

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
            <div class="delivery-metrics">
                <div class="metric-item"><div class="metric-value">${activeDelivery.distance} km</div><div class="metric-label">Jarak</div></div>
                <div class="metric-item"><div class="metric-value">${activeDelivery.estimate} min</div><div class="metric-label">Est. Waktu</div></div>
                <div class="metric-item"><div class="metric-value">Rp ${activeDelivery.payment.toLocaleString('id-ID')}</div><div class="metric-label">Bayaran</div></div>
            </div>
        `;
        deliveryActions.style.display = 'flex';
        
        // Start Timer
        updateActiveDeliveryTimer(); 
        if (!window.deliveryTimerInterval) {
            window.deliveryTimerInterval = setInterval(updateActiveDeliveryTimer, 1000);
        }

    } else {
        // Hide UI elements if no active delivery
        activeDeliveryCard.style.display = 'none';
        fullDeliveryCard.innerHTML = '<div class="no-data">Anda tidak sedang dalam pengiriman aktif.</div>';
        deliveryActions.style.display = 'none';
        if (window.deliveryTimerInterval) {
            clearInterval(window.deliveryTimerInterval);
            window.deliveryTimerInterval = null;
        }
        if (timerElement) timerElement.textContent = '00:00:00';
    }
}

// Fungsi Timer Pengiriman Aktif
function updateActiveDeliveryTimer() {
    const timerElement = document.getElementById('deliveryTimer');
    
    if (!timerElement || courierState.activeDeliveries.length === 0) {
        if (window.deliveryTimerInterval) {
            clearInterval(window.deliveryTimerInterval);
            window.deliveryTimerInterval = null;
        }
        return;
    }

    const activeDelivery = courierState.activeDeliveries[0];
    const elapsed = Math.floor((new Date() - new Date(activeDelivery.startedAt)) / 1000);
    
    const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const seconds = String(elapsed % 60).padStart(2, '0');

    timerElement.textContent = `${hours}:${minutes}:${seconds}`;

    // Simulasi pergerakan di map (hanya di dashboard)
    const courierMarker = document.querySelector('.current-position');
    if (courierMarker) {
        // Pindah dari 40% ke 80% dalam 100 detik (contoh simulasi)
        const durationSec = 100;
        const startPos = 40;
        const endPos = 80;
        let currentPos;

        if (elapsed < durationSec) {
             currentPos = startPos + (elapsed / durationSec) * (endPos - startPos);
        } else {
            currentPos = endPos; // Sampai di tujuan
        }
        courierMarker.style.left = `${currentPos}%`;
    }
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
}

// Tombol Selesai Pengiriman
function completeDelivery() {
    if (courierState.activeDeliveries.length === 0) return;

    const completedJob = courierState.activeDeliveries.shift();
    completedJob.status = 'completed';
    completedJob.completedAt = new Date(); // Catat waktu selesai
    courierState.history.push(completedJob); // Masukkan ke riwayat
    
    // Update saldo
    courierState.balance += completedJob.payment;
    
    // Kirim event ke backend (jika socket terhubung)
    if (socket) {
        socket.emit('job_completed', { jobId: completedJob.id, courierId: 'courier_001', payment: completedJob.payment });
    }

    showNotification(`Pengiriman #${completedJob.id} Selesai! Saldo bertambah +Rp ${completedJob.payment.toLocaleString('id-ID')}.`, 'success');
    updateActiveDeliveryUI(); // Hapus tampilan pengiriman aktif
    updateBadges(); // Update saldo di header
    loadEarnings(); // Update halaman penghasilan
    showPage('dashboard');
}

// Fungsi Simulasi Job (Untuk testing lokal atau saat backend disconnected)
function simulateNewJob(showNotif = true) {
    jobIdCounter++;
    const newJobId = 'K' + jobIdCounter;
    
    const locations = [
        { name: 'Toko Baju A', address: 'Jl. Riau No. 50, Bandung' },
        { name: 'Warung Nasi Cepat Saji', address: 'Jl. Pemuda No. 101, Jakarta' },
        { name: 'Rumah Sakit Bunda', address: 'Jl. Merdeka No. 5, Surabaya' },
        { name: 'Gudang Logistik X', address: 'Jl. Raya Bekasi KM 20, Jakarta' },
        { name: 'Mall ABC', address: 'Jl. Sudirman No. 99, Jakarta' },
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
        showNotification(`Pesanan baru #${newJobId} tersedia!`, 'info');
    }
}

// Fungsi untuk memuat data dari backend (Simulasi awal)
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
    closeSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

function toggleOnlineMode(event) {
    courierState.onlineMode = event.target.checked;
    const statusText = document.querySelector('.header-left .status-text');
    if (courierState.onlineMode) {
        statusText.textContent = whatsappStatus === 'connected' ? 'Online' : 'Disconnected';
        showNotification('Anda sekarang Aktif dan siap menerima pesanan!', 'success');
        if (socket) socket.emit('go_online', { courierId: 'courier_001' });
    } else {
        statusText.textContent = 'Offline';
        showNotification('Anda sekarang Offline. Pesanan baru tidak akan masuk.', 'warning');
        if (socket) socket.emit('go_offline', { courierId: 'courier_001' });
    }
    updateWhatsAppStatusUI(whatsappStatus);
}

// Fungsi untuk inisialisasi semua event listener
function initCourierApp() {
    // Navigasi Sidebar
    document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
    document.getElementById('overlay').addEventListener('click', closeSidebar);
    
    // Navigasi Pages
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            if (pageId) showPage(pageId);
        });
    });
    
    // Toggle Mode
    document.getElementById('statusToggle').addEventListener('change', toggleOnlineMode);

    // Filter History
    const historyFilter = document.getElementById('historyFilter');
    if (historyFilter) historyFilter.addEventListener('change', loadHistory);
}

// --- CHAT MODAL FUNCTIONS ---
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
            <span class="message-status">✓</span>
        </div>
    `;
    chatMessagesEl.appendChild(sentMessage);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    // 2. Kirim ke Backend (Jika terhubung)
    if (socket) {
        socket.emit('send_message', {
            jobId: jobId,
            sender: 'courier',
            message: message
        });
    }

    // 3. Bersihkan input
    input.value = '';
}


// --- SOCKET.IO CONNECTION & HANDLERS ---

function connectWebSocket() {
    if (FREE_BACKEND_URL.includes('your-app-name')) {
        showNotification('❌ HARAP GANTI "your-app-name-ganti-ini.up.railway.app" di courier-app.js dengan URL Railway Anda yang sebenarnya!', 'error');
        return;
    }

    try {
        // Inisialisasi koneksi Socket.IO
        socket = io(FREE_BACKEND_URL, {
            query: {
                role: 'courier',
                courierId: 'courier_001' // Ganti dengan ID Kurir yang sesungguhnya jika ada sistem login
            }
        });

        socket.on('connect', () => {
            console.log('✅ Connected to FREE backend');
            showNotification('Koneksi ke server Railway berhasil!', 'success');
            // Minta status WhatsApp saat koneksi
            socket.emit('get_whatsapp_status', { courierId: 'courier_001' });
        });

        // Handle new job available (dari backend)
        socket.on('new_job_available', (job) => {
            console.log('📢 Pesanan baru diterima dari backend:', job);
            courierState.jobs.push(job);
            updateBadges();
            loadJobs();
            showNotification('Pesanan baru tersedia (via Backend)!', 'info');
        });

        // Handle WhatsApp status
        socket.on('whatsapp_status', (data) => {
            console.log('WhatsApp status:', data.status);
            updateWhatsAppStatusUI(data.status);
            
            if (data.status === 'connected') {
                showNotification('WhatsApp Terhubung!', 'success');
                closeQRCodeModal();
            } else if (data.status === 'qr_received') {
                showNotification('Scan QR Code untuk terhubung!', 'warning');
                showQRCodeModal(data.qr);
            } else {
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