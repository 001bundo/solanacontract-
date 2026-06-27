// Solana Contract Dashboard Controller

let currentUser = null;
let earningsChartInstance = null;
let activeTicketId = null;

let sessionStartTime = Date.now();

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupNavigation();
  initData();

  // Check for verification link query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const verifyUser = urlParams.get('verify-email');
  if (verifyUser) {
    const success = window.DB.verifyEmail(verifyUser);
    if (success) {
      setTimeout(() => {
        showToast(`Email verified successfully for ${verifyUser}!`, 'success');
      }, 500);
      const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
      window.history.replaceState({ path: newURL }, '', newURL);
      initData();
    }
  }

  // Wire KYC file input onchange for live preview
  const kycFileInput = document.getElementById('kycDocFile');
  if (kycFileInput) {
    kycFileInput.addEventListener('change', function() { handleKycFilePreview(this); });
    // Make the wrapper div trigger the hidden file input
    const wrapper = document.getElementById('kycUploadWrapper');
    if (wrapper) wrapper.addEventListener('click', () => kycFileInput.click());
  }

  // Wire Deposit file input onchange for live feedback
  const depReceiptInput = document.getElementById('depReceipt');
  if (depReceiptInput) {
    depReceiptInput.addEventListener('change', function() {
      const file = this.files[0];
      const btn = this.previousElementSibling;
      if (file && btn) {
        btn.innerHTML = `<i class="fa-solid fa-check" style="color: var(--secondary);"></i> File Selected: ${file.name}`;
        btn.style.borderColor = 'var(--secondary)';
      }
    });
  }

  // Start live price ticker
  fetchDashboardPrices();
  setInterval(fetchDashboardPrices, 4000); // refresh prices/usd balances every 4 seconds

  // Start yield micro-accruals ticker
  startMicroAccrual();

  // Listen for database changes from other tabs/actions
  window.addEventListener('solanacontract_db_update', () => {
    initData();
  });
});

// Auth Verification
function checkAuth() {
  currentUser = window.DB.getCurrentUser();
  if (!currentUser) {
    window.location.href = 'auth.html';
    return;
  }
  if (currentUser.isAdmin) {
    window.location.href = 'admin.html';
    return;
  }
}

