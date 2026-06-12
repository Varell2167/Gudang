/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
let currentType  = 'masuk';
let acIndex      = -1;
let transactions = JSON.parse(localStorage.getItem('wh_tx') || '[]');

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */
function formatDate(d) {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
       + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function saveToStorage() { localStorage.setItem('wh_tx', JSON.stringify(transactions)); }
function nextId() { return transactions.length ? Math.max(...transactions.map(t => t.id)) + 1 : 1; }

/** Stok bersih per barang: { nama: qty } */
function getStock() {
  const s = {};
  transactions.forEach(t => {
    if (!s[t.item]) s[t.item] = 0;
    s[t.item] += t.type === 'masuk' ? t.qty : -t.qty;
  });
  return s;
}

/** Total qty keluar per barang */
function getOutTotals() {
  const o = {};
  transactions.filter(t => t.type === 'keluar').forEach(t => {
    o[t.item] = (o[t.item] || 0) + t.qty;
  });
  return o;
}

/** Timestamp transaksi keluar terakhir per barang */
function getLastOutDate() {
  const d = {};
  transactions.filter(t => t.type === 'keluar').forEach(t => {
    const ts = parseDate(t.time);
    if (!d[t.item] || ts > d[t.item]) d[t.item] = ts;
  });
  return d;
}

/** Parse tanggal dari string formatDate */
function parseDate(str) {
  // "12 Jun 2025 14:30"
  return new Date(str.replace(/(\d{2}) (\w{3}) (\d{4}) (\d{2}:\d{2})/, '$2 $1 $3 $4'));
}

function getItemNames() { return [...new Set(transactions.map(t => t.item))]; }

function daysSince(date) {
  return Math.floor((Date.now() - date) / 86400000);
}

/* ═══════════════════════════════════════
   TAB NAVIGATION
═══════════════════════════════════════ */
function switchTab(tab) {
  document.getElementById('tabTransaksi').style.display = tab === 'transaksi' ? '' : 'none';
  document.getElementById('tabDashboard').style.display = tab === 'dashboard' ? '' : 'none';
  document.querySelectorAll('.nav-tab').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0 && tab === 'transaksi') || (i === 1 && tab === 'dashboard'));
  });
  if (tab === 'dashboard') renderDashboard();
}

/* ═══════════════════════════════════════
   TYPE TOGGLE
═══════════════════════════════════════ */
function setType(type) {
  currentType = type;
  document.getElementById('btnIn').className  = 'type-btn' + (type === 'masuk'  ? ' active-in'  : '');
  document.getElementById('btnOut').className = 'type-btn' + (type === 'keluar' ? ' active-out' : '');
  updateHint();
}

/* ═══════════════════════════════════════
   AUTOCOMPLETE
═══════════════════════════════════════ */
function onItemInput() {
  const val   = document.getElementById('itemName').value.trim();
  const names = getItemNames();
  const dd    = document.getElementById('acDropdown');
  const stok  = getStock();
  const matched = val ? names.filter(n => n.toLowerCase().includes(val.toLowerCase())) : names;

  let html = '';
  matched.forEach(name => {
    const qty = stok[name] ?? 0;
    html += `<div class="ac-item" data-name="${name}" onmousedown="selectItem('${name.replace(/'/g,"\\'")}')">
      <span class="ac-icon">📦</span>
      <span class="ac-name">${highlight(name, val)}</span>
      <span class="ac-stock">${qty} unit</span>
    </div>`;
  });
  const isNew = val && !names.some(n => n.toLowerCase() === val.toLowerCase());
  if (isNew) {
    html += `<div class="ac-item ac-new" data-name="${val}" onmousedown="selectItem('${val.replace(/'/g,"\\'")}')">
      <span class="ac-icon">＋</span>
      <span class="ac-name">Tambah "<strong>${val}</strong>" sebagai barang baru</span>
    </div>`;
  }
  acIndex = -1;
  if (html) { dd.innerHTML = html; dd.classList.add('open'); } else { dd.classList.remove('open'); }
  updateHint();
}

function highlight(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark style="background:rgba(79,142,247,.25);color:var(--accent);border-radius:2px">$1</mark>');
}

function selectItem(name) {
  document.getElementById('itemName').value = name;
  document.getElementById('acDropdown').classList.remove('open');
  acIndex = -1; updateHint();
  document.getElementById('qty').focus();
}

