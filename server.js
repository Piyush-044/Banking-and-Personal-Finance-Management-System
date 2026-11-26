const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'data', 'database.json');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/* ============================================================
   Database Helper Functions (File-based JSON persistence)
   ============================================================ */
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { users: [], accounts: [], transactions: [] };
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { users: [], accounts: [], transactions: [] };
  }
}

function writeDB(data) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing to database file:', err);
    return false;
  }
}

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-id, Authorization'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

function findUser(db, identifier) {
  if (!identifier) return null;
  const idLower = String(identifier).trim().toLowerCase();
  return db.users.find(u =>
    (u.id && u.id.toLowerCase() === idLower) ||
    (u.email && u.email.toLowerCase() === idLower) ||
    (u.customerId && u.customerId.toLowerCase() === idLower) ||
    (u.fullName && u.fullName.toLowerCase() === idLower)
  );
}

function generateCardNumber(network) {
  const net = String(network || 'Visa').toLowerCase();
  const prefix = net === 'mastercard' ? '5412' : net === 'rupay' ? '6011' : net === 'amex' ? '3782' : '4532';
  const g2 = Math.floor(1000 + Math.random() * 9000);
  const g3 = Math.floor(1000 + Math.random() * 9000);
  const g4 = Math.floor(1000 + Math.random() * 9000);
  return `${prefix} ${g2} ${g3} ${g4}`;
}

function generateExpiry() {
  const month = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
  const year = String(28 + Math.floor(Math.random() * 5));
  return `${month}/${year}`;
}

function generateCVV(network) {
  const net = String(network || 'Visa').toLowerCase();
  if (net === 'amex') return String(Math.floor(1000 + Math.random() * 9000));
  return String(Math.floor(100 + Math.random() * 900));
}

function createStarterAccounts(user, businessMode) {
  const holder = (user.fullName || 'APEX USER').toUpperCase();
  const baseTs = Date.now();
  return [
    {
      id: `acc_${baseTs}_1`,
      userId: user.id,
      accountNumber: generateCardNumber('Visa'),
      accountType: 'checking',
      cardType: 'debit',
      cardNetwork: 'Visa',
      expiry: generateExpiry(),
      cvv: generateCVV('Visa'),
      cardholderName: holder,
      title: businessMode ? 'Commercial Business Checking' : 'Everyday Checking Account',
      balance: businessMode ? 200000.00 : 150000.00,
      currency: user.currency || 'INR',
      status: 'Active'
    },
    {
      id: `acc_${baseTs}_2`,
      userId: user.id,
      accountNumber: generateCardNumber('RuPay'),
      accountType: 'savings',
      cardType: 'debit',
      cardNetwork: 'RuPay',
      expiry: generateExpiry(),
      cvv: generateCVV('RuPay'),
      cardholderName: holder,
      title: 'High-Yield Growth Savings (4.25% APY)',
      balance: businessMode ? 750000.00 : 500000.00,
      currency: user.currency || 'INR',
      status: 'Active'
    },
    {
      id: `acc_${baseTs}_3`,
      userId: user.id,
      accountNumber: generateCardNumber('Mastercard'),
      accountType: 'credit',
      cardType: 'credit',
      cardNetwork: 'Mastercard',
      expiry: generateExpiry(),
      cvv: generateCVV('Mastercard'),
      cardholderName: holder,
      title: 'Apex Platinum Credit Card',
      balance: 0,
      creditLimit: businessMode ? 500000 : 250000,
      currency: user.currency || 'INR',
      status: 'Active'
    }
  ];
}

/* ============================================================
   REST API Request Router
   ============================================================ */
