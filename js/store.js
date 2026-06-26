// ============================================================
// Solana Contract — Database Engine (Firebase + localStorage)
// ============================================================
// Architecture:
//   • localStorage acts as a fast in-memory cache for sync reads.
//   • All writes go to BOTH localStorage AND Firestore simultaneously.
//   • An onSnapshot() listener on the Firestore document keeps every
//     open tab / device perfectly in sync in real-time.
// ============================================================

// ── Firebase Configuration ───────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA2xSdfBMXM_BhqxhbcJ-Y06XRoR6KKgWw",
  authDomain: "solanacontract-ad2af.firebaseapp.com",
  projectId: "solanacontract-ad2af",
  storageBucket: "solanacontract-ad2af.firebasestorage.app",
  messagingSenderId: "10689188483",
  appId: "1:10689188483:web:95fe48d0dc45a6792cc1b6",
  measurementId: "G-F9PC8CCM29"
};

// ── Initialize Firebase (guard against duplicate init) ───────
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();
const analytics = firebase.analytics();

// Firestore document reference — the entire app DB lives in one document
const FIRESTORE_DOC = firestore.collection('platform').doc('database');

// localStorage key (used as a fast read cache)
const STORE_KEY = 'solanacontract_db';

// ── Helper: Generate Unique IDs ───────────────────────────────
function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