function hideDropdown() {
  setTimeout(() => document.getElementById('acDropdown').classList.remove('open'), 150);
}

function onItemKeydown(e) {
  const dd = document.getElementById('acDropdown');
  const items = dd.querySelectorAll('.ac-item');
  if (!dd.classList.contains('open')) return;
  if (e.key === 'ArrowDown')  { e.preventDefault(); acIndex = Math.min(acIndex + 1, items.length - 1); updateActiveItem(items); }
  else if (e.key === 'ArrowUp')  { e.preventDefault(); acIndex = Math.max(acIndex - 1, 0); updateActiveItem(items); }
  else if (e.key === 'Enter')    { e.preventDefault(); if (acIndex >= 0 && items[acIndex]) selectItem(items[acIndex].dataset.name); }
  else if (e.key === 'Escape')   { dd.classList.remove('open'); acIndex = -1; }
}

function updateActiveItem(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === acIndex));
  if (items[acIndex]) items[acIndex].scrollIntoView({ block: 'nearest' });
}

function updateHint() {
  const val   = document.getElementById('itemName').value.trim();
  const hint  = document.getElementById('itemHint');
  const names = getItemNames();
  const stok  = getStock();
  if (!val) { hint.textContent = ''; hint.className = 'input-hint'; return; }
  const exists = names.some(n => n.toLowerCase() === val.toLowerCase());
  if (exists) {
    const realName = names.find(n => n.toLowerCase() === val.toLowerCase());
    const qty = stok[realName] ?? 0;
    if (currentType === 'keluar' && qty <= 0) {
      hint.textContent = `⚠ Stok "${realName}" habis (0 unit)`; hint.className = 'input-hint err';
    } else {
      hint.textContent = `✓ Stok saat ini: ${qty} unit`; hint.className = 'input-hint ok';
    }
  } else {
    hint.textContent = '✦ Barang baru — akan ditambahkan otomatis'; hint.className = 'input-hint new';
  }
}

/* ═══════════════════════════════════════
   TAMBAH TRANSAKSI
═══════════════════════════════════════ */
function addTransaction() {
  const itemVal = document.getElementById('itemName').value.trim();
  const qtyVal  = parseInt(document.getElementById('qty').value);
  const noteVal = document.getElementById('note').value.trim();

  if (!itemVal) { showToast('⚠️ Nama barang tidak boleh kosong.'); return; }
  if (!qtyVal || qtyVal < 1) { showToast('⚠️ Masukkan jumlah yang valid.'); return; }

  if (currentType === 'keluar') {
    const stok  = getStock();
    const avail = stok[itemVal] || 0;
    if (qtyVal > avail) { showToast(`❌ Stok "${itemVal}" tidak mencukupi (tersisa ${avail} unit).`); return; }
  }

  transactions.unshift({ id: nextId(), time: formatDate(new Date()), item: itemVal, type: currentType, qty: qtyVal, note: noteVal });
  saveToStorage();

  document.getElementById('itemName').value = '';
  document.getElementById('qty').value      = '';
  document.getElementById('note').value     = '';
  document.getElementById('acDropdown').classList.remove('open');
  document.getElementById('itemHint').textContent = '';
  document.getElementById('itemHint').className   = 'input-hint';

  render();
  showToast(currentType === 'masuk' ? '✅ Barang masuk berhasil dicatat!' : '✅ Barang keluar berhasil dicatat!');
}

/* ═══════════════════════════════════════
   HAPUS SEMUA
═══════════════════════════════════════ */
function clearHistory() {
  if (!confirm('Hapus semua data? Tindakan ini tidak dapat dibatalkan.')) return;
  transactions = []; saveToStorage(); render();
  showToast('🗑️ Semua data dihapus.');
}

