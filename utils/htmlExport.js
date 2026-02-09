/**
 * Generate HTML for attendance export
 * @param {Array} participants - Array of participant objects
 * @param {Object} options - Export options (type, subEventName, stats, etc.)
 * @returns {String} - HTML formatted string
 */
function generateAttendanceHTML(participants, options = {}) {
    const { type = 'overall', subEventName = '', stats = {}, subEventId = null } = options;

    let logoBase64 = '';
    try {
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(__dirname, '../../frontend/public/Mavericks_Logo.png');
        logoBase64 = fs.readFileSync(logoPath).toString('base64');
    } catch (err) {
        console.error('Logo Read Error for HTML:', err);
    }

    const title = type === 'subevent' && subEventName
        ? `${subEventName} - Attendance Report`
        : 'Overall Attendance Report';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
            height: 700px;
            background-image: url('data:image/png;base64,${logoBase64}');
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            opacity: 0.15;
            z-index: 1;
            pointer-events: none;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            position: relative;
            z-index: 10;
            backdrop-filter: blur(4px);
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }

        .header h2 {
            font-size: 20px;
            font-weight: normal;
            opacity: 0.9;
        }

        .header .date {
            margin-top: 10px;
            font-size: 14px;
            opacity: 0.8;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }

        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .stat-card .label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
        }

        .stat-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #1f2937;
        }

        .stat-card.total .value {
            color: #3b82f6;
        }

        .stat-card.present .value {
            color: #22c55e;
        }

        .stat-card.absent .value {
            color: #ef4444;
        }

        .content {
            padding: 30px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        thead {
            background: #f3f4f6;
        }

        th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
        }

        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            color: #1f2937;
        }

        tr:hover {
            background: #f9fafb;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        .status-present {
            background: #d1fae5;
            color: #065f46;
        }

        .status-absent {
            background: #fee2e2;
            color: #991b1b;
        }

        .footer {
            padding: 20px 30px;
            background: #f8f9fa;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .container {
                box-shadow: none;
            }

            .header {
                background: #667eea;
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }

            tr:hover {
                background: transparent;
            }
        }
    </style>
</head>
<body>
    <div class="watermark"></div>
    <div class="container">
        <div class="header">
            <h1>Verbafest 2026</h1>
            <h2>${title}</h2>
            <div class="date">Generated on: ${new Date().toLocaleString()}</div>
        </div>

        <div class="stats">
            <div class="stat-card total">
                <div class="label">Total Participants</div>
                <div class="value">${stats.total || participants.length}</div>
            </div>
            <div class="stat-card present">
                <div class="label">Present</div>
                <div class="value">${stats.present || 0}</div>
            </div>
            <div class="stat-card absent">
                <div class="label">Absent</div>
                <div class="value">${stats.absent || 0}</div>
            </div>
        </div>

        <div class="content">
            <table>
                <thead>
                    <tr>
                        <th>Chest No</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>College</th>
                        <th>Mobile</th>
                        <th>Status</th>
                        <th>Marked At</th>
                    </tr>
                </thead>
                <tbody>
                    ${generateTableRows(participants, type, subEventId)}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>© 2026 Verbafest. All rights reserved.</p>
            <p>This is an official attendance report generated by the Event Management System.</p>
        </div>
    </div>
</body>
</html>
    `;

    return html;
}

/**
 * Generate table rows for participants
 */
function generateTableRows(participants, type, subEventId) {
    return participants.map((participant, index) => {
        // Determine attendance status
        let isPresent = false;
        let markedAt = '';

        if (type === 'subevent' && subEventId) {
            const subEventAttendance = participant.attendance?.subEvents?.find(
                se => se.subEventId.toString() === subEventId
            );
            isPresent = subEventAttendance?.isPresent || false;
            markedAt = subEventAttendance?.markedAt
                ? new Date(subEventAttendance.markedAt).toLocaleString()
                : 'Not marked';
        } else {
            isPresent = participant.attendance?.overall?.isPresent || false;
            markedAt = participant.attendance?.overall?.markedAt
                ? new Date(participant.attendance.overall.markedAt).toLocaleString()
                : 'Not marked';
        }

        const statusClass = isPresent ? 'status-present' : 'status-absent';
        const statusText = isPresent ? 'Present' : 'Absent';

        return `
            <tr>
                <td>${participant.chestNumber || '-'}</td>
                <td>${escapeHTML(participant.fullName || '')}</td>
                <td>${escapeHTML(participant.email || '')}</td>
                <td>${escapeHTML(participant.college || 'N/A')}</td>
                <td>${escapeHTML(participant.mobile || 'N/A')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${markedAt}</td>
            </tr>
        `;
    }).join('');
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

module.exports = { generateAttendanceHTML };