// ── Seed / Initial Data Structure ────────────────────────────
const initialData = {
  users: [
    {
      username: 'admin',
      email: 'admin@solanacontract.com',
      password: 'admin',
      isAdmin: true,
      balanceSOL: 0,
      balanceUSDT: 0,
      balanceBTC: 0,
      walletSOL: '',
      walletUSDT: '',
      walletBTC: '',
      kycStatus: 'verified',
      google2faEnabled: false,
      referralCode: 'ADMINREF',
      referredBy: null,
      isActive: true,
      emailVerified: true
    },
    {
      username: 'solwhale',
      email: 'whale@solana.io',
      password: 'user123',
      isAdmin: false,
      balanceSOL: 154.25,
      balanceUSDT: 5200.00,
      balanceBTC: 0.85,
      walletSOL: '9WzDXwByH7visZVeSgJFasBiGZ1Z23t7GL562C6tyG2Z',
      walletUSDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      walletBTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      kycStatus: 'verified',
      google2faEnabled: true,
      referralCode: 'WHALESOL',
      referredBy: 'ADMINREF',
      isActive: true,
      emailVerified: true
    },
    {
      username: 'solstar',
      email: 'starter@solana.io',
      password: 'user123',
      isAdmin: false,
      balanceSOL: 1.5,
      balanceUSDT: 20.00,
      balanceBTC: 0.05,
      walletSOL: '4zMMC9Zd1m271S5XbgAvu3vScdFsx7Sjw2X6X4uFdB2z',
      walletUSDT: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
      walletBTC: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
      kycStatus: 'pending',
      kycDetails: {
        country: 'United States',
        docType: 'Passport',
        docNumber: 'N1234567',
        docFile: 'passport_scan.png',
        selfieFile: 'selfie.png'
      },
      google2faEnabled: false,
      referralCode: 'STARTER',
      referredBy: 'WHALESOL',
      isActive: true,
      emailVerified: true
    }
  ],
  deposits: [
    {
      id: 'dep_1',
      username: 'solwhale',
      amount: 250.00,
      currency: 'SOL',
      txHash: '5YzF3vBfM...GzTq9aZ',
      receipt: 'receipt_whale1.jpg',
      status: 'approved',
      timestamp: '2026-06-20T10:30:00Z'
    },
    {
      id: 'dep_2',
      username: 'solwhale',
      amount: 10000.00,
      currency: 'USDT',
      txHash: '0x8f2d...c34b',
      receipt: 'receipt_whale2.jpg',
      status: 'approved',
      timestamp: '2026-06-21T14:45:00Z'
    },
    {
      id: 'dep_3',
      username: 'solstar',
      amount: 5.5,
      currency: 'SOL',
      txHash: '3pQrS...tVwXyZ',
      receipt: 'receipt_star1.jpg',
      status: 'pending',
      timestamp: '2026-06-24T09:15:00Z'
    }
  ],
  withdrawals: [
    {
      id: 'wth_1',
      username: 'solwhale',
      amount: 95.75,
      currency: 'SOL',
      walletAddress: '9WzDXwByH7visZVeSgJFasBiGZ1Z23t7GL562C6tyG2Z',
      status: 'approved',
      timestamp: '2026-06-23T08:12:00Z'
    },
    {
      id: 'wth_2',
      username: 'solwhale',
      amount: 4800.00,
      currency: 'USDT',
      walletAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      status: 'pending',
      timestamp: '2026-06-24T18:30:00Z'
    }
  ],
  contracts: [
    {
      id: 'ctr_1',
      username: 'solwhale',
      planId: 'pro',
      planName: 'SOL Premium (3.5% Daily)',
      amount: 100.00,
      currency: 'SOL',
      dailyRate: 3.5,
      earnings: 14.00,
      durationDays: 30,
      daysElapsed: 4,
      lastPayout: '2026-06-24T10:00:00Z',
      status: 'active',
      timestamp: '2026-06-20T10:00:00Z'
    },
    {
      id: 'ctr_2',
      username: 'solwhale',
      planId: 'whale',
      planName: 'SOL Elite (5.0% Daily)',
      amount: 5000.00,
      currency: 'USDT',
      dailyRate: 5.0,
      earnings: 750.00,
      durationDays: 45,
      daysElapsed: 3,
      lastPayout: '2026-06-24T10:00:00Z',
      status: 'active',
      timestamp: '2026-06-21T10:00:00Z'
    },
    {
      id: 'ctr_3',
      username: 'solstar',
      planId: 'starter',
      planName: 'SOL Starter (2.2% Daily)',
      amount: 4.0,
      currency: 'SOL',
      dailyRate: 2.2,
      earnings: 0.176,
      durationDays: 15,
      daysElapsed: 2,
      lastPayout: '2026-06-24T10:00:00Z',
      status: 'active',
      timestamp: '2026-06-22T10:00:00Z'
    }
  ],
  tickets: [
    {
      id: 'tkt_1',
      username: 'solstar',
      subject: 'Deposit delay support',
      category: 'Deposit',
      status: 'open',
      messages: [
        { sender: 'user', text: 'Hello, I submitted my Solana deposit about an hour ago, but my balance has not updated yet. Can you please check?', timestamp: '2026-06-24T09:30:00Z' }
      ],
      timestamp: '2026-06-24T09:30:00Z'
    },
    {
      id: 'tkt_2',
      username: 'solwhale',
      subject: 'Withdrawal verification',
      category: 'Withdrawal',
      status: 'answered',
      messages: [
        { sender: 'user', text: 'I requested a withdrawal of 4,800 USDT. Do I need additional KYC documents for this amount?', timestamp: '2026-06-24T18:40:00Z' },
        { sender: 'admin', text: 'Hello! Your KYC verification is already fully complete. The withdrawal is in queue and will be processed shortly.', timestamp: '2026-06-24T18:55:00Z' }
      ],
      timestamp: '2026-06-24T18:40:00Z'
    }
  ],
  systemSettings: {
    solDepositAddress: 'SOL_CONTRACT_ADDRESS_DEMO_998877_RANDOM_KEYS',
    usdtDepositAddress: 'USDT_CONTRACT_TRON_DEPOSIT_ADDRESS_0X71C', // legacy TRON
    usdtSolDepositAddress: 'USDT_SOLANA_SPL_DEPOSIT_ADDRESS_DEMO_KJSFDG',
    usdtEvmDepositAddress: '0xUSDT_EVM_ERC20_DEPOSIT_ADDRESS_DEMO_0X71C',
    btcDepositAddress: '1BTC_NATIVE_DEPOSIT_ADDRESS_DEMO_KJSFDG',
    solDepositQR: '',
    usdtDepositQR: '', // legacy
    usdtSolDepositQR: '',
    usdtEvmDepositQR: '',
    btcDepositQR: '',
    emailjsServiceId: (window.ENV && window.ENV.emailjsServiceId) || '',
    emailjsTemplateId: (window.ENV && window.ENV.emailjsTemplateId) || '',
    emailjsPublicKey: (window.ENV && window.ENV.emailjsPublicKey) || '',
    plans: {
      starter: { name: 'SC Basic', rate: 3.5, min: 1, max: 10, duration: 2, unit: 'SOL' },
      pro: { name: 'SC Plus', rate: 5.0, min: 70, max: 350, duration: 14, unit: 'SOL' },
      whale: { name: 'SC Premium', rate: 7.5, min: 700, max: 7000, duration: 28, unit: 'SOL' },
      starter_usdt: { name: 'SC Basic', rate: 3.5, min: 100, max: 1000, duration: 2, unit: 'USDT' },
      pro_usdt: { name: 'SC Plus', rate: 5.0, min: 10000, max: 50000, duration: 14, unit: 'USDT' },
      whale_usdt: { name: 'SC Premium', rate: 7.5, min: 100000, max: 1000000, duration: 28, unit: 'USDT' },
      starter_btc: { name: 'SC Basic', rate: 3.5, min: 0.002, max: 0.02, duration: 2, unit: 'BTC' },
      pro_btc: { name: 'SC Plus', rate: 5.0, min: 0.2, max: 1.0, duration: 14, unit: 'BTC' },
      whale_btc: { name: 'SC Premium', rate: 7.5, min: 2.0, max: 20.0, duration: 28, unit: 'BTC' }
    }
  }
};