async function handleApiRequest(req, res, pathname, queryParams) {
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-id, Authorization'
    });
    return res.end();
  }

  const db = readDB();

  // 1. POST /api/auth/login
  if (method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/login')) {
    const body = await parseBody(req);
    const identifier = body.identifier || body.email || body.username;

    if (!identifier) {
      return sendJSON(res, 400, { success: false, error: 'Email or User ID is required' });
    }

    let user = findUser(db, identifier);

    // If user does not exist in DB, create on-the-fly dynamically
    if (!user) {
      const raw = String(identifier).trim();
      const isEmail = raw.includes('@');
      const baseName = isEmail ? raw.split('@')[0] : raw;
      const parts = baseName.split(/[._\-+\s]+/).filter(Boolean);
      const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      const firstName = parts[0] ? cap(parts[0]) : 'User';
      const lastName = parts.slice(1).map(cap).join(' ');
      const fullName = (firstName + ' ' + lastName).trim();
      const email = isEmail ? raw.toLowerCase() : `${firstName.toLowerCase()}${lastName ? '.' + lastName.toLowerCase().replace(/\s+/g, '') : ''}@apexbank.com`;
      const custNum = Math.floor(100000 + Math.random() * 900000);
      const customerId = `APX-${custNum}`;
      const firstInit = firstName ? firstName.charAt(0).toUpperCase() : '';
      const lastInit = lastName ? lastName.charAt(0).toUpperCase() : '';

      user = {
        id: `usr_${custNum}`,
        email: email,
        password: body.password || 'ApexPass123!',
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        customerId: customerId,
        phone: '+91 98765 00000',
        dob: '1995-01-01',
        gender: 'other',
        address: 'Downtown Avenue',
        city: 'Mumbai',
        state: 'Maharashtra',
        zip: '400001',
        country: 'IN',
        currency: 'INR',
        avatarType: 'initials',
        avatarInitials: (firstInit + lastInit) || firstName.substring(0, 2).toUpperCase() || 'U',
        avatarImage: '',
        membershipTier: 'Gold Tier',
        twoFactor: true,
        biometric: false,
        highValueLock: true,
        prefTransactions: true,
        prefSecurity: true,
        prefStatements: true,
        prefMarketing: false,
        createdAt: new Date().toISOString()
      };

      db.users.push(user);
      db.accounts.push(...createStarterAccounts(user, false));

      // Starter welcome transaction
      db.transactions.push({
        id: `tx_${Date.now()}`,
        userId: user.id,
        referenceId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        type: 'credit',
        title: 'ApexBank • Account Welcome Bonus',
        category: 'Bonus',
        amount: 5000.00,
        currency: 'INR',
        date: new Date().toISOString(),
        status: 'Completed',
        account: 'Everyday Checking'
      });

      writeDB(db);
    }

    return sendJSON(res, 200, {
      success: true,
      message: 'Logged in successfully',
      user: user
    });
  }

  // 2. POST /api/auth/register
  if (method === 'POST' && (pathname === '/api/auth/register' || pathname === '/api/signup')) {
    const body = await parseBody(req);
    const fullName = (body.fullName || body.fullname || '').trim();
    const email = (body.email || '').trim().toLowerCase();

    if (!fullName || !email) {
      return sendJSON(res, 400, { success: false, error: 'Full name and email are required' });
    }

    // Check if user already exists
    const existing = db.users.find(u => u.email.toLowerCase() === email);
    if (existing) {
      return sendJSON(res, 200, { success: true, message: 'User already registered', user: existing });
    }

    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';
    const custNum = Math.floor(100000 + Math.random() * 900000);
    const customerId = body.customerId || `APX-${custNum}`;
    const firstInit = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInit = lastName ? lastName.charAt(0).toUpperCase() : '';
    const isBusiness = body.account_type === 'business' || body.accountType === 'Business Account';

    const newUser = {
      id: `usr_${custNum}`,
      email: email,
      password: body.password || 'ApexPass123!',
      firstName: firstName,
      lastName: lastName,
      fullName: fullName,
      customerId: customerId,
      phone: body.phone || '+91 98765 00000',
      dob: body.dob || '1995-01-01',
      gender: body.gender || 'other',
      address: body.address || 'Civil Lines',
      city: body.city || 'Mumbai',
      state: body.state || 'Maharashtra',
      zip: body.zip || '400001',
      country: 'IN',
      currency: 'INR',
      avatarType: 'initials',
      avatarInitials: (firstInit + lastInit) || firstName.substring(0, 2).toUpperCase() || 'U',
      avatarImage: '',
      membershipTier: isBusiness ? 'Private Wealth' : 'Gold Tier',
      twoFactor: true,
      biometric: false,
      highValueLock: true,
      prefTransactions: true,
      prefSecurity: true,
      prefStatements: true,
      prefMarketing: false,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.accounts.push(...createStarterAccounts(newUser, isBusiness));

    // Starter transaction
    db.transactions.push({
      id: `tx_${Date.now()}`,
      userId: newUser.id,
      referenceId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      type: 'credit',
      title: 'Initial Account Funding Deposit',
      category: 'Deposit',
      amount: 50000.00,
      currency: 'INR',
      date: new Date().toISOString(),
      status: 'Completed',
      account: 'Everyday Checking'
    });

    writeDB(db);

    return sendJSON(res, 201, {
      success: true,
      message: 'Account registered successfully',
      user: newUser
    });
  }

  // 3. GET /api/user/profile
  if (method === 'GET' && pathname === '/api/user/profile') {
    const identifier = queryParams.get('userId') || queryParams.get('email') || req.headers['x-user-id'];
    const user = findUser(db, identifier) || db.users[0];
    if (!user) {
      return sendJSON(res, 404, { success: false, error: 'User not found' });
    }
    return sendJSON(res, 200, { success: true, user });
  }

  // 4. PUT /api/user/profile (Update Profile)
  if (method === 'PUT' && pathname === '/api/user/profile') {
    const body = await parseBody(req);
    const identifier = body.id || body.email || body.customerId || req.headers['x-user-id'];
    let userIndex = db.users.findIndex(u =>
      (identifier && u.id === identifier) ||
      (identifier && u.email && u.email.toLowerCase() === String(identifier).toLowerCase()) ||
      (identifier && u.customerId && u.customerId.toLowerCase() === String(identifier).toLowerCase())
    );

    if (userIndex === -1) {
      userIndex = 0; // fallback to primary user if unspecified
    }

    const current = db.users[userIndex];
    const updated = Object.assign({}, current, body);

    if (body.firstName || body.lastName) {
      const f = (updated.firstName || '').trim();
      const l = (updated.lastName || '').trim();
      updated.fullName = (f + ' ' + l).trim() || updated.fullName;
      if (updated.avatarType !== 'image') {
        const fi = f ? f.charAt(0).toUpperCase() : '';
        const li = l ? l.charAt(0).toUpperCase() : '';
        updated.avatarInitials = (fi + li) || f.substring(0, 2).toUpperCase() || 'U';
      }
    }

    db.users[userIndex] = updated;
    writeDB(db);

    return sendJSON(res, 200, { success: true, message: 'Profile updated successfully', user: updated });
  }

  // 5. GET /api/accounts
  if (method === 'GET' && pathname === '/api/accounts') {
    const identifier = queryParams.get('userId') || queryParams.get('email') || req.headers['x-user-id'];
    const user = findUser(db, identifier) || db.users[0];
    const userAccounts = db.accounts.filter(a => a.userId === user.id);
    return sendJSON(res, 200, {
      success: true,
      userId: user.id,
      accounts: userAccounts.length ? userAccounts : db.accounts.slice(0, 4)
    });
  }

  // 6. POST /api/accounts/open
  if (method === 'POST' && pathname === '/api/accounts/open') {
    const body = await parseBody(req);
    const identifier = body.userId || body.email || req.headers['x-user-id'];
    const user = findUser(db, identifier) || db.users[0];

    const accType = (body.accountType || 'savings').toLowerCase();
    const cardType = (body.cardType || (accType === 'credit' ? 'credit' : 'debit')).toLowerCase();
    const cardNetwork = body.cardNetwork || (cardType === 'credit' ? 'Mastercard' : 'Visa');
    const holder = (body.cardholderName || user.fullName || 'APEX USER').toUpperCase();
    const depositAmt = parseFloat(body.initialDeposit);
    const initialBal = cardType === 'credit'
      ? 0
      : (!isNaN(depositAmt) && depositAmt >= 0 ? depositAmt : 10000.00);

    const newAcc = {
      id: `acc_${Date.now()}`,
      userId: user.id,
      accountNumber: body.accountNumber || generateCardNumber(cardNetwork),
      accountType: cardType === 'credit' ? 'credit' : accType,
      cardType: cardType,
      cardNetwork: cardNetwork,
      expiry: body.expiry || generateExpiry(),
      cvv: body.cvv || generateCVV(cardNetwork),
      cardholderName: holder,
      title: body.title || `${accType.toUpperCase()} Account`,
      balance: initialBal,
      currency: body.currency || 'INR',
      branch: body.branch || 'Digital Banking Branch',
      nomineeName: body.nomineeName || '',
      nomineeRelation: body.nomineeRelation || '',
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    if (cardType === 'credit') {
      newAcc.creditLimit = !isNaN(parseFloat(body.creditLimit)) ? parseFloat(body.creditLimit) : 300000;
    }

    db.accounts.push(newAcc);

    if (initialBal > 0) {
      db.transactions.unshift({
        id: `tx_${Date.now()}`,
        userId: user.id,
        referenceId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        type: 'credit',
        title: `New Account Opening Deposit • ${newAcc.title}`,
        category: 'Deposit',
        amount: initialBal,
        currency: newAcc.currency,
        date: new Date().toISOString(),
        status: 'Completed',
        account: newAcc.title
      });
    }

    writeDB(db);

    return sendJSON(res, 201, { success: true, message: 'New account opened successfully', account: newAcc });
  }

  // 6b. PUT /api/accounts/update (Edit card number, card type, expiry, CVV, network, title, or status)
  if (method === 'PUT' && (pathname === '/api/accounts/update' || pathname === '/api/accounts')) {
    const body = await parseBody(req);
    const identifier = body.userId || body.email || req.headers['x-user-id'];
    const user = findUser(db, identifier) || db.users[0];
    const accountId = body.id || body.accountId;

    let targetAcc = db.accounts.find(a => a.id === accountId);
    if (!targetAcc) {
      const accType = (body.accountType || 'checking').toLowerCase();
      targetAcc = db.accounts.find(a => a.userId === user.id && a.accountType === accType) || db.accounts.find(a => a.userId === user.id);
    }

    if (!targetAcc) {
      return sendJSON(res, 404, { success: false, error: 'Account not found' });
    }

    if (body.accountNumber !== undefined && String(body.accountNumber).trim()) {
      targetAcc.accountNumber = String(body.accountNumber).trim();
    }
    if (body.title !== undefined && String(body.title).trim()) {
      targetAcc.title = String(body.title).trim();
    }
    if (body.cardType) {
      targetAcc.cardType = String(body.cardType).trim().toLowerCase() === 'credit' ? 'credit' : 'debit';
    }
    if (body.cardNetwork) {
      targetAcc.cardNetwork = String(body.cardNetwork).trim();
    }
    if (body.expiry !== undefined && String(body.expiry).trim()) {
      targetAcc.expiry = String(body.expiry).trim();
    }
    if (body.cvv !== undefined && String(body.cvv).trim()) {
      targetAcc.cvv = String(body.cvv).trim();
    }
    if (body.cardholderName !== undefined && String(body.cardholderName).trim()) {
      targetAcc.cardholderName = String(body.cardholderName).trim().toUpperCase();
    }
    if (body.status) {
      targetAcc.status = String(body.status).trim();
    }
    if (body.creditLimit !== undefined && !isNaN(parseFloat(body.creditLimit))) {
      targetAcc.creditLimit = parseFloat(body.creditLimit);
    }
    if (body.balance !== undefined && !isNaN(parseFloat(body.balance))) {
      targetAcc.balance = parseFloat(body.balance);
    }

    writeDB(db);

    const userAccounts = db.accounts.filter(a => a.userId === user.id);
    return sendJSON(res, 200, {
      success: true,
      message: 'Card / Account details updated and saved to database',
      account: targetAcc,
      accounts: userAccounts
    });
  }

  // 7. GET /api/transactions
  if (method === 'GET' && pathname === '/api/transactions') {
    const identifier = queryParams.get('userId') || queryParams.get('email') || req.headers['x-user-id'];
    const user = findUser(db, identifier) || db.users[0];
    let userTx = db.transactions.filter(t => t.userId === user.id);
    if (!userTx.length) {
      userTx = db.transactions;
    }
    userTx.sort((a, b) => new Date(b.date) - new Date(a.date));
    return sendJSON(res, 200, { success: true, transactions: userTx });
  }

  // 8. POST /api/transactions/transfer
  if (method === 'POST' && pathname === '/api/transactions/transfer') {
    const body = await parseBody(req);
    const identifier = body.userId || body.email || req.headers['x-user-id'];
    const user = findUser(db, identifier) || db.users[0];

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return sendJSON(res, 400, { success: false, error: 'Valid positive amount is required' });
    }

    // Resolve source account
    const userAccounts = db.accounts.filter(a => a.userId === user.id);
    let acc = null;
    if (body.fromAccountId) {
      acc = userAccounts.find(a => a.id === body.fromAccountId);
    }
    if (!acc && body.fromAccountType) {
      acc = userAccounts.find(a => a.accountType === String(body.fromAccountType).toLowerCase());
    }
    if (!acc) {
      acc = userAccounts.find(a => a.accountType === 'checking') || userAccounts[0];
    }

    if (acc && acc.status === 'Frozen') {
      return sendJSON(res, 400, { success: false, error: 'Selected card/account is FROZEN. Unfreeze it first.' });
    }

    if (acc) {
      const isCredit = acc.accountType === 'credit' || acc.cardType === 'credit';
      if (isCredit) {
        const limit = parseFloat(acc.creditLimit) || 250000;
        const used = acc.balance < 0 ? Math.abs(acc.balance) : 0;
        const availCredit = limit - used;
        if (amount > availCredit) {
          return sendJSON(res, 400, { success: false, error: `Insufficient credit limit (Available: ₹${availCredit.toLocaleString('en-IN')})` });
        }
        acc.balance = (parseFloat(acc.balance) || 0) - amount;
      } else {
        if ((parseFloat(acc.balance) || 0) < amount) {
          return sendJSON(res, 400, { success: false, error: `Insufficient balance in ${acc.title}` });
        }
        acc.balance = (parseFloat(acc.balance) || 0) - amount;
      }
    }

    const recipient = body.recipient || 'External Account';
    const txId = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
    const accLast4 = acc && acc.accountNumber ? String(acc.accountNumber).slice(-4) : '4921';
    const accLabel = acc ? `${acc.title.split('(')[0].trim()} (*${accLast4})` : (body.fromAccount || 'Everyday Checking');

    const newTx = {
      id: `tx_${Date.now()}`,
      userId: user.id,
      referenceId: txId,
      type: 'debit',
      title: body.remark ? `${recipient} • ${body.remark}` : `Transfer to ${recipient}`,
      category: body.category || 'Transfer',
      amount: amount,
      currency: 'INR',
      date: new Date().toISOString(),
      status: 'Completed',
      account: accLabel
    };

    db.transactions.unshift(newTx);
    writeDB(db);

    return sendJSON(res, 201, {
      success: true,
      message: `₹${amount.toLocaleString('en-IN')} successfully transferred to ${recipient}`,
      transaction: newTx,
      newBalance: acc ? acc.balance : null,
      account: acc
    });
  }

  // 9. GET /api/stats
  if (method === 'GET' && pathname === '/api/stats') {
    const identifier = queryParams.get('userId') || queryParams.get('email') || req.headers['x-user-id'];
    const user = findUser(db, identifier) || db.users[0];

    const userAccounts = db.accounts.filter(a => a.userId === user.id);
    const checkingBalance = userAccounts
      .filter(a => a.accountType === 'checking')
      .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
    const savingsBalance = userAccounts
      .filter(a => a.accountType === 'savings')
      .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
    const investmentBalance = userAccounts
      .filter(a => a.accountType === 'investment' || a.accountType === 'fd')
      .reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);

    const creditAccounts = userAccounts.filter(a => a.accountType === 'credit' || a.cardType === 'credit');
    const availableCreditLimit = creditAccounts.reduce((sum, a) => {
      const limit = parseFloat(a.creditLimit) || 250000;
      const used = (parseFloat(a.balance) || 0) < 0 ? Math.abs(parseFloat(a.balance)) : 0;
      return sum + Math.max(0, limit - used);
    }, 0);

    const totalNetWorth = userAccounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);

    const userTx = db.transactions.filter(t => t.userId === user.id);
    const monthlyIncome = userTx
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const monthlyExpenses = userTx
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const pendingAmount = userTx
      .filter(t => String(t.status || '').toLowerCase() === 'pending')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const hasAccounts = userAccounts.length > 0;
    const hasTx = userTx.length > 0;

    return sendJSON(res, 200, {
      success: true,
      stats: {
        totalNetWorth: hasAccounts ? totalNetWorth : 1485620.00,
        checkingBalance: hasAccounts ? checkingBalance : 245800.00,
        savingsBalance: hasAccounts ? savingsBalance : 820450.00,
        investmentBalance: hasAccounts ? investmentBalance : 462170.00,
        availableCreditLimit: creditAccounts.length ? availableCreditLimit : 0,
        monthlyIncome: hasTx ? monthlyIncome : 185000.00,
        monthlyExpenses: hasTx ? monthlyExpenses : 42800.00,
        netSavings: hasTx ? (monthlyIncome - monthlyExpenses) : 142200.00,
        pendingAmount: hasTx ? pendingAmount : 0,
        activeAccountsCount: userAccounts.length
      }
    });
  }

  return sendJSON(res, 404, { success: false, error: `API route ${method} ${pathname} not found` });
}

