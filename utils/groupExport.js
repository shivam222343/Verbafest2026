const PDFDocument = require('pdfkit');

/**
 * Generate PDF for group export
 * @param {Array} groups - Array of group objects
 * @param {Object} options - Export options
 * @returns {PDFDocument} - PDF document stream
 */
function generateGroupPDF(groups, options = {}) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    groups.forEach((group, index) => {
        if (index > 0) doc.addPage();

        // Banner Header
        doc.rect(0, 0, 612, 100).fill('#1e1b4b');
        doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('Verbafest 2026', 0, 35, { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Official Group Registration Details', 0, 65, { align: 'center' });

        doc.fillColor('black');
        doc.moveDown(4);

        // Group & Panel Header
        doc.fontSize(18).font('Helvetica-Bold').text(`${group.groupName}`, { align: 'left' });
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveTo(40, doc.y + 10).lineTo(550, doc.y + 10).stroke('#e2e8f0');
        doc.moveDown(1.5);

        // Team Info Info Box
        const startY = doc.y;
        doc.rect(40, startY, 515, 60).fill('#f8fafc').stroke('#e2e8f0');

        doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold');
        doc.text('GROUP NUMBER', 60, startY + 15);
        doc.text('ASSIGNED PANEL', 200, startY + 15);
        doc.text('VENUE / LOCATION', 400, startY + 15);

        doc.fillColor('#475569').fontSize(12).font('Helvetica-Bold');
        doc.text(`#${group.groupNumber}`, 60, startY + 30);
        doc.text(group.panelId?.panelName || 'PENDING', 200, startY + 30);
        doc.fillColor('#ef4444').text(group.panelId?.venue || 'TBA', 400, startY + 30);

        doc.fillColor('black');
        doc.moveDown(3);

        // Participants Table
        doc.fontSize(14).font('Helvetica-Bold').text('Team Members List');
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const col1X = 50;  // Chest No
        const col2X = 120; // Full Name
        const col3X = 300; // PRN
        const col4X = 450; // Status

        // Table Header Background
        doc.rect(40, tableTop - 5, 515, 25).fill('#1e1b4b');
        doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
        doc.text('CHEST NO', col1X, tableTop);
        doc.text('STUDENT NAME', col2X, tableTop);
        doc.text('REGISTRATION ID', col3X, tableTop);
        doc.text('STATUS', col4X, tableTop);

        let currentY = tableTop + 30;
        doc.fillColor('black');

        group.participants?.forEach((p, i) => {
            if (i % 2 === 0) {
                doc.rect(40, currentY - 8, 515, 25).fill('#f1f5f9');
                doc.fillColor('black');
            }

            doc.font('Helvetica-Bold').fontSize(11).text(p.chestNumber?.toString() || '-', col1X, currentY);
            doc.font('Helvetica').fontSize(10).text(p.fullName || 'N/A', col2X, currentY);
            doc.text(p.prn || '-', col3X, currentY);

            const status = p.currentStatus?.toUpperCase() || 'BUSY';
            doc.font('Helvetica-Bold').fontSize(9).text(status, col4X, currentY);

            currentY += 25;
        });

        // Judges Section
        if (group.panelId?.judges && group.panelId.judges.length > 0) {
            doc.moveDown(2);
            doc.font('Helvetica-Bold').fontSize(12).text('Assigned Evaluation Committee:');
            doc.font('Helvetica').fontSize(10);
            group.panelId.judges.forEach(j => {
                doc.text(`• ${j.name}`, { indent: 15 });
            });
        }

        // Instructions
        if (group.panelId?.instructions) {
            doc.moveDown(2);
            doc.rect(40, doc.y, 515, 50).dash(5, { space: 2 }).stroke('#6366f1');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#4338ca').text('IMPORTANT INSTRUCTIONS:', 50, doc.y + 10);
            doc.fontSize(10).font('Helvetica').fillColor('#1e293b').text(group.panelId.instructions, 50, doc.y + 5);
            doc.undash();
        }

        // Footer Branding
        doc.fontSize(8).fillColor('#94a3b8').text('Verbafest 2026 Management System | Please report to your venue at least 10 minutes prior to start.', 0, 780, { align: 'center' });
    });

    return doc;
}

/**
 * Generate HTML for group export
 * @param {Array} groups - Array of group objects
 * @param {Object} options - Export options
 * @returns {String} - HTML string
 */
function generateGroupHTML(groups, options = {}) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Group Assignment Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
        
        body { font-family: 'Outfit', sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; margin: 0; }
        .group-card { 
            background: white; 
            color: #1e293b;
            max-width: 800px; 
            margin: 30px auto; 
            border-radius: 20px; 
            overflow: hidden; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            page-break-after: always;
        }
        .header { 
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); 
            padding: 30px; 
            text-align: center; 
            color: white; 
            position: relative;
        }
        .event-tag { 
            background: rgba(255,255,255,0.1); 
            padding: 5px 15px; 
            border-radius: 50px; 
            font-size: 0.8rem; 
            display: inline-block;
            margin-bottom: 15px;
            backdrop-filter: blur(5px);
        }
        .header h1 { margin: 0; font-size: 2rem; letter-spacing: 1px; }
        .header h2 { margin: 5px 0 0; font-weight: 300; opacity: 0.8; }
        
        .content { padding: 40px; }
        
        .info-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 20px; 
            margin-bottom: 40px;
            text-align: center;
        }
        .info-box { 
            background: #f1f5f9; 
            padding: 20px; 
            border-radius: 15px; 
            border: 1px solid #e2e8f0;
        }
        .info-box .label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
        .info-box .value { font-size: 1.2rem; color: #0f172a; font-weight: 700; }
        .venue-value { color: #ef4444 !important; }
        
        .table-container { border: 1px solid #e2e8f0; border-radius: 15px; overflow: hidden; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e293b; color: white; text-align: left; padding: 15px; font-size: 0.9rem; }
        td { padding: 15px; border-bottom: 1px solid #f1f5f9; }
        tr:last-child td { border-bottom: none; }
        
        .chest-badge { 
            background: #e0e7ff; 
            color: #4338ca; 
            padding: 5px 10px; 
            border-radius: 8px; 
            font-weight: 700;
        }
        .status-badge {
            font-size: 0.7rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 50px;
            background: #dcfce7;
            color: #15803d;
            text-transform: uppercase;
        }
        
        .instructions {
            margin-top: 40px;
            padding: 25px;
            background: #fffbeb;
            border-left: 5px solid #f59e0b;
            border-radius: 10px;
        }
        .instructions h3 { margin-top: 0; color: #92400e; font-size: 1rem; }
        .instructions p { margin: 0; font-size: 0.95rem; color: #b45309; line-height: 1.5; }
        
        .footer { 
            text-align: center; 
            padding: 20px; 
            background: #f8fafc; 
            font-size: 0.8rem; 
            color: #94a3b8; 
            border-top: 1px solid #e2e8f0;
        }
        
        @media print { 
            body { background: white; padding: 0; } 
            .group-card { box-shadow: none; margin: 0; width: 100%; max-width: none; }
        }
    </style>
</head>
<body>
    ${groups.map(group => `
        <div class="group-card">
            <div class="header">
                <div class="event-tag">#VERBAFEST2026</div>
                <h1>${group.groupName}</h1>
                <h2>Official Assignment Sheet</h2>
            </div>
            
            <div class="content">
                <div class="info-grid">
                    <div class="info-box">
                        <div class="label">Group No</div>
                        <div class="value">#${group.groupNumber}</div>
                    </div>
                    <div class="info-box">
                        <div class="label">Panel Name</div>
                        <div class="value">${group.panelId?.panelName || 'N/A'}</div>
                    </div>
                    <div class="info-box">
                        <div class="label">VENUE</div>
                        <div class="value venue-value">${group.panelId?.venue || 'TBA'}</div>
                    </div>
                </div>

                <h3 style="margin-bottom: 20px; color: #1e293b;">Team Members</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Chest No</th>
                                <th>Student Name</th>
                                <th>PRN</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.participants?.map(p => `
                                <tr>
                                    <td><span class="chest-badge">${p.chestNumber || '-'}</span></td>
                                    <td><strong style="color: #0f172a;">${p.fullName}</strong></td>
                                    <td>${p.prn || '-'}</td>
                                    <td><span class="status-badge">${p.currentStatus}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                ${group.panelId?.instructions ? `
                    <div class="instructions">
                        <h3>PANEL INSTRUCTIONS</h3>
                        <p>${group.panelId.instructions}</p>
                    </div>
                ` : ''}
            </div>

            <div class="footer">
                Generation Time: ${new Date().toLocaleString()} | Official Verbafest Team Management Document
            </div>
        </div>
    `).join('')}
</body>
</html>
    `;
    return html;
}

module.exports = { generateGroupPDF, generateGroupHTML };