// ── Flag to prevent the local onSnapshot echo ─────────────────
// When we write to Firestore ourselves, the listener will fire.
// This flag lets us skip re-applying our own write back to localStorage.
let _localWritePending = false;

// ── Local Cache Helpers ───────────────────────────────────────
function getDB() {
  const data = localStorage.getItem(STORE_KEY);
  if (!data) {
    // No local cache yet — seed localStorage from initialData.
    // Firestore initialization will either populate from cloud or seed cloud.
    localStorage.setItem(STORE_KEY, JSON.stringify(initialData));
    return initialData;
  }
  const db = JSON.parse(data);
  // Migrate plans if they contain the old names or old minimum limits
  if (db && db.systemSettings && db.systemSettings.plans) {
    const plans = db.systemSettings.plans;
    if (!plans.starter || plans.starter.name === 'SOL Starter' || (plans.starter_usdt && plans.starter_usdt.min === 50)) {
      db.systemSettings.plans = initialData.systemSettings.plans;
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
      console.log('[Store] Migrated stale system plans cache to new SC Basic, SC Plus, SC Premium layout ✓');
    }
  }
  return db;
}

/**
 * Persists `db` to localStorage AND syncs it to Firestore.
 * The `onSnapshot` listener will receive the update from Firestore,
 * but we use `_localWritePending` to avoid a redundant re-write loop.
 */
function saveDB(db) {
  // 1. Write to localStorage immediately (keeps UI fast & synchronous)
  localStorage.setItem(STORE_KEY, JSON.stringify(db));

  // 2. Broadcast change to any other listeners on the same tab
  window.dispatchEvent(new Event('solanacontract_db_update'));

  // 3. Push to Firestore asynchronously (non-blocking)
  _localWritePending = true;
  FIRESTORE_DOC.set(db)
    .then(() => {
      console.log('[Firebase] Database synced to Firestore ✓');
    })
    .catch((err) => {
      console.error('[Firebase] Firestore write error:', err);
    })
    .finally(() => {
      // Allow a brief delay before re-enabling the listener echo guard
      setTimeout(() => { _localWritePending = false; }, 1500);
    });
}