/* ═══════════════════════════════════════
   RENDER TRANSAKSI
═══════════════════════════════════════ */
function render() {
  const stok    = getStock();
  const maxStok = Math.max(...Object.values(stok), 1);

  document.getElementById('statTotal').textContent  = transactions.length;
  document.getElementById('statIn').textContent     = transactions.filter(t => t.type === 'masuk').reduce((s, t) => s + t.qty, 0);
  document.getElementById('statOut').textContent    = transactions.filter(t => t.type === 'keluar').reduce((s, t) => s + t.qty, 0);
  document.getElementById('statItems').textContent  = Object.keys(stok).length;

  // ── Riwayat: tabel desktop ──
  const tbody = document.getElementById('historyBody');
  if (!transactions.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Belum ada transaksi.</td></tr>';
  } else {
    tbody.innerHTML = transactions.map((t, i) => `
      <tr>
        <td class="td-no">${transactions.length - i}</td>
        <td class="td-time">${t.time}</td>
        <td class="td-name">${t.item}</td>
        <td><span class="badge ${t.type === 'masuk' ? 'in' : 'out'}"><span class="dot"></span>${t.type === 'masuk' ? 'Masuk' : 'Keluar'}</span></td>
        <td class="qty ${t.type === 'masuk' ? 'in' : 'out'}">${t.type === 'masuk' ? '+' : '-'}${t.qty}</td>
        <td class="td-note">${t.note || '—'}</td>
      </tr>`).join('');
  }

  // ── Riwayat: kartu mobile ──
  const cards = document.getElementById('historyCards');
  if (!transactions.length) {
    cards.innerHTML = '<p class="empty">Belum ada transaksi.</p>';
  } else {
    cards.innerHTML = transactions.map(t => `
      <div class="tx-card">
        <div class="tx-card-top">
          <div class="tx-card-name">${t.item}</div>
          <span class="badge ${t.type === 'masuk' ? 'in' : 'out'}">
            <span class="dot"></span>${t.type === 'masuk' ? 'Masuk' : 'Keluar'}
          </span>
          <span class="qty ${t.type === 'masuk' ? 'in' : 'out'}" style="font-size:.95rem">
            ${t.type === 'masuk' ? '+' : '-'}${t.qty}
          </span>
        </div>
        <div class="tx-card-bottom">
          <span class="tx-card-time">🕐 ${t.time}</span>
          ${t.note ? `<span class="tx-card-note">📝 ${t.note}</span>` : ''}
        </div>
      </div>`).join('');
  }

  // Stok bars
  const colors = ['#4f8ef7','#22c55e','#f59e0b','#a78bfa','#f472b6','#34d399'];
  const barsEl = document.getElementById('stockBars');
  if (!Object.keys(stok).length) {
    barsEl.innerHTML = '<p class="empty">Belum ada data stok.</p>';
  } else {
    barsEl.innerHTML = Object.entries(stok).map(([nama, qty], i) => {
      const pct   = Math.max(0, (qty / maxStok) * 100);
      const warna = qty <= 0 ? '#ef4444' : colors[i % colors.length];
      return `<div class="stock-bar-row">
        <div class="stock-bar-label" title="${nama}">${nama}</div>
        <div class="stock-bar-track"><div class="stock-bar-fill" style="width:${pct}%;background:${warna}"></div></div>
        <div class="stock-bar-qty" style="color:${qty<=0?'var(--red)':'var(--muted)'}">${qty}</div>
      </div>`;
    }).join('');
  }
}

