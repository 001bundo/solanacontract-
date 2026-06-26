// Solana Contract Admin Portal Controller

let currentAdmin = null;
let activeTicketId = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupNavigation();
  initData();

  // Listen for database updates from other windows/tabs
  window.addEventListener('solanacontract_db_update', () => {
    initData();
  });
});

// Admin Authentication Check
function checkAuth() {
  currentAdmin = window.DB.getCurrentUser();
  if (!currentAdmin) {
    window.location.href = 'auth.html?admin=true';
    return;
  }
  if (!currentAdmin.isAdmin) {
    window.location.href = 'dashboard.html';
    return;
  }
}

// Tab Switching
function setupNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const panels = document.querySelectorAll('.tab-panel');
  const titleEl = document.getElementById('dashPageTitle');

  function handleTabChange(hash) {
    let targetTab = hash.replace('#', '') || 'overview';
    
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

    panels.forEach(panel => {
      if (panel.id === `panel-${targetTab}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    toggleSidebar(false);

    const formattedTitle = targetTab.charAt(0).toUpperCase() + targetTab.slice(1).replace('-', ' ');
    titleEl.textContent = targetTab === 'overview' ? 'Auditor Overview' : formattedTitle;

    // Load tab-specific renders
    if (targetTab === 'tickets') {
      loadSupportTickets();
    } else if (targetTab === 'settings') {
      loadPlatformSettings();
    }
  }

  window.addEventListener('hashchange', () => {
    handleTabChange(window.location.hash);
  });

  if (window.location.hash) {
    handleTabChange(window.location.hash);
  } else {
    window.location.hash = '#overview';
  }
}

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

// Toast Alert
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
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

// Render Overview Statistics & Synchronize states
function initData() {
  const users = window.DB.getAllUsers();
  const deposits = window.DB.getAllDeposits();
  const withdrawals = window.DB.getAllWithdrawals();
  const contracts = window.DB.getAllContracts();
  const tickets = window.DB.getAllTickets();

  // Pending Actions Counts
  const pendingDeps = deposits.filter(d => d.status === 'pending');
  const pendingWths = withdrawals.filter(w => w.status === 'pending');
  const openTkts = tickets.filter(t => t.status === 'open');

  const pendingCount = pendingDeps.length + pendingWths.length;

  // Update Navigation menu badging counts
  updateBadgeCount('badgePendingDeposits', pendingDeps.length);
  updateBadgeCount('badgePendingWithdrawals', pendingWths.length);
  updateBadgeCount('badgeOpenTickets', openTkts.length);

  // Overview Stats
  const approvedDepositsSOL = deposits.filter(d => d.status === 'approved' && d.currency === 'SOL').reduce((sum, d) => sum + d.amount, 0);
  const approvedDepositsUSDT = deposits.filter(d => d.status === 'approved' && d.currency === 'USDT').reduce((sum, d) => sum + d.amount, 0);
  
  document.getElementById('adminStatDeposits').innerHTML = `${approvedDepositsSOL.toFixed(1)} SOL <span style="font-size:0.9rem; color:var(--text-secondary);">/ ${approvedDepositsUSDT.toFixed(0)} USDT</span>`;

  const activeStakedSOL = contracts.filter(c => c.status === 'active' && c.currency === 'SOL').reduce((sum, c) => sum + c.amount, 0);
  const activeStakedUSDT = contracts.filter(c => c.status === 'active' && c.currency === 'USDT').reduce((sum, c) => sum + c.amount, 0);
  document.getElementById('adminStatStaked').innerHTML = `${activeStakedSOL.toFixed(1)} SOL <span style="font-size:0.9rem; color:var(--text-secondary);">/ ${activeStakedUSDT.toFixed(0)} USDT</span>`;

  document.getElementById('adminStatUsers').textContent = `${users.length} Members`;
  document.getElementById('adminStatPending').textContent = `${pendingCount} Task${pendingCount === 1 ? '' : 's'}`;

  // Alert Card highlight glow
  const pendingCard = document.getElementById('pendingAlertCard');
  if (pendingCount > 0) {
    pendingCard.classList.add('pending-alert');
  } else {
    pendingCard.classList.remove('pending-alert');
  }

  // Render Sublists
  renderOverviewSublists(pendingDeps, pendingWths);
  renderUserDatabase(users);
  renderDepositsPanel(pendingDeps);
  renderWithdrawalsPanel(pendingWths);
}

function updateBadgeCount(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) {
    el.textContent = count;
    el.style.display = 'inline-flex';
  } else {
    el.style.display = 'none';
  }
}

// Overview mini queues render
function renderOverviewSublists(pendingDeps, pendingWths) {
  const depBox = document.getElementById('overviewDepositsList');
  const wthBox = document.getElementById('overviewWithdrawalsList');

  // Deposits
  if (pendingDeps.length === 0) {
    depBox.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding-top:40px;">No pending deposits.</p>`;
  } else {
    depBox.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">` + 
      pendingDeps.slice(0, 4).map(d => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(8,9,12,0.3); border:1px solid var(--border-glass); border-radius:8px;">
          <div>
            <strong style="color:#fff;">${d.username}</strong>
            <div style="font-size:0.75rem; color:var(--text-secondary);">${d.amount} ${d.currency}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#deposits'"><i class="fa-solid fa-check"></i> Audit</button>
        </div>
      `).join('') + `</div>`;
  }

  // Withdrawals
  if (pendingWths.length === 0) {
    wthBox.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding-top:40px;">No pending withdrawals.</p>`;
  } else {
    wthBox.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">` + 
      pendingWths.slice(0, 4).map(w => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(8,9,12,0.3); border:1px solid var(--border-glass); border-radius:8px;">
          <div>
            <strong style="color:#fff;">${w.username}</strong>
            <div style="font-size:0.75rem; color:var(--text-secondary);">${w.amount} ${w.currency}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.location.hash='#withdrawals'"><i class="fa-solid fa-check"></i> Audit</button>
        </div>
      `).join('') + `</div>`;
  }
}

// User Database Renders
function renderUserDatabase(users) {
  const tbody = document.getElementById('adminUserTableBody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No members registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => {
    if (user.isAdmin) return ''; // Hide admin from list for security

    let kycClass = user.kycStatus === 'verified' ? 'badge-success' : (user.kycStatus === 'pending' ? 'badge-pending' : 'badge-danger');
    let statusChecked = user.isActive ? 'checked' : '';
    
    // KYC Action badge/button with click overrides
    let kycActionHtml = '';
    if (user.kycStatus === 'pending') {
      kycActionHtml = `
        <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
          <button class="btn btn-outline btn-sm" style="color:var(--warning); border-color:rgba(255,184,0,0.3); padding:4px 8px; font-size:0.75rem;" onclick="openDocViewerModal('${user.username}')"><i class="fa-solid fa-id-card"></i> Verify</button>
          <span class="badge badge-pending" style="cursor:pointer;" onclick="openKycAuditModal('${user.username}', 'pending')" title="Quick change status"><i class="fa-solid fa-pen-to-square"></i></span>
        </div>
      `;
    } else {
      kycActionHtml = `<span class="badge ${kycClass}" style="cursor:pointer;" onclick="openKycAuditModal('${user.username}', '${user.kycStatus}')" title="Click to change status">${user.kycStatus.toUpperCase()}</span>`;
    }

    return `
      <tr data-username="${user.username}" data-email="${user.email}">
        <td><strong>${user.username}</strong></td>
        <td style="color:var(--text-secondary); font-size:0.85rem;">${user.email}</td>
        <td><strong style="color:var(--primary);">${user.balanceSOL.toFixed(2)} SOL</strong></td>
        <td><strong style="color:var(--secondary);">${user.balanceUSDT.toFixed(2)} USDT</strong></td>
        <td><strong style="color:var(--warning);">${(user.balanceBTC || 0).toFixed(4)} BTC</strong></td>
        <td style="text-align:center;">${kycActionHtml}</td>
        <td style="text-align:center;">${user.referralsCount || 0}</td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-primary btn-sm" onclick="openBalanceModal('${user.username}')"><i class="fa-solid fa-money-bill-transfer"></i> Edit Bal</button>
            <label class="switch-container">
              <input type="checkbox" class="switch-checkbox" ${statusChecked} onchange="handleUserToggleActive('${user.username}')">
              <div class="toggle-switch"></div>
            </label>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// User lookup search filter
function filterUserTable() {
  const query = document.getElementById('userSearchInput').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#adminUserTableBody tr');

  rows.forEach(row => {
    const user = row.dataset.username || '';
    const email = row.dataset.email || '';
    if (user.includes(query) || email.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// User toggles state (active/inactive)
function handleUserToggleActive(username) {
  const active = window.DB.toggleUserActive(username);
  showToast(`Account for ${username} has been ${active ? 'activated' : 'suspended'}.`, active ? 'success' : 'warning');
  initData();
}

// Balance adjustments modal
function openBalanceModal(username) {
  document.getElementById('balanceModalUser').value = username;
  document.getElementById('balanceModalTitle').textContent = `Adjust Balance for ${username}`;
  loadCurrentBalanceForAdjustment();
  document.getElementById('balanceModal').classList.add('show');
}

function loadCurrentBalanceForAdjustment() {
  const username = document.getElementById('balanceModalUser').value;
  const asset = document.getElementById('balanceAsset').value;
  const users = window.DB.getAllUsers();
  const user = users.find(u => u.username === username);
  if (user) {
    const val = asset === 'SOL' ? user.balanceSOL : (asset === 'USDT' ? user.balanceUSDT : user.balanceBTC);
    document.getElementById('balanceValue').value = val || 0;
  }
}

function closeBalanceModal() {
  document.getElementById('balanceModal').classList.remove('show');
}

function handleBalanceSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('balanceModalUser').value;
  const asset = document.getElementById('balanceAsset').value;
  const value = document.getElementById('balanceValue').value;

  const success = window.DB.updateUserBalance(username, asset, value);
  if (success) {
    showToast(`Balance updated for ${username}!`, 'success');
    closeBalanceModal();
    initData();
  } else {
    showToast('Failed to modify user ledger balance.', 'error');
  }
}

// KYC Document preview viewer
function openDocViewerModal(username) {
  const users = window.DB.getAllUsers();
  const user = users.find(u => u.username === username);
  if (!user || !user.kycDetails) return;

  document.getElementById('viewKycUsername').value = username;
  document.getElementById('docViewerModalTitle').textContent = `KYC Verification: ${username}`;
  document.getElementById('viewKycCountry').textContent = user.kycDetails.country;
  document.getElementById('viewKycDocDetails').textContent = `${user.kycDetails.docType} (No: ${user.kycDetails.docNumber})`;
  
  // Simulated document scan path
  document.getElementById('viewKycDocImage').src = `https://picsum.photos/400/300?random=${Math.random()}`;

  document.getElementById('docViewerModal').classList.add('show');
}

function closeDocViewerModal() {
  document.getElementById('docViewerModal').classList.remove('show');
}

function handleVerifyKYC(status) {
  const username = document.getElementById('viewKycUsername').value;
  window.DB.updateUserKYC(username, status);
  showToast(`KYC status for ${username} set to ${status.toUpperCase()}!`, 'success');
  closeDocViewerModal();
  initData();
}

// Deposits Auditing Panel
function renderDepositsPanel(pending) {
  const tbody = document.getElementById('adminDepositsTableBody');
  if (!tbody) return;

  if (pending.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No pending deposit requests.</td></tr>`;
    return;
  }

  tbody.innerHTML = pending.map(item => {
    return `
      <tr>
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td><strong>${item.username}</strong></td>
        <td><strong style="color:var(--secondary);">${item.amount} ${item.currency}</strong></td>
        <td style="font-family:monospace; font-size:0.85rem;" title="${item.txHash}">${item.txHash.substr(0,18)}...</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openReceiptViewerModal('${item.id}', '${item.username}')"><i class="fa-solid fa-image"></i> View Proof</button>
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-secondary btn-sm" style="color:#0c0d12;" onclick="approveDepositDirect('${item.id}')"><i class="fa-solid fa-check"></i> Approve</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:rgba(255,74,74,0.3);" onclick="rejectDepositDirect('${item.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openReceiptViewerModal(id, username) {
  document.getElementById('receiptViewerId').value = id;
  document.getElementById('receiptViewerUser').textContent = `Investor: ${username}`;
  document.getElementById('receiptViewerImg').src = `https://picsum.photos/400/300?random=${Math.random()}`;
  document.getElementById('receiptViewerModal').classList.add('show');
}

function closeReceiptViewerModal() {
  document.getElementById('receiptViewerModal').classList.remove('show');
}

function approveDepositDirect(id) {
  const success = window.DB.approveDeposit(id);
  if (success) {
    showToast('Deposit request approved and funds credited!', 'success');
    initData();
  } else {
    showToast('Failed to approve transaction.', 'error');
  }
}

function rejectDepositDirect(id) {
  const success = window.DB.rejectDeposit(id);
  if (success) {
    showToast('Deposit receipt rejected.', 'warning');
    initData();
  }
}

function handleApproveReceipt() {
  const id = document.getElementById('receiptViewerId').value;
  approveDepositDirect(id);
  closeReceiptViewerModal();
}

function handleRejectReceipt() {
  const id = document.getElementById('receiptViewerId').value;
  rejectDepositDirect(id);
  closeReceiptViewerModal();
}

// Withdrawal Audits Panel
function renderWithdrawalsPanel(pending) {
  const tbody = document.getElementById('adminWithdrawalsTableBody');
  if (!tbody) return;

  if (pending.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No pending withdrawal requests.</td></tr>`;
    return;
  }

  tbody.innerHTML = pending.map(item => {
    return `
      <tr>
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td><strong>${item.username}</strong></td>
        <td><strong style="color:var(--primary);">${item.amount} ${item.currency}</strong></td>
        <td style="font-family:monospace; font-size:0.85rem;" title="${item.walletAddress}">${item.walletAddress.substr(0,18)}...</td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-secondary btn-sm" style="color:#0c0d12;" onclick="approveWithdrawalDirect('${item.id}')"><i class="fa-solid fa-check"></i> Process Pay</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:rgba(255,74,74,0.3);" onclick="rejectWithdrawalDirect('${item.id}')"><i class="fa-solid fa-xmark"></i> Reject & Refund</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function approveWithdrawalDirect(id) {
  const success = window.DB.approveWithdrawal(id);
  if (success) {
    showToast('Withdrawal marked as approved & processed!', 'success');
    initData();
  }
}

function rejectWithdrawalDirect(id) {
  const success = window.DB.rejectWithdrawal(id);
  if (success) {
    showToast('Withdrawal request rejected. Funds returned to member ledger.', 'info');
    initData();
  }
}

// Platform settings pre-fill and save
function loadPlatformSettings() {
  const settings = window.DB.getSystemSettings();

  document.getElementById('setSolAddr').value  = settings.solDepositAddress || '';
  document.getElementById('setUsdtSolAddr').value = settings.usdtSolDepositAddress || '';
  document.getElementById('setUsdtEvmAddr').value = settings.usdtEvmDepositAddress || '';
  document.getElementById('setBtcAddr').value  = settings.btcDepositAddress || '';

  document.getElementById('rateStarter').value = settings.plans.starter.rate;
  document.getElementById('ratePro').value     = settings.plans.pro.rate;
  document.getElementById('rateWhale').value   = settings.plans.whale.rate;

  // EmailJS integration settings pre-fill
  if (document.getElementById('setEmailServiceId')) {
    document.getElementById('setEmailServiceId').value = settings.emailjsServiceId || '';
  }
  if (document.getElementById('setEmailTemplateId')) {
    document.getElementById('setEmailTemplateId').value = settings.emailjsTemplateId || '';
  }
  if (document.getElementById('setEmailPublicKey')) {
    document.getElementById('setEmailPublicKey').value = settings.emailjsPublicKey || '';
  }

  // Show existing saved QR images if any
  const setupPreview = (savedQR, currentBoxId, currentImgId) => {
    if (savedQR) {
      const box = document.getElementById(currentBoxId);
      const img = document.getElementById(currentImgId);
      if (box && img) { img.src = savedQR; box.style.display = 'block'; }
    } else {
      const box = document.getElementById(currentBoxId);
      if (box) box.style.display = 'none';
    }
  };

  setupPreview(settings.solDepositQR, 'solQRCurrentBox', 'solQRCurrent');
  setupPreview(settings.usdtSolDepositQR, 'usdtSolQRCurrentBox', 'usdtSolQRCurrent');
  setupPreview(settings.usdtEvmDepositQR, 'usdtEvmQRCurrentBox', 'usdtEvmQRCurrent');
  setupPreview(settings.btcDepositQR, 'btcQRCurrentBox', 'btcQRCurrent');
}

// Helper Promise utility to read files as Base64 data strings
function readQRFile(inputEl) {
  return new Promise((resolve) => {
    if (!inputEl || !inputEl.files || !inputEl.files[0]) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(inputEl.files[0]);
  });
}

async function handleSettingsUpdate(e) {
  e.preventDefault();
  const sol  = document.getElementById('setSolAddr').value;
  const usdtSol = document.getElementById('setUsdtSolAddr').value;
  const usdtEvm = document.getElementById('setUsdtEvmAddr').value;
  const btc  = document.getElementById('setBtcAddr').value;

  const currentSettings = window.DB.getSystemSettings();

  const solQR = await readQRFile(document.getElementById('setSolQR')) || currentSettings.solDepositQR;
  const usdtSolQR = await readQRFile(document.getElementById('setUsdtSolQR')) || currentSettings.usdtSolDepositQR;
  const usdtEvmQR = await readQRFile(document.getElementById('setUsdtEvmQR')) || currentSettings.usdtEvmDepositQR;
  const btcQR = await readQRFile(document.getElementById('setBtcQR')) || currentSettings.btcDepositQR;

  window.DB.updateSystemSettings(sol, usdtSol, usdtEvm, btc, null, solQR, usdtSolQR, usdtEvmQR, btcQR);
  showToast('Wallet settings saved successfully!', 'success');
  initData();
  loadPlatformSettings();

  // Reset file previews
  ['setSolQR', 'setUsdtSolQR', 'setUsdtEvmQR', 'setBtcQR'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['solQRPreviewBox', 'usdtSolQRPreviewBox', 'usdtEvmQRPreviewBox', 'btcQRPreviewBox'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const updateBtnText = (btnId, text) => {
    const el = document.getElementById(btnId);
    if (el) el.innerHTML = `<i class="fa-solid fa-qrcode"></i> ${text}`;
  };
  updateBtnText('setSolQRBtn', 'Upload SOL QR / Barcode');
  updateBtnText('setUsdtSolQRBtn', 'Upload USDT Solana QR / Barcode');
  updateBtnText('setUsdtEvmQRBtn', 'Upload USDT EVM QR / Barcode');
  updateBtnText('setBtcQRBtn', 'Upload BTC QR / Barcode');
}

// QR Image live preview helper
function previewQR(inputId, thumbId, previewBoxId, btnId) {
  const file = document.getElementById(inputId).files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const thumb = document.getElementById(thumbId);
    const box   = document.getElementById(previewBoxId);
    const btn   = document.getElementById(btnId);
    if (thumb) thumb.src = ev.target.result;
    if (box)   box.style.display = 'block';
    if (btn)   btn.innerHTML = '<i class="fa-solid fa-check"></i> QR Selected — Change?';
  };
  reader.readAsDataURL(file);
}

function handleRatesUpdate(e) {
  e.preventDefault();
  const settings = window.DB.getSystemSettings();
  
  const starterRate = parseFloat(document.getElementById('rateStarter').value);
  const proRate = parseFloat(document.getElementById('ratePro').value);
  const whaleRate = parseFloat(document.getElementById('rateWhale').value);

  const updatedPlans = { ...settings.plans };
  updatedPlans.starter.rate = starterRate;
  updatedPlans.pro.rate = proRate;
  updatedPlans.whale.rate = whaleRate;
  
  // Also adjust matching usdt and btc plans for parity
  updatedPlans.starter_usdt.rate = starterRate;
  updatedPlans.pro_usdt.rate = proRate;
  updatedPlans.whale_usdt.rate = whaleRate;

  updatedPlans.starter_btc.rate = starterRate;
  updatedPlans.pro_btc.rate = proRate;
  updatedPlans.whale_btc.rate = whaleRate;

  window.DB.updateSystemSettings(settings.solDepositAddress, settings.usdtSolDepositAddress, settings.usdtEvmDepositAddress, settings.btcDepositAddress, updatedPlans);
  showToast('Global yield rate parameters updated!', 'success');
  initData();
}

// ── EmailJS Settings Updates ───────────────────────────────────
function handleEmailSettingsUpdate(e) {
  e.preventDefault();
  const serviceId = document.getElementById('setEmailServiceId').value.trim();
  const templateId = document.getElementById('setEmailTemplateId').value.trim();
  const publicKey = document.getElementById('setEmailPublicKey').value.trim();

  const settings = window.DB.getSystemSettings();
  window.DB.updateSystemSettings(
    settings.solDepositAddress,
    settings.usdtSolDepositAddress,
    settings.usdtEvmDepositAddress,
    settings.btcDepositAddress,
    null,
    undefined,
    undefined,
    undefined,
    undefined,
    serviceId,
    templateId,
    publicKey
  );
  showToast('EmailJS configuration parameters saved successfully!', 'success');
  initData();
}

// ── Admin Change Password Handler ──────────────────────────────
function handleAdminPasswordUpdate(e) {
  e.preventDefault();
  const currentPass = document.getElementById('adminOldPassword').value;
  const newPass = document.getElementById('adminNewPassword').value;
  const confirmPass = document.getElementById('adminConfirmPassword').value;

  if (newPass !== confirmPass) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  const success = window.DB.changePassword(currentAdmin.username, currentPass, newPass);
  if (success) {
    showToast('Password updated successfully!', 'success');
    document.getElementById('settingsPasswordForm').reset();
  } else {
    showToast('Incorrect current password.', 'error');
  }
}

// ── Admin Direct Adding Customer Modals ────────────────────────
function openAddMemberModal() {
  document.getElementById('addMemberModal').classList.add('show');
}

function closeAddMemberModal() {
  document.getElementById('addMemberModal').classList.remove('show');
}

function handleAddMemberSubmit(e) {
  e.preventDefault();
  const userVal = document.getElementById('addMemUser').value.trim();
  const emailVal = document.getElementById('addMemEmail').value.trim();
  const passVal = document.getElementById('addMemPass').value;
  const kycVal = document.getElementById('addMemKyc').value;

  const res = window.DB.signUp(userVal, emailVal, passVal);
  if (res.success) {
    // Set direct KYC override
    window.DB.updateUserKYC(userVal.toLowerCase(), kycVal);
    // Directly verify their email as they were created by admin
    window.DB.verifyEmail(userVal.toLowerCase());

    showToast(`Registered new user account: ${userVal}!`, 'success');
    closeAddMemberModal();
    document.getElementById('addMemberModal').querySelector('form').reset();
    initData();
  } else {
    showToast(res.message || 'Error registering member.', 'error');
  }
}

// ── Admin Direct KYC Override Modals ───────────────────────────
function openKycAuditModal(username, currentStatus) {
  document.getElementById('kycAuditModalUser').value = username;
  document.getElementById('kycAuditStatus').value = currentStatus;
  document.getElementById('kycAuditModalTitle').textContent = `Change KYC Status: ${username}`;
  document.getElementById('kycAuditModal').classList.add('show');
}

function closeKycAuditModal() {
  document.getElementById('kycAuditModal').classList.remove('show');
}

function handleKycAuditSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('kycAuditModalUser').value;
  const newStatus = document.getElementById('kycAuditStatus').value;

  const success = window.DB.updateUserKYC(username, newStatus);
  if (success) {
    showToast(`KYC Audit status for ${username} updated to ${newStatus.toUpperCase()}!`, 'success');
    closeKycAuditModal();
    initData();
  } else {
    showToast('Failed to modify KYC audit status.', 'error');
  }
}

// Support Desk Chat Engine
function loadSupportTickets() {
  const container = document.getElementById('adminTicketsContainer');
  const tickets = window.DB.getAllTickets().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (tickets.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 24px;">No support tickets logged on database.</p>`;
    return;
  }

  container.innerHTML = tickets.map(item => {
    let statusClass = item.status === 'open' ? 'badge-pending' : (item.status === 'answered' ? 'badge-success' : 'badge-danger');
    let activeClass = activeTicketId === item.id ? 'style="border-color: var(--secondary); background: rgba(153,69,255,0.05);"' : '';
    
    return `
      <div class="ticket-history-item" ${activeClass} onclick="selectAdminTicket('${item.id}')">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong style="color:#fff;">${item.subject}</strong>
          <span class="badge ${statusClass}">${item.status}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary);">
          <span>User: ${item.username} | Dept: ${item.category}</span>
          <span>${new Date(item.timestamp).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectAdminTicket(ticketId) {
  activeTicketId = ticketId;
  const tickets = window.DB.getAllTickets();
  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) return;

  document.getElementById('adminChatPlaceholder').style.display = 'none';
  document.getElementById('adminChatCardPanel').style.display = 'block';

  document.getElementById('adminChatSubject').textContent = ticket.subject;
  document.getElementById('adminChatUser').textContent = `User: ${ticket.username} | Category: ${ticket.category}`;

  const closeBtn = document.getElementById('adminChatCardPanel').querySelector('button');
  if (ticket.status === 'closed') {
    closeBtn.style.display = 'none';
  } else {
    closeBtn.style.display = 'inline-flex';
  }

  // Render Messages
  const msgBox = document.getElementById('adminChatMessagesBox');
  msgBox.innerHTML = ticket.messages.map(m => {
    return `
      <div class="chat-msg ${m.sender === 'admin' ? 'user' : 'admin'}">
        <div>${m.text}</div>
        <div style="font-size:0.7rem; opacity:0.7; text-align:right; margin-top:4px;">${new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    `;
  }).join('');

  msgBox.scrollTop = msgBox.scrollHeight;
  loadSupportTickets();
}

function handleAdminSendChatMessage(e) {
  e.preventDefault();
  const text = document.getElementById('adminChatInput').value;
  if (!activeTicketId) return;

  window.DB.replyToTicket(activeTicketId, text, 'admin');
  document.getElementById('adminChatInput').value = '';
  selectAdminTicket(activeTicketId);
}

function handleAdminCloseTicket() {
  if (!activeTicketId) return;
  window.DB.closeTicket(activeTicketId);
  showToast('Support ticket marked as resolved and closed.', 'info');
  selectAdminTicket(activeTicketId);
}

// Log Out
function handleLogout() {
  window.DB.signOut();
  window.location.href = 'auth.html';
}