// ── Firebase Real-time Listener ───────────────────────────────
// Listens for any remote change (from another browser/device/admin)
// and merges it into the local cache, triggering UI refresh.
function initFirebaseSync() {
  FIRESTORE_DOC.onSnapshot(
    (snapshot) => {
      if (_localWritePending) {
        // This snapshot was triggered by our own write — skip it
        return;
      }

      if (snapshot.exists) {
        const remoteDB = snapshot.data();
        const localRaw = localStorage.getItem(STORE_KEY);
        const remoteStr = JSON.stringify(remoteDB);

        // Only update if there's actually a difference
        if (localRaw !== remoteStr) {
          console.log('[Firebase] Remote update received — refreshing local cache ✓');
          localStorage.setItem(STORE_KEY, remoteStr);
          // Notify dashboard/admin scripts to re-render
          window.dispatchEvent(new Event('solanacontract_db_update'));
        }
      } else {
        // Firestore doc doesn't exist yet → seed it with initial data
        console.log('[Firebase] No cloud database found — seeding Firestore with initial data...');
        _localWritePending = true;
        FIRESTORE_DOC.set(getDB())
          .then(() => console.log('[Firebase] Cloud database seeded ✓'))
          .catch((err) => console.error('[Firebase] Seed error:', err))
          .finally(() => setTimeout(() => { _localWritePending = false; }, 1500));
      }
    },
    (error) => {
      console.warn('[Firebase] Firestore listener error (running offline with localStorage only):', error.message);
    }
  );
}

// Start the real-time listener
initFirebaseSync();

