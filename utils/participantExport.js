/**
 * Utility functions for exporting participant data in various formats
 */

/**
 * Generate CSV for participants
 * @param {Array} participants - Array of participant objects
 * @param {Object} options - Export options (subEventNames mapping, etc.)
 * @returns {String} - CSV formatted string
 */
function generateParticipantCSV(participants, options = {}) {
    const { subEventMap = {}, type = 'full' } = options;

    if (type === 'nominated') {
        const headers = ['Chest No.', 'Full Name', 'Contact Info', 'Status'];
        let csvContent = headers.join(',') + '\n';
        participants.forEach(p => {
            const contact = `${p.email} / ${p.mobile}`;
            const row = [
                p.chestNumber || '',
                escapeCSV(p.fullName || ''),
                escapeCSV(contact),
                'Nominated'
            ];
            csvContent += row.join(',') + '\n';
        });
        return csvContent;
    }

    const headers = [
        'Chest No.',
        'Full Name',
        'Email',
        'Mobile',
        'PRN',
        'College',
        'Branch',
        'Year',
        'Sub-Events',
        'Reg. Status',
        'Paid Amount',
        'Transaction ID',
        'Registration Date'
    ];

    let csvContent = headers.join(',') + '\n';

    participants.forEach(participant => {
        const subEvents = participant.registeredSubEvents
            ? participant.registeredSubEvents.map(se => {
                if (typeof se === 'object' && se.name) return se.name;
                return subEventMap[se] || 'Unknown';
            }).join('; ')
            : '';

        const regDate = participant.createdAt
            ? new Date(participant.createdAt).toLocaleDateString()
            : 'N/A';

        const row = [
            participant.chestNumber || '',
            escapeCSV(participant.fullName || ''),
            escapeCSV(participant.email || ''),
            escapeCSV(participant.mobile || ''),
            escapeCSV(participant.prn || ''),
            escapeCSV(participant.college || ''),
            escapeCSV(participant.branch || ''),
            participant.year || '',
            escapeCSV(subEvents),
            participant.registrationStatus || '',
            participant.paidAmount || 0,
            escapeCSV(participant.transactionId || ''),
            escapeCSV(regDate)
        ];

        csvContent += row.join(',') + '\n';
    });

    return csvContent;
}

/**
 * Generate HTML for participants
 * @param {Array} participants - Array of participant objects
 * @param {Object} options - Export options (title, subEventNames mapping, etc.)
 * @returns {String} - HTML formatted string
 */
