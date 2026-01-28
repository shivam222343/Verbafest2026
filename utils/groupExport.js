const PDFDocument = require('pdfkit');

/**
 * Generate PDF for group export
 * @param {Array} groups - Array of group objects
 * @param {Object} options - Export options
 * @returns {PDFDocument} - PDF document stream
 */
function generateGroupPDF(groups, options = {}) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    groups.forEach((group, index) => {
        if (index > 0) doc.addPage();

        // Header
        doc.fontSize(22).font('Helvetica-Bold').text('Verbafest 2026', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(18).text('Group Assignment Sheet', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(1.5);

        // Group Content
        doc.fontSize(14).font('Helvetica-Bold').text(`Group Info:`, { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold').text(`Group Name: `, { continued: true }).font('Helvetica').text(group.groupName);
        doc.fontSize(12).font('Helvetica-Bold').text(`Group Number: `, { continued: true }).font('Helvetica').text(group.groupNumber.toString());
        doc.moveDown(0.8);

        // Panel Info
        if (group.panelId) {
            doc.fontSize(14).font('Helvetica-Bold').text(`Panel & Venue Info:`, { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(12).font('Helvetica-Bold').text(`Panel Name: `, { continued: true }).font('Helvetica').text(group.panelId.panelName || 'N/A');
            doc.fontSize(12).font('Helvetica-Bold').text(`Venue: `, { continued: true }).font('Helvetica').text(group.panelId.venue || 'N/A');

            if (group.panelId.judges && group.panelId.judges.length > 0) {
                doc.fontSize(12).font('Helvetica-Bold').text(`Judges: `);
                group.panelId.judges.forEach(judge => {
                    doc.fontSize(11).font('Helvetica').text(`- ${judge.name} (${judge.email})`, { indent: 20 });
                });
            }
            doc.moveDown(0.8);
        } else {
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#ef4444').text('No Panel Assigned Yet');
            doc.fillColor('black');
            doc.moveDown(0.8);
        }

        // Participants Table
        doc.fontSize(14).font('Helvetica-Bold').text(`Participants (${group.participants?.length || 0}):`, { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const col1X = 50;
        const col2X = 100;
        const col3X = 250;
        const col4X = 400;

        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Chest No', col1X, tableTop);
        doc.text('Full Name', col2X, tableTop);
        doc.text('PRN / Email', col3X, tableTop);
        doc.text('Status', col4X, tableTop);

        doc.moveTo(col1X, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let currentY = tableTop + 25;
        doc.font('Helvetica').fontSize(10);

        group.participants?.forEach(p => {
            doc.text(p.chestNumber?.toString() || '-', col1X, currentY);
            doc.text(p.fullName || 'N/A', col2X, currentY);
            doc.text(p.prn || p.email || 'N/A', col3X, currentY);
            doc.text(p.currentStatus || 'N/A', col4X, currentY);
            currentY += 20;
        });

        // Instructions Footer
        if (group.panelId?.instructions) {
            doc.moveDown(1.5);
            doc.fontSize(12).font('Helvetica-Bold').text(`Instructions:`);
            doc.fontSize(10).font('Helvetica').text(group.panelId.instructions);
        }
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
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #f0f2f5; }
        .page { background: white; max-width: 900px; margin: 20px auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); page-break-after: always; }
        .header { text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1a365d; margin: 0; }
        .header h2 { color: #4a5568; font-weight: 500; font-size: 1.2rem; }
        .section-title { font-size: 1.1rem; font-weight: 700; color: #2d3748; border-left: 4px solid #667eea; padding-left: 10px; margin: 20px 0 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .info-item { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .label { font-size: 0.8rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
        .value { font-size: 1.1rem; color: #1a202c; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #edf2f7; text-align: left; padding: 12px; font-weight: 600; color: #4a5568; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
        .badge-chest { background: #ebf8ff; color: #2c5282; }
        .instructions { background: #fffaf0; border: 1px solid #feebc8; padding: 20px; border-radius: 8px; margin-top: 30px; }
        @media print { body { background: white; padding: 0; } .page { box-shadow: none; margin: 0; width: 100%; max-width: none; } }
    </style>
</head>
<body>
    ${groups.map(group => `
        <div class="page">
            <div class="header">
                <h1>Verbafest 2026</h1>
                <h2>Group Assignment Sheet</h2>
                <div style="font-size: 0.8rem; color: #a0aec0; margin-top: 10px;">Generated on: ${new Date().toLocaleString()}</div>
            </div>

            <div class="section-title">Assignment Information</div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="label">Group Name</div>
                    <div class="value">${group.groupName}</div>
                </div>
                <div class="info-item">
                    <div class="label">Group Number</div>
                    <div class="value">#${group.groupNumber}</div>
                </div>
                <div class="info-item">
                    <div class="label">Assigned Panel</div>
                    <div class="value">${group.panelId?.panelName || '<span style="color:#ef4444">NOT ASSIGNED</span>'}</div>
                </div>
                <div class="info-item">
                    <div class="label">Venue</div>
                    <div class="value">${group.panelId?.venue || '<span style="color:#ef4444">NOT ASSIGNED</span>'}</div>
                </div>
            </div>

            <div class="section-title">Team Members</div>
            <table>
                <thead>
                    <tr>
                        <th>Chest No</th>
                        <th>Name</th>
                        <th>PRN / Email</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${group.participants?.map(p => `
                        <tr>
                            <td><span class="badge badge-chest">${p.chestNumber || '-'}</span></td>
                            <td><strong>${p.fullName}</strong></td>
                            <td>${p.prn || p.email}</td>
                            <td>${p.currentStatus}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            ${group.panelId?.judges?.length > 0 ? `
                <div class="section-title">Judges</div>
                <div style="padding: 0 15px;">
                    ${group.panelId.judges.map(j => `
                        <div style="margin-bottom: 5px;">• ${j.name} (${j.email})</div>
                    `).join('')}
                </div>
            ` : ''}

            ${group.panelId?.instructions ? `
                <div class="instructions">
                    <div class="label">Panel Instructions</div>
                    <div style="font-size: 0.9rem; color: #744210; margin-top: 5px;">${group.panelId.instructions}</div>
                </div>
            ` : ''}
        </div>
    `).join('')}
</body>
</html>
    `;
    return html;
}

module.exports = { generateGroupPDF, generateGroupHTML };