/* ═══════════════════════════════════════
   RENDER DASHBOARD
═══════════════════════════════════════ */
function renderDashboard() {
  const stok       = getStock();
  const outTotals  = getOutTotals();
  const lastOut    = getLastOutDate();
  const allItems   = getItemNames();
  const LOW_STOCK  = 5;   // threshold hampir habis
  const STALE_DAYS = 7;   // hari tidak terjual

  const totalUnit   = Object.values(stok).reduce((s, v) => s + Math.max(0, v), 0);
  const hampirHabis = Object.entries(stok).filter(([, q]) => q > 0 && q <= LOW_STOCK);
  const habis       = Object.entries(stok).filter(([, q]) => q <= 0).length;

  // ── Stat Cards Dashboard ──
  document.getElementById('dashStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Unit di Gudang</div>
      <div class="stat-value blue">${totalUnit}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Jenis Barang</div>
      <div class="stat-value blue">${allItems.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Hampir Habis</div>
      <div class="stat-value yellow">${hampirHabis.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Stok Habis</div>
      <div class="stat-value red">${habis}</div>
    </div>`;

  // ── 1. Total Stok ──
  const elTotalStok = document.getElementById('dashTotalStok');
  if (!allItems.length) {
    elTotalStok.innerHTML = '<p class="empty">Belum ada data.</p>';
  } else {
    const maxQ = Math.max(...Object.values(stok).map(q => Math.max(0, q)), 1);
    elTotalStok.innerHTML = Object.entries(stok)
      .sort((a, b) => b[1] - a[1])
      .map(([nama, qty]) => {
        const pct   = Math.max(0, (qty / maxQ) * 100);
        const cls   = qty <= 0 ? 'red' : qty <= LOW_STOCK ? 'yellow' : 'green';
        const label = qty <= 0 ? 'Habis' : qty <= LOW_STOCK ? 'Kritis' : 'Aman';
        return `<div class="dash-item">
          <div class="dash-item-name" title="${nama}">${nama}</div>
          <div class="mini-bar-wrap">
            <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${pct}%;background:${qty<=0?'var(--red)':qty<=LOW_STOCK?'var(--yellow)':'var(--green)'}"></div></div>
          </div>
          <span class="dash-badge ${cls}">${qty} unit</span>
          <span class="dash-badge ${cls}" style="margin-left:4px">${label}</span>
        </div>`;
      }).join('');
  }

  // ── 2. Hampir Habis ──
  const elHampirHabis = document.getElementById('dashHampirHabis');
  if (!hampirHabis.length) {
    elHampirHabis.innerHTML = '<p class="empty">Semua stok aman ✅</p>';
  } else {
    elHampirHabis.innerHTML = hampirHabis
      .sort((a, b) => a[1] - b[1])
      .map(([nama, qty]) => {
        const cls = qty <= 2 ? 'red' : 'yellow';
        return `<div class="dash-item">
          <div class="dash-item-name" title="${nama}">${nama}</div>
          <div class="dash-item-meta">Tersisa</div>
          <span class="dash-badge ${cls}">${qty} unit</span>
        </div>`;
      }).join('');
  }

  // ── 3. Paling Laku ──
  const elPalingLaku = document.getElementById('dashPalingLaku');
  const outEntries = Object.entries(outTotals).sort((a, b) => b[1] - a[1]);
  if (!outEntries.length) {
    elPalingLaku.innerHTML = '<p class="empty">Belum ada transaksi keluar.</p>';
  } else {
    const maxOut = outEntries[0][1];
    const medals = ['🥇','🥈','🥉'];
    elPalingLaku.innerHTML = outEntries.slice(0, 5).map(([nama, qty], i) => {
      const pct = (qty / maxOut) * 100;
      return `<div class="dash-item">
        <span class="rank">${medals[i] || `#${i+1}`}</span>
        <div class="mini-bar-wrap">
          <div class="dash-item-name" title="${nama}" style="margin-bottom:0">${nama}</div>
        </div>
        <span class="dash-badge blue">${qty} unit</span>
      </div>`;
    }).join('');
  }

  // ── 4. Lama Tidak Terjual ──
  const elLama = document.getElementById('dashLamaTidakTerjual');
  const now    = Date.now();

  // Barang yang punya stok tapi tidak ada transaksi keluar, atau terakhir keluar > STALE_DAYS hari
  const staleItems = allItems
    .filter(nama => (stok[nama] || 0) > 0)  // hanya yang masih ada stoknya
    .map(nama => {
      const last = lastOut[nama] ? daysSince(lastOut[nama]) : null;
      return { nama, last };
    })
    .filter(({ last }) => last === null || last >= STALE_DAYS)
    .sort((a, b) => {
      // null (belum pernah terjual) paling atas
      if (a.last === null && b.last === null) return 0;
      if (a.last === null) return -1;
      if (b.last === null) return 1;
      return b.last - a.last;
    });

  if (!staleItems.length) {
    elLama.innerHTML = '<p class="empty">Semua barang aktif bergerak 👍</p>';
  } else {
    elLama.innerHTML = staleItems.slice(0, 5).map(({ nama, last }) => {
      const label = last === null ? 'Belum pernah terjual' : `${last} hari lalu`;
      const cls   = last === null || last >= 30 ? 'red' : last >= 14 ? 'yellow' : 'purple';
      return `<div class="dash-item">
        <div class="dash-item-name" title="${nama}">${nama}</div>
        <div class="dash-item-meta">Keluar terakhir</div>
        <span class="dash-badge ${cls}">${label}</span>
      </div>`;
    }).join('');
  }
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* INIT */
render();