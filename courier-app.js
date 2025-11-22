// courier-app.js - VERSI LENGKAP FINAL DENGAN FUNGSI WHATSAPP DAN FITUR UI LAINNYA

// ⚠️ PENTING: GANTI DENGAN URL BACKEND ANDA YANG SUDAH JALAN (PASTIKAN MENGGUNAKAN https://)!
const FREE_BACKEND_URL = 'https://backend-production-e12e5.up.railway.app'; // <--- URL BACKEND ANDA

let socket = null;
let whatsappStatus = 'disconnected'; // Status WhatsApp: disconnected, qr_received, connected
let courierState = {
    jobs: [], // Pesanan baru (belum diterima)
    history: [], // Riwayat (completed/cancelled)
    balance: 185000,
    // Tambahkan data simulasi agar fitur job list berjalan
    activeDeliveries: [ 
        { id: '1001', customerPhone: '628123456789', status: 'on_delivery', pickup: { name: 'Gudang A', address: 'Jl. Contoh No. 1' } },
        { id: '1002', customerPhone: '6285000999888', status: 'on_delivery', pickup: { name: 'Toko B', address: 'Jl. Mawar No. 5' } }
    ], 
    onlineMode: true,
};


// =========================================================
// --- UTILITY & WHATSAPP UI FUNCTIONS ---
// =========================================================

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

// Fungsi untuk memperbarui status WhatsApp di UI
function updateWhatsAppStatusUI(status) {
    const statusElement = document.getElementById('whatsappStatusText');
    const dotElement = document.getElementById('whatsappStatusDot');
    
    if (statusElement) {
        whatsappStatus = status;
        statusElement.textContent = `WA: ${status.toUpperCase().replace('_', ' ')}`;
    }

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
}

// Fungsi Modal QR Code
function showQRCodeModal(qrData) {
    const modal = document.getElementById('qrCodeModal');
    const qrCanvas = document.getElementById('qrCanvas'); 
    const qrStatusText = document.getElementById('qrStatusText');

    if (modal && qrCanvas && qrData) {
        qrcode.toCanvas(qrCanvas, qrData, { width: 200, margin: 2 }, (error) => {
            if (error) console.error(error);
            console.log('QR Code Rendered');
        });

        if (qrStatusText) qrStatusText.textContent = 'QR Code tersedia. Scan sekarang!';
        modal.style.display = 'flex';
    }
}

