let data = [];
let headers = [];
let filteredData = [];
let sortColumn = null;
let sortDirection = 'asc';

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const reportContent = document.getElementById('reportContent');

// File handling
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) loadFile(file);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadFile(e.target.files[0]);
});

document.getElementById('resetBtn').addEventListener('click', resetFilters);
document.getElementById('exportBtn').addEventListener('click', exportFiltered);
document.getElementById('loadNewBtn').addEventListener('click', () => {
    dropZone.classList.remove('hidden');
    reportContent.classList.add('hidden');
    fileInput.value = '';
});

function loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        parseCSV(e.target.result);
        dropZone.classList.add('hidden');
        reportContent.classList.remove('hidden');
    };
    reader.readAsText(file);
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    headers = parseCSVLine(lines[0]);
    data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((h, idx) => row[h] = values[idx]);
            data.push(row);
        }
    }
    
    initializeUI();
    applyFilters();
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function initializeUI() {
    // Method filter
    const methods = [...new Set(data.map(r => r.Method))].sort();
    const methodSelect = document.getElementById('filterMethod');
    methodSelect.innerHTML = '<option value="">All Methods</option>' + 
        methods.map(m => `<option value="${m}">${m}</option>`).join('');
    methodSelect.addEventListener('change', applyFilters);

    // Role filters
    const roleContainer = document.getElementById('roleFiltersContainer');
    roleContainer.innerHTML = '';
    const roleColumns = headers.filter(h => h !== 'Method' && h !== 'URL');
    
    roleColumns.forEach(role => {
        const statuses = [...new Set(data.map(r => r[role]))].sort();
        const div = document.createElement('div');
        div.className = 'filter-group';
        div.innerHTML = `
            <label>${role}</label>
            <select id="filter_${role.replace(/\s/g, '_')}">
                <option value="">All</option>
                ${statuses.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        `;
        roleContainer.appendChild(div);
        div.querySelector('select').addEventListener('change', applyFilters);
    });

    // Table header
    document.getElementById('tableHead').innerHTML = `<tr>
        <th>#</th>
        ${headers.map(h => `<th data-col="${h}">${h} ⇅</th>`).join('')}
    </tr>`;
    
    document.querySelectorAll('#tableHead th[data-col]').forEach(th => {
        th.addEventListener('click', () => sortBy(th.dataset.col));
    });

    // Other listeners
    document.getElementById('searchUrl').addEventListener('input', applyFilters);
    document.getElementById('showInteresting').addEventListener('change', applyFilters);
    document.getElementById('hideOptions').addEventListener('change', applyFilters);
}

function applyFilters() {
    const searchUrl = document.getElementById('searchUrl').value.toLowerCase();
    const filterMethod = document.getElementById('filterMethod').value;
    const showInteresting = document.getElementById('showInteresting').checked;
    const hideOptions = document.getElementById('hideOptions').checked;
    
    const roleColumns = headers.filter(h => h !== 'Method' && h !== 'URL');
    const roleFilters = {};
    roleColumns.forEach(role => {
        const el = document.getElementById(`filter_${role.replace(/\s/g, '_')}`);
        if (el) roleFilters[role] = el.value;
    });

    filteredData = data.filter(row => {
        if (searchUrl && !row.URL.toLowerCase().includes(searchUrl)) return false;
        if (filterMethod && row.Method !== filterMethod) return false;
        if (hideOptions && row.Method === 'OPTIONS') return false;
        
        for (const [role, value] of Object.entries(roleFilters)) {
            if (value && row[role] !== value) return false;
        }
        
        if (showInteresting) {
            const unauthCol = headers.find(h => h.toLowerCase().includes('unauth'));
            if (unauthCol && row[unauthCol] !== 'ACCESSIBLE') return false;
            if (row.Method === 'OPTIONS') return false;
        }
        
        return true;
    });

    if (sortColumn) {
        filteredData.sort((a, b) => {
            const cmp = (a[sortColumn] || '').localeCompare(b[sortColumn] || '');
            return sortDirection === 'asc' ? cmp : -cmp;
        });
    }

    renderTable();
    updateStats();
}

function sortBy(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    applyFilters();
}
    
function renderTable() {
    const tbody = document.getElementById('tableBody');
    const roleColumns = headers.filter(h => h !== 'Method' && h !== 'URL');
    const unauthCol = headers.find(h => h.toLowerCase().includes('unauth'));
    
    tbody.innerHTML = filteredData.map((row, idx) => {
        const isInteresting = unauthCol && row[unauthCol] === 'ACCESSIBLE' && row.Method !== 'OPTIONS';
        
        return `<tr class="${isInteresting ? 'interesting-row' : ''}">
            <td>${idx + 1}</td>
            <td><span class="method method-${row.Method}">${row.Method}</span></td>
            <td class="url">${escapeHtml(row.URL)}</td>
            ${roleColumns.map(role => `<td><span class="status status-${row[role]}">${row[role]}</span></td>`).join('')}
        </tr>`;
    }).join('');

    document.getElementById('resultsInfo').textContent = 
        `Showing ${filteredData.length} of ${data.length} endpoints`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats() {
    const stats = document.getElementById('statsContainer');
    const unauthCol = headers.find(h => h.toLowerCase().includes('unauth'));
    
    let html = `<div class="stat-card total"><h3>Total</h3><div class="value">${filteredData.length}</div></div>`;
    
    if (unauthCol) {
        const counts = {};
        filteredData.forEach(row => {
            counts[row[unauthCol]] = (counts[row[unauthCol]] || 0) + 1;
        });
        
        ['ACCESSIBLE', 'REDIRECT', 'DENIED', 'ERROR', 'UNKNOWN'].forEach(status => {
            if (counts[status]) {
                html += `<div class="stat-card ${status.toLowerCase()}">
                    <h3>${status}</h3>
                    <div class="value">${counts[status]}</div>
                </div>`;
            }
        });
    }
    
    stats.innerHTML = html;
}

function resetFilters() {
    document.getElementById('searchUrl').value = '';
    document.getElementById('filterMethod').value = '';
    document.getElementById('showInteresting').checked = false;
    document.getElementById('hideOptions').checked = false;
    
    headers.filter(h => h !== 'Method' && h !== 'URL').forEach(role => {
        const el = document.getElementById(`filter_${role.replace(/\s/g, '_')}`);
        if (el) el.value = '';
    });
    
    sortColumn = null;
    sortDirection = 'asc';
    applyFilters();
}

function exportFiltered() {
    let csv = headers.join(',') + '\n';
    filteredData.forEach(row => {
        csv += headers.map(h => {
            const val = row[h] || '';
            return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_role_test_report.csv';
    a.click();
    URL.revokeObjectURL(url);
}