// ── Main DB API Object ────────────────────────────────────────
const DB = {
  // ── Authentication ────────────────────────────────────────
  signUp(username, email, password, referredByCode = null) {
    const db = getDB();
    username = username.trim().toLowerCase();
    email = email.trim().toLowerCase();

    if (db.users.find(u => u.username === username)) {
      return { success: false, message: 'Username already taken' };
    }
    if (db.users.find(u => u.email === email)) {
      return { success: false, message: 'Email already registered' };
    }

    // Handle referral code
    let referredBy = null;
    if (referredByCode) {
      const sponsor = db.users.find(u => u.referralCode === referredByCode.trim().toUpperCase());
      if (sponsor) {
        referredBy = sponsor.username;
        sponsor.referralsCount = (sponsor.referralsCount || 0) + 1;
      }
    }

    const newUser = {
      username,
      email,
      password,
      isAdmin: false,
      balanceSOL: 0,
      balanceUSDT: 0,
      balanceBTC: 0,
      walletSOL: '',
      walletUSDT: '',
      walletBTC: '',
      kycStatus: 'unverified',
      google2faEnabled: false,
      referralCode: `SOL${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      referredBy,
      isActive: true,
      emailVerified: false
    };

    db.users.push(newUser);
    saveDB(db);
    return { success: true, user: newUser };
  },

  verifyEmail(username) {
    const db = getDB();
    const user = db.users.find(u => u.username === username.trim().toLowerCase());
    if (user) {
      user.emailVerified = true;
      saveDB(db);
      return true;
    }
    return false;
  },

  signIn(usernameOrEmail, password) {
    const db = getDB();
    const loginStr = usernameOrEmail.trim().toLowerCase();
    const user = db.users.find(u =>
      (u.username === loginStr || u.email === loginStr) && u.password === password
    );

    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }
    if (!user.isActive) {
      return { success: false, message: 'Your account has been suspended by administration.' };
    }

    localStorage.setItem('solanacontract_session', user.username);
    return { success: true, user };
  },

  getCurrentUser() {
    const session = localStorage.getItem('solanacontract_session');
    if (!session) return null;
    const db = getDB();
    return db.users.find(u => u.username === session) || null;
  },

  signOut() {
    localStorage.removeItem('solanacontract_session');
  },

  // ── Deposits ──────────────────────────────────────────────
  createDeposit(username, amount, currency, txHash, receiptFile) {
    const db = getDB();
    const newDep = {
      id: generateId('dep'),
      username,
      amount: parseFloat(amount),
      currency,
      txHash: txHash.trim(),
      receipt: receiptFile || 'uploaded_receipt.png',
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    db.deposits.push(newDep);
    saveDB(db);
    return newDep;
  },

  // ── Withdrawals ───────────────────────────────────────────
  createWithdrawal(username, amount, currency, walletAddress) {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    amount = parseFloat(amount);

    if (!user) return { success: false, message: 'User not found' };

    const balanceField = currency === 'SOL' ? 'balanceSOL' : (currency === 'USDT' ? 'balanceUSDT' : 'balanceBTC');
    if (user[balanceField] < amount) {
      return { success: false, message: 'Insufficient balance' };
    }

    // Deduct immediately (escrow)
    user[balanceField] -= amount;

    const newWth = {
      id: generateId('wth'),
      username,
      amount,
      currency,
      walletAddress: walletAddress.trim(),
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    db.withdrawals.push(newWth);
    saveDB(db);
    return { success: true, withdrawal: newWth };
  },

  // ── Internal Fund Transfer ────────────────────────────────
  transferFunds(username, receiverUsername, amount, currency) {
    const db = getDB();
    amount = parseFloat(amount);
    receiverUsername = receiverUsername.trim().toLowerCase();

    if (username === receiverUsername) {
      return { success: false, message: 'Cannot transfer funds to yourself' };
    }

    const sender = db.users.find(u => u.username === username);
    const receiver = db.users.find(u => u.username === receiverUsername);

    if (!receiver) {
      return { success: false, message: 'Recipient username does not exist' };
    }

    const balanceField = currency === 'SOL' ? 'balanceSOL' : (currency === 'USDT' ? 'balanceUSDT' : 'balanceBTC');

    if (sender[balanceField] < amount) {
      return { success: false, message: 'Insufficient balance for transfer' };
    }

    sender[balanceField] -= amount;
    receiver[balanceField] += amount;

    db.deposits.push({
      id: generateId('dep'),
      username: receiverUsername,
      amount,
      currency,
      txHash: `Transfer from ${username}`,
      receipt: 'transfer',
      status: 'approved',
      timestamp: new Date().toISOString()
    });

    db.withdrawals.push({
      id: generateId('wth'),
      username,
      amount,
      currency,
      walletAddress: `Transfer to ${receiverUsername}`,
      status: 'approved',
      timestamp: new Date().toISOString()
    });

    saveDB(db);
    return { success: true, sender, receiver };
  },

  // ── Investments / Contracts ───────────────────────────────
  buyContract(username, planId, amount, currency) {
    const db = getDB();
    amount = parseFloat(amount);
    const user = db.users.find(u => u.username === username);
    if (!user) return { success: false, message: 'User not found' };

    const balanceField = currency === 'SOL' ? 'balanceSOL' : (currency === 'USDT' ? 'balanceUSDT' : 'balanceBTC');
    if (user[balanceField] < amount) {
      return { success: false, message: 'Insufficient balance' };
    }

    const plan = db.systemSettings.plans[planId];
    if (!plan) return { success: false, message: 'Investment plan not found' };

    if (amount < plan.min || amount > plan.max) {
      return { success: false, message: `Investment amount must be between ${plan.min} and ${plan.max} ${currency}` };
    }

    user[balanceField] -= amount;

    const newContract = {
      id: generateId('ctr'),
      username,
      planId,
      planName: `${plan.name} (${plan.rate}% Daily)`,
      amount,
      currency,
      dailyRate: plan.rate,
      earnings: 0,
      durationDays: plan.duration,
      daysElapsed: 0,
      lastPayout: new Date().toISOString(),
      status: 'active',
      timestamp: new Date().toISOString()
    };

    db.contracts.push(newContract);
    saveDB(db);
    return { success: true, contract: newContract };
  },

  // ── Support Tickets ───────────────────────────────────────
  createTicket(username, subject, category, initialMessage) {
    const db = getDB();
    const newTicket = {
      id: generateId('tkt'),
      username,
      subject: subject.trim(),
      category,
      status: 'open',
      messages: [
        { sender: 'user', text: initialMessage.trim(), timestamp: new Date().toISOString() }
      ],
      timestamp: new Date().toISOString()
    };
    db.tickets.push(newTicket);
    saveDB(db);
    return newTicket;
  },

  replyToTicket(ticketId, text, sender) {
    const db = getDB();
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (!ticket) return null;

    ticket.messages.push({
      sender,
      text: text.trim(),
      timestamp: new Date().toISOString()
    });

    ticket.status = sender === 'admin' ? 'answered' : 'open';
    ticket.timestamp = new Date().toISOString();
    saveDB(db);
    return ticket;
  },

  closeTicket(ticketId) {
    const db = getDB();
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.status = 'closed';
      saveDB(db);
    }
  },

  // ── Profile & Settings ────────────────────────────────────
  updateProfile(username, email, walletSOL, walletUSDT, walletBTC) {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return false;

    user.email = email.trim().toLowerCase();
    user.walletSOL = walletSOL.trim();
    user.walletUSDT = walletUSDT.trim();
    if (walletBTC !== undefined) user.walletBTC = walletBTC.trim();
    saveDB(db);
    return true;
  },

  changePassword(username, currentPass, newPass) {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    if (!user || user.password !== currentPass) return false;

    user.password = newPass;
    saveDB(db);
    return true;
  },

  submitKYC(username, country, docType, docNumber, docFile = 'id_document.png') {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return false;

    user.kycStatus = 'pending';
    user.kycDetails = { country, docType, docNumber, docFile, selfieFile: 'selfie.png' };
    saveDB(db);
    return true;
  },

  toggle2FA(username) {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return false;

    user.google2faEnabled = !user.google2faEnabled;
    saveDB(db);
    return user.google2faEnabled;
  },

  // ── Admin Methods ─────────────────────────────────────────
  getAllUsers() { return getDB().users; },
  getAllDeposits() { return getDB().deposits; },
  getAllWithdrawals() { return getDB().withdrawals; },
  getAllContracts() { return getDB().contracts; },
  getAllTickets() { return getDB().tickets; },
  getSystemSettings() { return getDB().systemSettings; },

  updateSystemSettings(solAddr, usdtSolAddr, usdtEvmAddr, btcAddr, newPlans, solQR, usdtSolQR, usdtEvmQR, btcQR, emailServiceId, emailTemplateId, emailPublicKey) {
    const db = getDB();
    db.systemSettings.solDepositAddress = solAddr;
    db.systemSettings.usdtSolDepositAddress = usdtSolAddr;
    db.systemSettings.usdtEvmDepositAddress = usdtEvmAddr;
    db.systemSettings.btcDepositAddress = btcAddr;
    if (newPlans) db.systemSettings.plans = newPlans;
    if (solQR !== undefined) db.systemSettings.solDepositQR = solQR;
    if (usdtSolQR !== undefined) db.systemSettings.usdtSolDepositQR = usdtSolQR;
    if (usdtEvmQR !== undefined) db.systemSettings.usdtEvmDepositQR = usdtEvmQR;
    if (btcQR !== undefined) db.systemSettings.btcDepositQR = btcQR;
    if (emailServiceId !== undefined) db.systemSettings.emailjsServiceId = emailServiceId;
    if (emailTemplateId !== undefined) db.systemSettings.emailjsTemplateId = emailTemplateId;
    if (emailPublicKey !== undefined) db.systemSettings.emailjsPublicKey = emailPublicKey;
    saveDB(db);
  },

  approveDeposit(depositId) {
    const db = getDB();
    const dep = db.deposits.find(d => d.id === depositId);
    if (!dep || dep.status !== 'pending') return false;

    const user = db.users.find(u => u.username === dep.username);
    if (!user) return false;

    dep.status = 'approved';
    const balanceField = dep.currency === 'SOL' ? 'balanceSOL' : (dep.currency === 'USDT' ? 'balanceUSDT' : 'balanceBTC');
    user[balanceField] += dep.amount;

    // Award direct sponsor 5% referral commission
    if (user.referredBy) {
      const sponsor = db.users.find(u => u.username === user.referredBy);
      if (sponsor) {
        const bonus = dep.amount * 0.05;
        sponsor[balanceField] += bonus;
        db.deposits.push({
          id: generateId('dep'),
          username: sponsor.username,
          amount: bonus,
          currency: dep.currency,
          txHash: `Referral Bonus (5%) from ${user.username}`,
          receipt: 'referral',
          status: 'approved',
          timestamp: new Date().toISOString()
        });
      }
    }

    saveDB(db);
    return true;
  },

  rejectDeposit(depositId) {
    const db = getDB();
    const dep = db.deposits.find(d => d.id === depositId);
    if (!dep || dep.status !== 'pending') return false;

    dep.status = 'rejected';
    saveDB(db);
    return true;
  },

  approveWithdrawal(withdrawalId) {
    const db = getDB();
    const wth = db.withdrawals.find(w => w.id === withdrawalId);
    if (!wth || wth.status !== 'pending') return false;

    wth.status = 'approved';
    saveDB(db);
    return true;
  },

  rejectWithdrawal(withdrawalId) {
    const db = getDB();
    const wth = db.withdrawals.find(w => w.id === withdrawalId);
    if (!wth || wth.status !== 'pending') return false;

    // Refund balance
    const user = db.users.find(u => u.username === wth.username);
    if (user) {
      const balanceField = wth.currency === 'SOL' ? 'balanceSOL' : (wth.currency === 'USDT' ? 'balanceUSDT' : 'balanceBTC');
      user[balanceField] += wth.amount;
    }

    wth.status = 'rejected';
    saveDB(db);
    return true;
  },

  updateUserBalance(username, currency, newAmount) {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return false;

    const balanceField = currency === 'SOL' ? 'balanceSOL' : (currency === 'USDT' ? 'balanceUSDT' : 'balanceBTC');
    user[balanceField] = parseFloat(newAmount);
    saveDB(db);
    return true;
  },

  updateUserKYC(username, status) {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return false;

    user.kycStatus = status;
    saveDB(db);
    return true;
  },

  toggleUserActive(username) {
    const db = getDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return false;

    user.isActive = !user.isActive;
    saveDB(db);
    return user.isActive;
  },

  // ── Daily Yield Simulation ────────────────────────────────
  processDailyInterest() {
    const db = getDB();
    let interestPaid = false;

    db.contracts.forEach(contract => {
      if (contract.status === 'active') {
        if (contract.daysElapsed < contract.durationDays) {
          const payoutAmount = contract.amount * (contract.dailyRate / 100);
          contract.earnings += payoutAmount;
          contract.daysElapsed += 1;
          contract.lastPayout = new Date().toISOString();

          const user = db.users.find(u => u.username === contract.username);
          if (user) {
            const balanceField = contract.currency === 'SOL' ? 'balanceSOL' : (contract.currency === 'USDT' ? 'balanceUSDT' : 'balanceBTC');
            user[balanceField] += payoutAmount;
          }

          if (contract.daysElapsed >= contract.durationDays) {
            contract.status = 'completed';
          }
          interestPaid = true;
        }
      }
    });

    if (interestPaid) saveDB(db);
    return interestPaid;
  }
};

// ── Expose to global scope ────────────────────────────────────
window.DB = DB;

// ── Daily interest simulation: fires every 30 seconds for demo ─
setInterval(() => {
  if (window.DB && window.DB.processDailyInterest()) {
    console.log('[Yield Engine] Daily interest simulation processed ✓');
  }
}, 30000);