function closeQRCodeModal() {
    const modal = document.getElementById('qrCodeModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function hideQrModal() {
    closeQRCodeModal();
}


// --- FUNGSI UI LAINNYA ---

function updateCourierUI() {
    const balanceEl = document.querySelector('.balance-amount');
    if(balanceEl) balanceEl.textContent = `Rp ${courierState.balance.toLocaleString('id-ID')}`;
    
    const onlineDot = document.querySelector('.header-left .status-dot');
    const onlineText = document.querySelector('.header-left .status-text');
    if (onlineDot) {
        onlineDot.className = `status-dot ${courierState.onlineMode ? 'online' : 'offline'}`;
    }
    if (onlineText) {
        onlineText.textContent = courierState.onlineMode ? 'Online' : 'Offline';
    }

    updateJobLists();
}

function updateJobLists() {
    const activeJobsContainer = document.getElementById('activeJobs');
    if (!activeJobsContainer) return;
    
    if (courierState.activeDeliveries.length === 0) {
        activeJobsContainer.innerHTML = '<p class="empty-state">Tidak ada pesanan aktif saat ini.</p>';
        return;
    }

    activeJobsContainer.innerHTML = courierState.activeDeliveries.map(job => `
        <div class="job-card">
            <div class="job-header">
                <div class="job-id">#${job.id}</div>
                <div class="job-status ${job.status}">${job.status.toUpperCase().replace('_', ' ')}</div>
            </div>
            <div class="job-details">
                <p><strong>Pickup:</strong> ${job.pickup.address}</p>
                <p><strong>Customer:</strong> ${job.customerPhone}</p>
            </div>
            <div class="action-buttons">
                <button onclick="openChatModal('${job.id}')" class="btn primary">Chat WA</button>
                <button onclick="simulateCompleteJob('${job.id}')" class="btn secondary">Selesai</button>
            </div>
        </div>
    `).join('');
}

function openChatModal(jobId) {
    const job = courierState.activeDeliveries.find(j => j.id === jobId);
    if (!job) return showNotification(`Job #${jobId} tidak ditemukan.`, 'error');

    const modal = document.getElementById('chatModal');
    const chatTitle = document.getElementById('chatTitle');
    const chatJobId = document.getElementById('chatJobId');
    const chatMessagesEl = document.getElementById('chatMessages');

    chatTitle.textContent = `Chat Customer Job #${jobId}`;
    chatJobId.textContent = jobId;
    
    chatMessagesEl.innerHTML = `
        <div class="message-item received">
            <div class="message-bubble">Selamat datang. Ada yang bisa saya bantu terkait pesanan #${jobId}?</div>
            <div class="message-footer"><span class="message-time">${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></div>
        </div>
    `; 

    modal.style.display = 'flex';
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function closeChatModal() {
    document.getElementById('chatModal').style.display = 'none';
}

function simulateCompleteJob(jobId) {
    showNotification(`Simulasi: Job #${jobId} diselesaikan. Saldo bertambah.`, 'success');
    courierState.activeDeliveries = courierState.activeDeliveries.filter(j => j.id !== jobId);
    courierState.balance += 5000; 
    updateCourierUI();
}


// =========================================================
// --- SOCKET.IO CONNECTION & HANDLERS ---
// =========================================================

function connectWebSocket() {
    socket = io(FREE_BACKEND_URL, {
        query: {
            courierId: 'courier_001' 
        },
        transports: ['websocket']
    });

    socket.on('connect', () => {
        showNotification('Terhubung ke Server!', 'success');
        updateCourierUI(); 
    });

    socket.on('disconnect', () => {
        showNotification('Koneksi ke Server terputus.', 'error');
        updateWhatsAppStatusUI('disconnected'); 
    });

    // KUNCI WA: Menerima status koneksi WhatsApp
    socket.on('whatsapp_status', (data) => {
        updateWhatsAppStatusUI(data.status);
        
        if (data.status === 'qr_received' && data.qr) {
            showQRCodeModal(data.qr);
            showNotification('Harap **scan QR Code** WhatsApp Anda.', 'warning');
        } else if (data.status === 'connected') {
            closeQRCodeModal();
            showNotification('WhatsApp berhasil terhubung!', 'success');
        } else if (data.status === 'disconnected') {
            showNotification('WhatsApp terputus. Menghubungkan ulang...', 'error');
        }
    });

    // KUNCI WA: Menerima pesan masuk dari customer
    socket.on('new_message', (data) => {
        showNotification(`💬 Pesan WA baru dari Customer: ${data.message}`, 'info'); 
        
        const currentChatJobId = document.getElementById('chatJobId').textContent;
        if (currentChatJobId === data.jobId) {
            appendMessageToChatUI(data.message, 'received', data.sender);
        }
    });

    // KUNCI WA: Konfirmasi pengiriman pesan dari backend
    socket.on('message_sent', (data) => {
        if (data.success) {
            console.log(`Pesan ke Job ${data.jobId} berhasil dikirim via WA.`);
        } else {
            showNotification(`Gagal kirim WhatsApp: ${data.error}`, 'error');
        }
    });
}


// =========================================================
// --- CHAT LOGIC (KIRIM PESAN NYATA) ---
// =========================================================

function appendMessageToChatUI(message, type, sender) {
    const chatMessagesEl = document.getElementById('chatMessages');
    if (!chatMessagesEl) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `message-item ${type}`; 
    
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    messageEl.innerHTML = `
        <div class="message-bubble">${message}</div>
        <div class="message-footer">
            <span class="message-time">${time}</span>
            ${type === 'sent' ? '<span class="message-status read">✓✓</span>' : ''}
        </div>
    `;
    chatMessagesEl.appendChild(messageEl);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// KUNCI WA: Fungsi kirim pesan yang terhubung ke Socket.IO
function sendMessageAction() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    const jobId = document.getElementById('chatJobId').textContent;
    
    // 1. Tambahkan pesan ke UI (Simulasi Sent)
    appendMessageToChatUI(message, 'sent', 'courier_001');

    // 2. Kirim ke backend (Socket.IO) untuk diteruskan ke WA
    if (socket) {
        socket.emit('send_message', {
            jobId: jobId,
            sender: 'courier_001', 
            message: message
        });
        showNotification('Mengirim pesan WhatsApp...', 'info');
    }

    // 3. Bersihkan input
    input.value = '';
}


// =========================================================
// --- INIT LAINNYA ---
// =========================================================

function initCourierApp() {
    updateWhatsAppStatusUI(whatsappStatus); 
    updateCourierUI(); 
    
    // Setup listener untuk tombol kirim
    const sendBtn = document.getElementById('sendChatBtn');
    if (sendBtn) {
        sendBtn.onclick = sendMessageAction;
    }
    
    // Setup listener untuk tombol tutup modal
    const closeChatBtn = document.querySelector('#chatModal .close-btn');
    if (closeChatBtn) {
        closeChatBtn.onclick = closeChatModal;
    }
}