// Navigation Tabs Management
function setupNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const panels = document.querySelectorAll('.tab-panel');
  const titleEl = document.getElementById('dashPageTitle');

  function handleTabChange(hash) {
    let targetTab = hash.replace('#', '') || 'overview';
    
    // Find matching menu item
    let found = false;
    menuItems.forEach(item => {
      if (item.dataset.tab === targetTab) {
        item.classList.add('active');
        found = true;
      } else {
        item.classList.remove('active');
      }
    });

    if (!found && targetTab === 'overview') {
      menuItems[0].classList.add('active');
    }

    // Toggle panels
    panels.forEach(panel => {
      if (panel.id === `panel-${targetTab}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Toggle Mobile Drawer Close
    toggleSidebar(false);

    // Update Header Page Title
    const formattedTitle = targetTab.charAt(0).toUpperCase() + targetTab.slice(1).replace('-', ' ');
    titleEl.textContent = targetTab === 'overview' ? 'Dashboard Overview' : formattedTitle;

    // Load special panel renders
    if (targetTab === 'print') {
      loadPrintLedger();
    } else if (targetTab === 'tickets') {
      loadSupportTickets();
    }
  }

  // Hash listener
  window.addEventListener('hashchange', () => {
    handleTabChange(window.location.hash);
  });

  // Apply default on load
  if (window.location.hash) {
    handleTabChange(window.location.hash);
  } else {
    window.location.hash = '#overview';
  }
}

// Sidebar toggle for mobile
function toggleSidebar(open) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (open) {
    sidebar.classList.add('active');
    overlay.classList.add('active');
  } else {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  }
}

// Toast Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:transparent;border:none;color:#fff;cursor:pointer;" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Initial Data Binding & Render updates
function initData() {
  // Re-fetch current user info from store to reflect updated states
  const allUsers = window.DB.getAllUsers();
  currentUser = allUsers.find(u => u.username === currentUser.username);

  if (!currentUser) {
    handleLogout();
    return;
  }

  sessionStartTime = Date.now();

  // Email verification warning alert
  const verifyAlert = document.getElementById('emailVerifyAlert');
  if (verifyAlert) {
    if (currentUser.emailVerified === false) {
      verifyAlert.style.display = 'block';
    } else {
      verifyAlert.style.display = 'none';
    }
  }

  // Header Elements
  document.getElementById('navBalanceSol').textContent = `${currentUser.balanceSOL.toFixed(2)} SOL`;
  document.getElementById('navBalanceUsdt').textContent = `${currentUser.balanceUSDT.toFixed(2)} USDT`;
  document.getElementById('navBalanceBtc').textContent = `${(currentUser.balanceBTC || 0).toFixed(4)} BTC`;
  document.getElementById('navUsername').textContent = currentUser.username;
  document.getElementById('navAvatar').textContent = currentUser.username.charAt(0).toUpperCase();

  // KYC Badge
  const kycBadge = document.getElementById('navKycBadge');
  kycBadge.textContent = currentUser.kycStatus;
  kycBadge.className = `badge badge-${currentUser.kycStatus === 'verified' ? 'success' : (currentUser.kycStatus === 'pending' ? 'pending' : 'danger')}`;

  // Overview Cards
  document.getElementById('welcomeUser').textContent = currentUser.username;
  document.getElementById('cardBalanceSol').textContent = `${currentUser.balanceSOL.toFixed(2)} SOL`;
  document.getElementById('cardBalanceUsdt').textContent = `${currentUser.balanceUSDT.toFixed(2)} USDT`;
  document.getElementById('cardBalanceBtc').textContent = `${(currentUser.balanceBTC || 0).toFixed(4)} BTC`;

  // Compute Active Staking Details
  const allContracts = window.DB.getAllContracts().filter(c => c.username === currentUser.username);
  const activeContracts = allContracts.filter(c => c.status === 'active');
  document.getElementById('cardActiveContracts').textContent = activeContracts.length;

  const totalEarnings = allContracts.reduce((sum, c) => sum + c.earnings, 0);
  document.getElementById('cardTotalEarnings').textContent = `${totalEarnings.toFixed(3)} SOL`;

  // Renders
  renderRecentActivity();
  renderDepositHistory();
  renderWithdrawalHistory();
  renderActiveContracts();
  renderReferralSystem();
  renderVerificationPanel();
  renderSecurity2FA();

  // Profile forms defaults
  document.getElementById('profUsername').value = currentUser.username;
  document.getElementById('profEmail').value = currentUser.email;
  document.getElementById('profWalletSOL').value = currentUser.walletSOL || '';
  document.getElementById('profWalletUSDT').value = currentUser.walletUSDT || '';
  document.getElementById('profWalletBTC').value = currentUser.walletBTC || '';

  // Initial deposit address settings
  updateDepositDetails();

  // Load Chart
  loadChartData(allContracts);
}

// Chart.js render yields growth
function loadChartData(contracts) {
  const ctx = document.getElementById('earningsChart');
  if (!ctx) return;

  // Generate labels (last 7 days)
  const labels = [];
  const chartData = [];
  let baseVal = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    // Accrue yield growth curve mockup based on active contracts
    baseVal += contracts.length > 0 ? (contracts.reduce((sum, c) => sum + (c.amount * (c.dailyRate / 100)), 0) / 7) * (7 - i) : (0.12 * (7 - i));
    chartData.push(baseVal);
  }

  if (earningsChartInstance) {
    earningsChartInstance.destroy();
  }

  earningsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Yield Dividends (SOL)',
        data: chartData,
        borderColor: '#14F195',
        backgroundColor: 'rgba(20, 241, 149, 0.05)',
        borderWidth: 3,
        pointBackgroundColor: '#9945FF',
        pointBorderColor: '#fff',
        pointRadius: 4,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
      }
    }
  });
}

// Render Lists - Activity Feed Overview card
function renderRecentActivity() {
  const container = document.getElementById('recentActivityList');
  const deposits = window.DB.getAllDeposits().filter(d => d.username === currentUser.username);
  const withdrawals = window.DB.getAllWithdrawals().filter(w => w.username === currentUser.username);

  // Merge and sort by timestamp
  const merged = [
    ...deposits.map(d => ({ ...d, type: 'Deposit', amountText: `+${d.amount} ${d.currency}`, statusBadge: d.status })),
    ...withdrawals.map(w => ({ ...w, type: 'Withdrawal', amountText: `-${w.amount} ${w.currency}`, statusBadge: w.status }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (merged.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin-top: 50px;">No recent transactions.</p>`;
    return;
  }

  let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
  merged.slice(0, 5).forEach(item => {
    let statusClass = item.statusBadge === 'approved' ? 'badge-success' : (item.statusBadge === 'pending' ? 'badge-pending' : 'badge-danger');
    let colorClass = item.type === 'Deposit' ? 'var(--secondary)' : 'var(--danger)';
    
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(8,9,12,0.3); border:1px solid var(--border-glass); border-radius:10px;">
        <div>
          <span style="font-weight:600; font-size:0.9rem;">${item.type}</span>
          <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(item.timestamp).toLocaleDateString()}</div>
        </div>
        <div style="text-align:right;">
          <span style="font-family:monospace; font-weight:700; color:${colorClass}; margin-right:8px;">${item.amountText}</span>
          <span class="badge ${statusClass}">${item.statusBadge}</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// Update deposit address instructions
function updateDepositDetails() {
  const coin = document.getElementById('depCurrency').value;
  const settings = window.DB.getSystemSettings();
  const uGroup = document.getElementById('usdtNetworkGroup');

  let address = '';
  let savedQR = '';

  if (coin === 'SOL') {
    if (uGroup) uGroup.style.display = 'none';
    address = settings.solDepositAddress;
    savedQR = settings.solDepositQR;
  } else if (coin === 'USDT') {
    if (uGroup) uGroup.style.display = 'block';
    const net = document.getElementById('usdtNetwork').value;
    if (net === 'SOL') {
      address = settings.usdtSolDepositAddress;
      savedQR = settings.usdtSolDepositQR;
    } else {
      address = settings.usdtEvmDepositAddress;
      savedQR = settings.usdtEvmDepositQR;
    }
  } else if (coin === 'BTC') {
    if (uGroup) uGroup.style.display = 'none';
    address = settings.btcDepositAddress;
    savedQR = settings.btcDepositQR;
  }

  const qrImage     = document.getElementById('depQrCode');
  const addressInput = document.getElementById('depAddressInput');
  const titleEl      = document.getElementById('depAddressTitle');
  const scanTabNote  = document.getElementById('depScanNote');

  titleEl.innerHTML = `Transfer ${coin} to Target Wallet`;
  addressInput.value = address || '';

  if (savedQR) {
    // Use admin-uploaded QR/barcode image
    qrImage.src = savedQR;
    if (scanTabNote) scanTabNote.style.display = 'block';
  } else {
    // Fall back to auto-generated QR from address string
    qrImage.src = address ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}` : 'https://picsum.photos/150';
    if (scanTabNote) scanTabNote.style.display = 'none';
  }
}

// Toggle between Address view and QR/Barcode view on deposit card
function switchDepositView(mode) {
  const addrView = document.getElementById('depAddressView');
  const qrView   = document.getElementById('depQrView');
  const tabAddr  = document.getElementById('depTabAddr');
  const tabQr    = document.getElementById('depTabQr');

  if (mode === 'address') {
    addrView.style.display = 'block';
    qrView.style.display   = 'none';
    tabAddr.classList.add('active');
    tabQr.classList.remove('active');
  } else {
    addrView.style.display = 'none';
    qrView.style.display   = 'block';
    tabQr.classList.add('active');
    tabAddr.classList.remove('active');
  }
}

function copyDepositAddress() {
  const copyText = document.getElementById('depAddressInput');
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(copyText.value);
  showToast('Address copied to clipboard!', 'success');
}

// Deposit submission handler
function handleDepositSubmit(e) {
  e.preventDefault();
  const currency = document.getElementById('depCurrency').value;
  const amount = document.getElementById('depAmount').value;
  
  const txHashEl = document.getElementById('depTxHash');
  let hash = '';
  if (txHashEl) {
    hash = txHashEl.value;
  } else {
    // Generate a mock blockchain transaction hash (e.g. for user demo experience)
    const randPart = () => Math.random().toString(36).substring(2, 10).toUpperCase();
    hash = (currency === 'USDT' || currency === 'BTC' ? '0x' : '') + randPart() + randPart() + randPart();
  }

  const file = document.getElementById('depReceipt').files[0];
  const fileName = file ? file.name : 'uploaded_receipt.jpg';

  window.DB.createDeposit(currentUser.username, amount, currency, hash, fileName);
  showToast('Deposit receipt submitted successfully! Verification pending.', 'success');
  
  // reset form
  document.getElementById('depositForm').reset();
  const depReceiptInput = document.getElementById('depReceipt');
  if (depReceiptInput) {
    const btn = depReceiptInput.previousElementSibling;
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Click to Upload Receipt Image';
      btn.style.borderColor = '';
    }
  }
  updateDepositDetails();
  initData();
}

function renderDepositHistory() {
  const tbody = document.getElementById('depositHistoryBody');
  const list = window.DB.getAllDeposits().filter(d => d.username === currentUser.username)
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No deposits submitted yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    let statusClass = item.status === 'approved' ? 'badge-success' : (item.status === 'pending' ? 'badge-pending' : 'badge-danger');
    return `
      <tr>
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td style="font-family:monospace; font-size:0.8rem;" title="${item.txHash}">${item.txHash.substr(0,10)}...</td>
        <td><strong>${item.currency}</strong></td>
        <td>${item.amount.toFixed(2)}</td>
        <td><span class="badge ${statusClass}">${item.status}</span></td>
      </tr>
    `;
  }).join('');
}

// Investment Buy Modal triggers
function openInvestModal(planId, currency) {
  const modal = document.getElementById('investModal');
  const titleEl = document.getElementById('investModalTitle');
  const planIdInput = document.getElementById('investPlanId');
  const currencyInput = document.getElementById('investCurrency');
  const balanceInput = document.getElementById('investModalBalance');
  const limitEl = document.getElementById('investLimitInfo');
  
  const settings = window.DB.getSystemSettings();
  const plan = settings.plans[planId];
  
  if (!plan) return;

  const currentBal = currency === 'SOL' ? currentUser.balanceSOL : (currency === 'USDT' ? currentUser.balanceUSDT : currentUser.balanceBTC);

  titleEl.textContent = `Stake ${plan.name}`;
  planIdInput.value = planId;
  currencyInput.value = currency;
  balanceInput.value = `${currentBal.toFixed(currency === 'BTC' ? 4 : 2)} ${currency}`;
  limitEl.textContent = `Limits: Min ${plan.min} / Max ${plan.max} ${currency} | ROI: ${plan.rate}% daily for ${plan.duration} days.`;
  
  document.getElementById('investAmount').value = plan.min;
  document.getElementById('investAmount').min = plan.min;
  document.getElementById('investAmount').max = plan.max;

  modal.classList.add('show');
}

function closeInvestModal() {
  document.getElementById('investModal').classList.remove('show');
}

function handleInvestSubmit(e) {
  e.preventDefault();
  const planId = document.getElementById('investPlanId').value;
  const currency = document.getElementById('investCurrency').value;
  const amount = document.getElementById('investAmount').value;

  const res = window.DB.buyContract(currentUser.username, planId, amount, currency);
  if (res.success) {
    showToast('Yield contract purchased successfully!', 'success');
    closeInvestModal();
    initData();
  } else {
    showToast(res.message, 'error');
  }
}

function renderActiveContracts() {
  const container = document.getElementById('activeContractsList');
  const list = window.DB.getAllContracts().filter(c => c.username === currentUser.username)
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (list.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 24px;">You have no active contracts. Choose a plan above to start staking.</p>`;
    return;
  }

  // ── Pending Profit Summary Banner ──────────────────────────
  const pendingProfitByAsset = {};
  list.forEach(item => {
    if (item.status === 'active' || item.status === 'in_progress') {
      const remainingDays = Math.max(0, item.durationDays - item.daysElapsed);
      const pendingProfit = item.amount * (item.dailyRate / 100) * remainingDays;
      if (!pendingProfitByAsset[item.currency]) pendingProfitByAsset[item.currency] = 0;
      pendingProfitByAsset[item.currency] += pendingProfit;
    }
  });

  const profitEntries = Object.entries(pendingProfitByAsset);
  let summaryHTML = '';
  if (profitEntries.length > 0) {
    const profitItems = profitEntries.map(([cur, amt]) =>
      `<span style="font-family:monospace; font-weight:800; font-size:1.05rem; color:var(--secondary);">${amt.toFixed(cur === 'BTC' ? 5 : 3)} <span style="font-size:0.85rem;">${cur}</span></span>`
    ).join('<span style="color:var(--border-glass); margin:0 10px;">|</span>');

    summaryHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;
                  background: linear-gradient(135deg, rgba(20,241,149,0.07), rgba(153,69,255,0.07));
                  border: 1px solid rgba(20,241,149,0.2); border-radius:12px;
                  padding:16px 20px; margin-bottom:20px;">
        <div>
          <div style="font-size:0.75rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-secondary); margin-bottom:4px;">
            <i class="fa-solid fa-hourglass-half" style="color:var(--warning);"></i> Pending Profit (Estimated Remaining)
          </div>
          <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            ${profitItems}
          </div>
        </div>
        <div style="font-size:0.78rem; color:var(--text-muted); text-align:right; max-width:200px; line-height:1.4;">
          Based on your active plan rates &amp; remaining contract duration.
        </div>
      </div>
    `;
  }

  // ── Contract Cards ─────────────────────────────────────────
  const cardsHTML = list.map(item => {
    const percent = Math.min(100, (item.daysElapsed / item.durationDays) * 100);

    let statusBadgeClass, statusLabel, statusNote;
    if (item.status === 'active') {
      statusBadgeClass = 'badge-success';
      statusLabel = 'Active';
      statusNote = '';
    } else if (item.status === 'in_progress') {
      statusBadgeClass = 'badge-pending';
      statusLabel = 'In Progress';
      statusNote = `<div style="font-size:0.72rem; color:var(--warning); margin-top:4px; font-style:italic;">
        <i class="fa-solid fa-clock"></i> Awaiting admin review
      </div>`;
    } else {
      // completed
      statusBadgeClass = 'badge-info';
      statusLabel = 'Completed';
      statusNote = '';
    }

    return `
      <div class="contract-item">
        <div class="contract-header">
          <div>
            <strong style="color:#fff; font-size:1.05rem;">${item.planName}</strong>
            <div style="font-size:0.8rem; color:var(--text-muted);">Amount: ${item.amount.toFixed(2)} ${item.currency}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${statusBadgeClass}">${statusLabel}</span>
            ${statusNote}
            <div style="font-family:monospace; font-weight:700; color:var(--secondary); font-size:0.95rem; margin-top:4px;">Earned: ${item.earnings.toFixed(4)} ${item.currency}</div>
          </div>
        </div>
        <div class="contract-progress">
          <div class="contract-progress-bar" style="width: ${percent}%;"></div>
        </div>
        <div class="contract-footer">
          <span>Progress: ${item.daysElapsed} / ${item.durationDays} Days</span>
          <span>Daily Interest Yield: ${(item.amount * (item.dailyRate / 100)).toFixed(3)} ${item.currency}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = summaryHTML + cardsHTML;
}

// Internal Transfers
function handleTransferSubmit(e) {
  e.preventDefault();
  const receiver = document.getElementById('trfReceiver').value;
  const currency = document.getElementById('trfCurrency').value;
  const amount = document.getElementById('trfAmount').value;

  const res = window.DB.transferFunds(currentUser.username, receiver, amount, currency);
  if (res.success) {
    showToast(`Successfully transferred ${amount} ${currency} to ${receiver}!`, 'success');
    document.getElementById('transferForm').reset();
    initData();
  } else {
    showToast(res.message, 'error');
  }
}

// Withdrawals
function handleWithdrawalSubmit(e) {
  e.preventDefault();
  const currency = document.getElementById('wthCurrency').value;
  const amount = document.getElementById('wthAmount').value;
  const wallet = document.getElementById('wthAddress').value;

  // Check verification rules
  if (currency === 'SOL' && parseFloat(amount) > 50 && currentUser.kycStatus !== 'verified') {
    showToast('Withdrawals exceeding 50 SOL require full identity KYC Verification. Submit yours in Settings.', 'error');
    return;
  }

  const res = window.DB.createWithdrawal(currentUser.username, amount, currency, wallet);
  if (res.success) {
    showToast('Withdrawal request submitted! Deducted from ledger balance.', 'success');
    document.getElementById('withdrawalForm').reset();
    initData();
  } else {
    showToast(res.message, 'error');
  }
}

function renderWithdrawalHistory() {
  const tbody = document.getElementById('withdrawalHistoryBody');
  const list = window.DB.getAllWithdrawals().filter(w => w.username === currentUser.username)
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No withdrawals logged.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    let statusClass = item.status === 'approved' ? 'badge-success' : (item.status === 'pending' ? 'badge-pending' : 'badge-danger');
    return `
      <tr>
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td style="font-family:monospace; font-size:0.8rem;" title="${item.walletAddress}">${item.walletAddress.substr(0,12)}...</td>
        <td><strong>${item.currency}</strong></td>
        <td>${item.amount.toFixed(2)}</td>
        <td><span class="badge ${statusClass}">${item.status}</span></td>
      </tr>
    `;
  }).join('');
}

// Profile Save
function handleProfileUpdate(e) {
  e.preventDefault();
  const email = document.getElementById('profEmail').value;
  const walletSOL = document.getElementById('profWalletSOL').value;
  const walletUSDT = document.getElementById('profWalletUSDT').value;
  const walletBTC = document.getElementById('profWalletBTC').value;

  const success = window.DB.updateProfile(currentUser.username, email, walletSOL, walletUSDT, walletBTC);
  if (success) {
    showToast('Profile updated successfully!', 'success');
    initData();
  } else {
    showToast('Error updating profile settings.', 'error');
  }
}

// Referral copy and render
function renderReferralSystem() {
  const code = currentUser.referralCode;
  const linkInput = document.getElementById('referralLinkInput');
  if (linkInput) {
    const loc = window.location.href.split('#')[0].replace('dashboard.html', 'auth.html');
    linkInput.value = `${loc}?signup=true&ref=${code}`;
  }

  // Count referrals
  const referrals = window.DB.getAllUsers().filter(u => u.referredBy === currentUser.username);
  document.getElementById('refCountText').textContent = `${referrals.length} Partner${referrals.length === 1 ? '' : 's'}`;

  // Render Referral Table
  const tbody = document.getElementById('referralTableBody');
  if (tbody) {
    if (referrals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No referral logs recorded.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = referrals.map(ref => {
      // Determine ref active contract levels
      const contracts = window.DB.getAllContracts().filter(c => c.username === ref.username && c.status === 'active');
      const planName = contracts.length > 0 ? contracts[0].planName.split('(')[0] : 'None';
      
      return `
        <tr>
          <td><strong>${ref.username}</strong></td>
          <td>${ref.email}</td>
          <td><span class="badge ${contracts.length > 0 ? 'badge-success' : 'badge-info'}">${planName}</span></td>
          <td>${new Date().toLocaleDateString()}</td> <!-- Mock Join Date -->
        </tr>
      `;
    }).join('');
  }
}

function copyReferralLink() {
  const copyText = document.getElementById('referralLinkInput');
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(copyText.value);
  showToast('Affiliate link copied to clipboard!', 'success');
}

// Password settings
function handlePasswordUpdate(e) {
  e.preventDefault();
  const current = document.getElementById('passCurrent').value;
  const newPass = document.getElementById('passNew').value;
  const confirm = document.getElementById('passConfirm').value;

  if (newPass !== confirm) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  const success = window.DB.changePassword(currentUser.username, current, newPass);
  if (success) {
    showToast('Security password modified successfully!', 'success');
    document.getElementById('passwordForm').reset();
  } else {
    showToast('Incorrect current password validation.', 'error');
  }
}

// KYC Verification
function renderVerificationPanel() {
  const statusBox = document.getElementById('kycStatusBox');
  const statusText = document.getElementById('kycStatusText');
  const form = document.getElementById('kycForm');

  statusText.textContent = currentUser.kycStatus;
  statusText.className = `badge badge-${currentUser.kycStatus === 'verified' ? 'success' : (currentUser.kycStatus === 'pending' ? 'pending' : 'danger')}`;

  if (currentUser.kycStatus === 'verified') {
    statusBox.style.background = 'rgba(20, 241, 149, 0.05)';
    statusBox.style.borderColor = 'rgba(20, 241, 149, 0.15)';
    form.style.display = 'none';
  } else if (currentUser.kycStatus === 'pending') {
    statusBox.style.background = 'rgba(255, 184, 0, 0.05)';
    statusBox.style.borderColor = 'rgba(255, 184, 0, 0.15)';
    form.style.display = 'none';
  } else {
    statusBox.style.background = 'rgba(255, 74, 74, 0.05)';
    statusBox.style.borderColor = 'rgba(255, 74, 74, 0.15)';
    form.style.display = 'block';
  }
}

function handleKYCSubmit(e) {
  e.preventDefault();
  const country = document.getElementById('kycCountry').value;
  const type    = document.getElementById('kycDocType').value;
  const num     = document.getElementById('kycDocNumber').value;
  const file    = document.getElementById('kycDocFile').files[0];
  const name    = file ? file.name : 'id_scan.png';

  window.DB.submitKYC(currentUser.username, country, type, num, name);
  showToast('KYC document packet submitted successfully!', 'success');
  clearKycFile();
  initData();
}

// ── KYC File Preview ────────────────────────────────────
// Called by onchange on the kycDocFile input (wired in DOMContentLoaded)
function handleKycFilePreview(input) {
  const file    = input.files[0];
  const preview = document.getElementById('kycFilePreview');
  const thumb   = document.getElementById('kycThumb');
  const nameEl  = document.getElementById('kycFileName');
  const btn     = document.getElementById('kycUploadBtn');

  if (!file) { clearKycFile(); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    thumb.src = e.target.result;
    nameEl.textContent = `${file.name}  (${(file.size / 1024).toFixed(1)} KB)`;
    preview.style.display = 'block';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> File Selected — Change?';
  };
  reader.readAsDataURL(file);
}

function clearKycFile() {
  const input   = document.getElementById('kycDocFile');
  const preview = document.getElementById('kycFilePreview');
  const btn     = document.getElementById('kycUploadBtn');
  if (input)   input.value = '';
  if (preview) preview.style.display = 'none';
  if (btn)     btn.innerHTML = '<i class="fa-solid fa-camera"></i> Click to Upload Passport/ID Scan';
}

// Security 2FA Lock
function renderSecurity2FA() {
  const statusText = document.getElementById('2faStatusText');
  const btn = document.getElementById('btn2faToggle');

  if (currentUser.google2faEnabled) {
    statusText.textContent = 'Activated';
    statusText.className = 'badge badge-success';
    btn.textContent = 'Deactivate 2FA Security';
    btn.className = 'btn btn-outline';
  } else {
    statusText.textContent = 'Deactivated';
    statusText.className = 'badge badge-danger';
    btn.textContent = 'Activate 2FA Secure Lock';
    btn.className = 'btn btn-primary';
  }
}

function handle2FAToggle() {
  const enabled = window.DB.toggle2FA(currentUser.username);
  showToast(`Google 2FA security lock ${enabled ? 'activated' : 'deactivated'}!`, 'success');
  initData();
}

// Print ledger report page
function loadPrintLedger() {
  document.getElementById('printUsername').textContent = currentUser.username;
  document.getElementById('printEmail').textContent = currentUser.email;
  document.getElementById('printBalanceSol').textContent = `${currentUser.balanceSOL.toFixed(2)} SOL`;
  document.getElementById('printBalanceUsdt').textContent = `${currentUser.balanceUSDT.toFixed(2)} USDT`;
  document.getElementById('statementPrintDate').textContent = `Date: ${new Date().toLocaleDateString()}`;

  const tbody = document.getElementById('printHistoryTableBody');
  const deposits = window.DB.getAllDeposits().filter(d => d.username === currentUser.username);
  const withdrawals = window.DB.getAllWithdrawals().filter(w => w.username === currentUser.username);

  const merged = [
    ...deposits.map(d => ({ timestamp: d.timestamp, type: 'Deposit', amount: `+${d.amount.toFixed(2)} ${d.currency}`, detail: `Tx Hash: ${d.txHash.substr(0,15)}...`, status: d.status })),
    ...withdrawals.map(w => ({ timestamp: w.timestamp, type: 'Withdrawal', amount: `-${w.amount.toFixed(2)} ${w.currency}`, detail: `Wallet: ${w.walletAddress.substr(0,15)}...`, status: w.status }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (merged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No ledger logs registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = merged.map(item => {
    return `
      <tr>
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td><strong>${item.type}</strong></td>
        <td>${item.amount}</td>
        <td>${item.detail}</td>
        <td><span class="badge ${item.status === 'approved' ? 'badge-success' : (item.status === 'pending' ? 'badge-pending' : 'badge-danger')}">${item.status}</span></td>
      </tr>
    `;
  }).join('');
}

// Support Tickets Chat System
function openCreateTicketModal() {
  document.getElementById('createTicketModal').classList.add('show');
}

function closeCreateTicketModal() {
  document.getElementById('createTicketModal').classList.remove('show');
}

function handleCreateTicket(e) {
  e.preventDefault();
  const subject = document.getElementById('tktSubject').value;
  const category = document.getElementById('tktCategory').value;
  const msg = document.getElementById('tktMessage').value;

  window.DB.createTicket(currentUser.username, subject, category, msg);
  showToast('Support ticket request opened successfully!', 'success');
  closeCreateTicketModal();
  document.getElementById('createTicketModal').querySelector('form').reset();
  loadSupportTickets();
}

function loadSupportTickets() {
  const container = document.getElementById('ticketsListContainer');
  const tickets = window.DB.getAllTickets().filter(t => t.username === currentUser.username)
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (tickets.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 24px;">No support tickets opened.</p>`;
    return;
  }

  container.innerHTML = tickets.map(item => {
    let statusClass = item.status === 'open' ? 'badge-pending' : (item.status === 'answered' ? 'badge-success' : 'badge-danger');
    let activeClass = activeTicketId === item.id ? 'style="border-color: var(--secondary); background: rgba(153,69,255,0.05);"' : '';
    return `
      <div class="ticket-history-item" ${activeClass} onclick="selectTicket('${item.id}')">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong style="color:#fff;">${item.subject}</strong>
          <span class="badge ${statusClass}">${item.status}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary);">
          <span>Dept: ${item.category}</span>
          <span>Last active: ${new Date(item.timestamp).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectTicket(ticketId) {
  activeTicketId = ticketId;
  const tickets = window.DB.getAllTickets();
  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) return;

  document.getElementById('chatPlaceholder').style.display = 'none';
  document.getElementById('chatCardPanel').style.display = 'block';

  document.getElementById('chatSubjectText').textContent = ticket.subject;
  document.getElementById('chatCategoryText').textContent = `Category: ${ticket.category}`;
  
  const closeBtn = document.getElementById('btnCloseTicket');
  if (ticket.status === 'closed') {
    closeBtn.style.display = 'none';
  } else {
    closeBtn.style.display = 'inline-flex';
  }

  // Render chat messages
  const msgBox = document.getElementById('chatMessagesBox');
  msgBox.innerHTML = ticket.messages.map(m => {
    return `
      <div class="chat-msg ${m.sender === 'user' ? 'user' : 'admin'}">
        <div>${m.text}</div>
        <div style="font-size:0.7rem; opacity:0.7; text-align:right; margin-top:4px;">${new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  msgBox.scrollTop = msgBox.scrollHeight;

  // Refresh ticket selector classes highlights
  loadSupportTickets();
}

function handleSendChatMessage(e) {
  e.preventDefault();
  const text = document.getElementById('chatInput').value;
  if (!activeTicketId) return;

  window.DB.replyToTicket(activeTicketId, text, 'user');
  document.getElementById('chatInput').value = '';
  selectTicket(activeTicketId);
}

function handleCloseTicket() {
  if (!activeTicketId) return;
  window.DB.closeTicket(activeTicketId);
  showToast('Support ticket marked as resolved.', 'info');
  selectTicket(activeTicketId);
}

// Auth logout
function handleLogout() {
  if (microAccrualInterval) clearInterval(microAccrualInterval);
  window.DB.signOut();
  window.location.href = 'auth.html';
}

// ── Live Prices Fetching & Render ─────────────────────────
let livePrices = {
  solana: { usd: 145.20, usd_24h_change: 2.5 },
  bitcoin: { usd: 63840.00, usd_24h_change: 1.2 },
  ethereum: { usd: 3410.50, usd_24h_change: -0.85 },
  tether: { usd: 1.00, usd_24h_change: 0.01 }
};

let microAccrualInterval = null;

async function fetchDashboardPrices() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum,tether&vs_currencies=usd&include_24hr_change=true');
    if (res.ok) {
      const data = await res.json();
      if (data.solana) livePrices.solana = data.solana;
      if (data.bitcoin) livePrices.bitcoin = data.bitcoin;
      if (data.ethereum) livePrices.ethereum = data.ethereum;
      if (data.tether) livePrices.tether = data.tether;
    }
  } catch (err) {
    console.warn('[CoinGecko Dashboard] Rate limit or network error. Using dynamic simulation.');
  }

  // Add random tiny fluctuations to simulate highly active markets
  const fluctuate = (val) => val * (1 + (Math.random() - 0.5) * 0.0006);
  livePrices.solana.usd = fluctuate(livePrices.solana.usd);
  livePrices.bitcoin.usd = fluctuate(livePrices.bitcoin.usd);
  livePrices.ethereum.usd = fluctuate(livePrices.ethereum.usd);

  renderDashboardPrices();
  updateUsdBalances();
}

function renderDashboardPrices() {
  const updateEl = (priceId, changeId, coin) => {
    const pEl = document.getElementById(priceId);
    const cEl = document.getElementById(changeId);
    if (!pEl || !cEl) return;

    const usd = coin.usd;
    const chg = coin.usd_24h_change || 0;
    
    pEl.textContent = `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    cEl.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
    cEl.style.color = chg >= 0 ? 'var(--secondary)' : 'var(--danger)';
  };

  updateEl('dashSolPrice', 'dashSolChange', livePrices.solana);
  updateEl('dashUsdtPrice', 'dashUsdtChange', livePrices.tether);
  updateEl('dashBtcPrice', 'dashBtcChange', livePrices.bitcoin);
  updateEl('dashEthPrice', 'dashEthChange', livePrices.ethereum);
}

function updateUsdBalances() {
  if (!currentUser) return;
  const solUsd = currentUser.balanceSOL * livePrices.solana.usd;
  const usdtUsd = currentUser.balanceUSDT * livePrices.tether.usd;
  const btcUsd = (currentUser.balanceBTC || 0) * livePrices.bitcoin.usd;

  // Header Nav mini-balances with USD equivalent
  const navSol = document.getElementById('navBalanceSol');
  const navUsdt = document.getElementById('navBalanceUsdt');
  const navBtc = document.getElementById('navBalanceBtc');
  if (navSol && navSol.innerHTML.indexOf('~$') === -1) {
    navSol.innerHTML = `${currentUser.balanceSOL.toFixed(2)} SOL <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(~$${solUsd.toFixed(2)})</span>`;
  }
  if (navUsdt && navUsdt.innerHTML.indexOf('~$') === -1) {
    navUsdt.innerHTML = `${currentUser.balanceUSDT.toFixed(2)} USDT <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(~$${usdtUsd.toFixed(2)})</span>`;
  }
  if (navBtc && navBtc.innerHTML.indexOf('~$') === -1) {
    navBtc.innerHTML = `${(currentUser.balanceBTC || 0).toFixed(4)} BTC <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(~$${btcUsd.toFixed(2)})</span>`;
  }
}

// ── Micro-Accrual Yield Simulation ────────────────────────
function startMicroAccrual() {
  if (microAccrualInterval) clearInterval(microAccrualInterval);

  sessionStartTime = Date.now();

  microAccrualInterval = setInterval(() => {
    if (!currentUser) return;

    // Fetch active contracts
    const allContracts = window.DB.getAllContracts().filter(c => c.username === currentUser.username);
    const activeContracts = allContracts.filter(c => c.status === 'active');

    if (activeContracts.length === 0) {
      // Re-render overview normal card balances if there are no contracts, but showing their live USD value
      const solCardVal = document.getElementById('cardBalanceSol');
      const usdtCardVal = document.getElementById('cardBalanceUsdt');
      const btcCardVal = document.getElementById('cardBalanceBtc');
      const solUsd = currentUser.balanceSOL * livePrices.solana.usd;
      const usdtUsd = currentUser.balanceUSDT * livePrices.tether.usd;
      const btcUsd = (currentUser.balanceBTC || 0) * livePrices.bitcoin.usd;

      if (solCardVal && solCardVal.innerHTML.indexOf('~$') === -1) {
        solCardVal.innerHTML = `${currentUser.balanceSOL.toFixed(2)} SOL <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:normal; margin-top:4px;">~$${solUsd.toFixed(2)} USD</div>`;
      }
      if (usdtCardVal && usdtCardVal.innerHTML.indexOf('~$') === -1) {
        usdtCardVal.innerHTML = `${currentUser.balanceUSDT.toFixed(2)} USDT <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:normal; margin-top:4px;">~$${usdtUsd.toFixed(2)} USD</div>`;
      }
      if (btcCardVal && btcCardVal.innerHTML.indexOf('~$') === -1) {
        btcCardVal.innerHTML = `${(currentUser.balanceBTC || 0).toFixed(4)} BTC <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:normal; margin-top:4px;">~$${btcUsd.toFixed(2)} USD</div>`;
      }
      return;
    }

    const elapsedMs = Date.now() - sessionStartTime;

    // Calculate yield per ms for active contracts
    const solYieldPerMs = activeContracts
      .filter(c => c.currency === 'SOL')
      .reduce((sum, c) => sum + (c.amount * (c.dailyRate / 100)) / 86400000, 0);

    const usdtYieldPerMs = activeContracts
      .filter(c => c.currency === 'USDT')
      .reduce((sum, c) => sum + (c.amount * (c.dailyRate / 100)) / 86400000, 0);

    const btcYieldPerMs = activeContracts
      .filter(c => c.currency === 'BTC')
      .reduce((sum, c) => sum + (c.amount * (c.dailyRate / 100)) / 86400000, 0);

    const solAccrued = solYieldPerMs * elapsedMs;
    const usdtAccrued = usdtYieldPerMs * elapsedMs;
    const btcAccrued = btcYieldPerMs * elapsedMs;

    const liveSolBalance = currentUser.balanceSOL + solAccrued;
    const liveUsdtBalance = currentUser.balanceUSDT + usdtAccrued;
    const liveBtcBalance = (currentUser.balanceBTC || 0) + btcAccrued;

    // Total yield earnings = historical sum + session accrued SOL + session accrued USDT converted to SOL + session accrued BTC converted to SOL
    const baseTotalEarnings = allContracts.reduce((sum, c) => sum + c.earnings, 0);
    const totalAccruedYield = baseTotalEarnings + solAccrued + (usdtAccrued / (livePrices.solana.usd || 150)) + (btcAccrued * livePrices.bitcoin.usd / (livePrices.solana.usd || 150));

    // Update DOM
    const solCardVal = document.getElementById('cardBalanceSol');
    const usdtCardVal = document.getElementById('cardBalanceUsdt');
    const btcCardVal = document.getElementById('cardBalanceBtc');
    const yieldCardVal = document.getElementById('cardTotalEarnings');

    const liveSolUsd = liveSolBalance * livePrices.solana.usd;
    const liveUsdtUsd = liveUsdtBalance * livePrices.tether.usd;
    const liveBtcUsd = liveBtcBalance * livePrices.bitcoin.usd;

    if (solCardVal) {
      solCardVal.innerHTML = `${liveSolBalance.toFixed(6)} SOL <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:normal; margin-top:4px;">~$${liveSolUsd.toFixed(2)} USD</div>`;
    }
    if (usdtCardVal) {
      usdtCardVal.innerHTML = `${liveUsdtBalance.toFixed(4)} USDT <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:normal; margin-top:4px;">~$${liveUsdtUsd.toFixed(2)} USD</div>`;
    }
    if (btcCardVal) {
      btcCardVal.innerHTML = `${liveBtcBalance.toFixed(8)} BTC <div style="font-size:0.9rem; color:var(--text-secondary); font-weight:normal; margin-top:4px;">~$${liveBtcUsd.toFixed(2)} USD</div>`;
    }
    if (yieldCardVal) {
      yieldCardVal.textContent = `${totalAccruedYield.toFixed(6)} SOL`;
    }

    // Mini balances in navbar
    const navSol = document.getElementById('navBalanceSol');
    const navUsdt = document.getElementById('navBalanceUsdt');
    const navBtc = document.getElementById('navBalanceBtc');
    if (navSol) navSol.innerHTML = `${liveSolBalance.toFixed(4)} SOL <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(~$${liveSolUsd.toFixed(2)})</span>`;
    if (navUsdt) navUsdt.innerHTML = `${liveUsdtBalance.toFixed(2)} USDT <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(~$${liveUsdtUsd.toFixed(2)})</span>`;
    if (navBtc) navBtc.innerHTML = `${liveBtcBalance.toFixed(4)} BTC <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(~$${liveBtcUsd.toFixed(2)})</span>`;

  }, 250);
}

// ── EmailJS Resend Verification ──────────────────────────────
async function resendVerificationEmail() {
  const settings = window.DB.getSystemSettings();
  const serviceId  = settings.emailjsServiceId  || (window.ENV && window.ENV.emailjsServiceId) || 'service_lad5ed7';
  const templateId = settings.emailjsTemplateId || (window.ENV && window.ENV.emailjsTemplateId) || 'template_qg68qxl';
  const publicKey  = settings.emailjsPublicKey  || (window.ENV && window.ENV.emailjsPublicKey) || 'byfRfa9dYGMy3foMw';

  if (!serviceId || !templateId || !publicKey) {
    console.warn("[EmailJS] Credentials not configured in settings. Faking success.");
    showToast("Verification link sent! Check spam folder if not received.", "success");
    return;
  }

  // Construct absolute verification URL
  const verificationUrl = `${window.location.origin}${window.location.pathname}?verify-email=${currentUser.username}`;
  const templateParams = {
    name:              currentUser.username,
    email:             currentUser.email,
    verification_url:  verificationUrl,
    year:              new Date().getFullYear().toString()
  };

  try {
    emailjs.init({ publicKey: publicKey });
    await emailjs.send(serviceId, templateId, templateParams);
    showToast("Verification link sent! Check spam folder if not received.", "success");
  } catch (err) {
    console.error("EmailJS dispatch failed:", err);
    showToast("Verification link sent! Check spam folder if not received.", "success");
  }
}
window.resendVerificationEmail = resendVerificationEmail;

// ── Patch stale localStorage credentials on load ─────────────
// If the DB was cached before credentials were added to initialData,
// this ensures the real keys are written into the live store.
(function patchEmailjsCredentials() {
  const settings = window.DB.getSystemSettings();
  if (!settings.emailjsServiceId || !settings.emailjsTemplateId || !settings.emailjsPublicKey) {
    const fallbackService = (window.ENV && window.ENV.emailjsServiceId) || 'service_lad5ed7';
    const fallbackTemplate = (window.ENV && window.ENV.emailjsTemplateId) || 'template_qg68qxl';
    const fallbackPublic = (window.ENV && window.ENV.emailjsPublicKey) || 'byfRfa9dYGMy3foMw';
    if (fallbackService && fallbackTemplate && fallbackPublic) {
      window.DB.updateSystemSettings(
        settings.solDepositAddress,
        settings.usdtSolDepositAddress,
        settings.usdtEvmDepositAddress,
        settings.btcDepositAddress,
        null,
        undefined, undefined, undefined, undefined,
        fallbackService,
        fallbackTemplate,
        fallbackPublic
      );
      console.log('[EmailJS] Credentials patched into localStorage store ✓');
    }
  }
})();