/* ============================================================
   HTTP Server - Serving REST APIs + Static Web Files
   ============================================================ */
const server = http.createServer(async (req, res) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 Bad Request');
  }

  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname.startsWith('/api/')) {
    try {
      await handleApiRequest(req, res, pathname, parsedUrl.searchParams);
    } catch (apiErr) {
      console.error('API Error:', apiErr);
      sendJSON(res, 500, { success: false, error: 'Internal Server Error' });
    }
    return;
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let targetPath = path.join(ROOT_DIR, safePath);

  if (!targetPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(targetPath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    } else if (err && err.code === 'ENOENT') {
      const htmlPath = targetPath + '.html';
      if (fs.existsSync(htmlPath)) {
        targetPath = htmlPath;
      }
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(targetPath, (readErr, content) => {
      if (readErr) {
        if (readErr.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 Not Found | ApexBank</title>
  <link rel="stylesheet" href="/css/auth.css">
  <style>
    body { display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:sans-serif; text-align:center; background:#0f172a; color:#f8fafc; margin:0; }
    .box { background:rgba(30,41,59,0.8); padding:40px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); max-width:440px; }
    h1 { font-size:3.5rem; margin:0 0 10px; color:#38bdf8; }
    p { color:#94a3b8; line-height:1.6; margin-bottom:24px; }
    a { display:inline-block; padding:12px 24px; background:#2563eb; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; }
  </style>
</head>
<body>
  <div class="box">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>The page you are looking for does not exist or may have been moved.</p>
    <a href="/index.html">Return to Dashboard</a>
  </div>
</body>
</html>`);
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Server Error: ' + readErr.code);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 ApexBank Full-Stack Server & REST API is Running!`);
  console.log(`📡 Localhost:     http://localhost:${PORT}/`);
  console.log(`📂 Database:      data/database.json (Persistent Storage)`);
  console.log(`🔗 REST Endpoints:`);
  console.log(`   • POST /api/auth/login`);
  console.log(`   • POST /api/auth/register`);
  console.log(`   • GET  /api/user/profile`);
  console.log(`   • PUT  /api/user/profile`);
  console.log(`   • GET  /api/accounts`);
  console.log(`   • POST /api/accounts/open`);
  console.log(`   • PUT  /api/accounts/update`);
  console.log(`   • GET  /api/transactions`);
  console.log(`   • POST /api/transactions/transfer`);
  console.log(`   • GET  /api/stats`);
  console.log(`=======================================================`);
});