function generateParticipantHTML(participants, options = {}) {
    const { title = 'Participant List', subEventMap = {}, type = 'full' } = options;

    let logoBase64 = '';
    try {
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(__dirname, '../../frontend/public/Mavericks_Logo.png');
        logoBase64 = fs.readFileSync(logoPath).toString('base64');
    } catch (err) {
        console.error('Logo Read Error for HTML:', err);
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --bg: #f8fafc;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --white: rgba(255, 255, 255, 0.9);
            --border: #e2e8f0;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            padding: 40px 20px;
            line-height: 1.5;
            min-height: 100vh;
        }

        .watermark-fix {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80vw;
            height: 80vh;
            max-width: 600px;
            max-height: 600px;
            background-image: url('data:image/png;base64,${logoBase64}');
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            opacity: 0.12;
            z-index: 0;
            pointer-events: none;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: var(--white);
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            position: relative;
            z-index: 10;
            backdrop-filter: blur(4px);
        }

        .header {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            padding: 40px;
            color: white;
            text-align: center;
        }

        .header h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 1.1rem; }

        .meta {
            padding: 20px 40px;
            background: #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            font-size: 0.9rem;
            color: var(--text-muted);
        }

        .stats {
            display: flex;
            gap: 24px;
            padding: 24px 40px;
            background: #f8fafc;
        }

        .stat-item {
            background: white;
            padding: 16px 24px;
            border-radius: 12px;
            border: 1px solid var(--border);
            flex: 1;
        }

        .stat-label { font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; }
        .stat-value { font-size: 1.5rem; font-weight: 800; color: var(--primary); }

        .table-container { padding: 0 40px 40px; overflow-x: auto; }

        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 24px;
        }

        th {
            background: #f8fafc;
            padding: 16px;
            text-align: left;
            font-size: 0.75rem;
            text-transform: uppercase;
            font-weight: 700;
            color: var(--text-muted);
            border-bottom: 2px solid var(--border);
            letter-spacing: 0.05em;
        }

        td {
            padding: 16px;
            font-size: 0.875rem;
            border-bottom: 1px solid var(--border);
        }

        tr:last-child td { border-bottom: none; }
        tr:hover { background-color: #f1f5f9; }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: capitalize;
        }

        .badge-approved { background: #dcfce7; color: #166534; }
        .badge-pending { background: #fef9c3; color: #854d0e; }
        .badge-rejected { background: #fee2e2; color: #991b1b; }
        .badge-incomplete { background: #f1f5f9; color: #475569; }

        .sub-event-tag {
            display: inline-block;
            background: #e0e7ff;
            color: #4338ca;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.7rem;
            margin: 2px;
            font-weight: 500;
        }

        .footer {
            padding: 32px;
            text-align: center;
            background: #f8fafc;
            border-top: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 0.875rem;
        }

        @media print {
            body { padding: 0; background: white; }
            .container { box-shadow: none; border-radius: 0; max-width: 100%; }
            .header { background: var(--primary) !important; color: white !important; -webkit-print-color-adjust: exact; }
            .badge { border: 1px solid #ccc; }
        }
    </style>
</head>
<body>
    <div class="watermark-fix"></div>
    <div class="container">
        <div class="header">
            <h1>Verbafest 2026</h1>
            <p>${title}</p>
        </div>

        <div class="meta">
            <div>Generated by Admin Panel</div>
            <div>Date: ${new Date().toLocaleString()}</div>
        </div>

        ${type !== 'nominated' ? `
        <div class="stats">
            <div class="stat-item">
                <div class="stat-label">Total Selected</div>
                <div class="stat-value">${participants.length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Approved</div>
                <div class="stat-value">${participants.filter(p => p.registrationStatus === 'approved').length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Pending</div>
                <div class="stat-value">${participants.filter(p => p.registrationStatus === 'pending').length}</div>
            </div>
        </div>
        ` : ''}

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        ${type === 'nominated' ? `
                            <th>Chest #</th>
                            <th>Student Name</th>
                            <th>Contact Info</th>
                            <th>Status</th>
                        ` : `
                            <th>Chest #</th>
                            <th>Name</th>
                            <th>Mobile & Email</th>
                            <th>College & Branch</th>
                            <th>Sub-Events</th>
                            <th>Status</th>
                            <th>Payment</th>
                        `}
                    </tr>
                </thead>
                <tbody>
                    ${participants.map(p => `
                        <tr>
                            ${type === 'nominated' ? `
                                <td style="font-weight: 700; color: var(--primary);">#${p.chestNumber || '---'}</td>
                                <td style="font-weight: 600;">${escapeHTML(p.fullName)}</td>
                                <td>
                                    <div>${escapeHTML(p.mobile || 'N/A')}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(p.email || 'N/A')}</div>
                                </td>
                                <td><span class="badge badge-approved" style="background: #dcfce7; color: #166534;">Nominated</span></td>
                            ` : `
                                <td style="font-weight: 700; color: var(--primary);">#${p.chestNumber || '---'}</td>
                                <td>
                                    <div style="font-weight: 600;">${escapeHTML(p.fullName)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">PRN: ${escapeHTML(p.prn || 'N/A')}</div>
                                </td>
                                <td>
                                    <div>${escapeHTML(p.mobile)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(p.email)}</div>
                                </td>
                                <td>
                                    <div>${escapeHTML(p.college || 'N/A')}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(p.branch || 'N/A')} (${p.year || '?'} Year)</div>
                                </td>
                                <td>
                                    ${p.registeredSubEvents && p.registeredSubEvents.length > 0
            ? p.registeredSubEvents.map(se => `
                                            <span class="sub-event-tag">${escapeHTML(typeof se === 'object' ? se.name : (subEventMap[se] || 'Sub-Event'))}</span>
                                          `).join('')
            : '<span style="color: #cbd5e1;">None</span>'
        }
                                </td>
                                <td>
                                    <span class="badge badge-${p.registrationStatus || 'incomplete'}">${p.registrationStatus || 'incomplete'}</span>
                                </td>
                                <td>
                                    <div style="font-weight: 600;">₹${p.paidAmount || 0}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">TXN: ${escapeHTML(p.transactionId || 'N/A')}</div>
                                </td>
                            `}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>&copy; 2026 Verbafest - Official Event Management Participant Report</p>
        </div>
    </div>
</body>
</html>
    `;

    return html;
}

/**
 * Escape CSV special characters
 */
function escapeCSV(text) {
    if (typeof text !== 'string') return text;
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
    generateParticipantCSV,
    generateParticipantHTML
};
