const PDFDocument = require('pdfkit');

/**
 * Generate PDF for group export
 * @param {Array} groups - Array of group objects
 * @returns {PDFDocument} - PDF document stream
 */
function generateGroupPDF(groups) {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    // Helper to draw background logo
    const drawBackgroundLogo = () => {
        try {
            const logoPath = require('path').join(__dirname, '../../frontend/public/Mavericks_Logo.png');
            doc.save();
            doc.opacity(0.12); // Slightly more subtle for detailed group reports
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const logoSize = 400;
            doc.image(logoPath, (pageWidth - logoSize) / 2, (pageHeight - logoSize) / 2, { width: logoSize });
            doc.restore();
        } catch (err) {
            console.error('Group PDF Logo Error:', err);
        }
    };

    // Draw on first page
    drawBackgroundLogo();

    // Listen for new pages
    doc.on('pageAdded', () => {
        drawBackgroundLogo();
    });

    // Document Header (Only once at the start)
    doc.fillColor('#1e1b4b').fontSize(16).font('Helvetica-Bold').text('Verbafest 2026', { align: 'center' });
    doc.fillColor('#475569').fontSize(10).font('Helvetica').text('Official Group Registration Report', { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.moveTo(30, doc.y).lineTo(565, doc.y).stroke('#e2e8f0');
    doc.moveDown(1);

    groups.forEach((group, index) => {
        // Check if we need a new page (roughly 200 units needed for a small group)
        if (doc.y > 650) {
            doc.addPage();
            doc.fillColor('#1e1b4b').fontSize(10).font('Helvetica-Bold').text('Verbafest 2026 - Continued', { align: 'right' });
            doc.moveDown(1);
        }

        // Group Header Line
        const groupStartY = doc.y;
        doc.rect(30, groupStartY, 535, 20).fill('#f1f5f9');
        doc.fillColor('#1e1b4b').fontSize(11).font('Helvetica-Bold').text(`${group.groupName} (#${group.groupNumber})`, 40, groupStartY + 5);

        doc.fillColor('#475569').fontSize(9).font('Helvetica');
        const panelText = `Panel: ${group.panelId?.panelName || 'TBA'} | Venue: ${group.panelId?.venue || 'TBA'}`;
        doc.text(panelText, 300, groupStartY + 5, { align: 'right', width: 255 });

        doc.moveDown(1.5);

        // Participants Table Header
        const tableTop = doc.y;
        const col1X = 40;  // Chest No
        const col2X = 100; // Full Name
        const col3X = 350; // PRN
        const col4X = 480; // Status

        doc.rect(30, tableTop, 535, 18).fill('#1e1b4b');
        doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
        doc.text('CHEST NO', col1X, tableTop + 5);
        doc.text('STUDENT NAME', col2X, tableTop + 5);
        doc.text('REGISTRATION ID', col3X, tableTop + 5);
        doc.text('STATUS', col4X, tableTop + 5);

        let currentY = tableTop + 18;
        doc.fillColor('#1e293b').font('Helvetica').fontSize(9);

        group.participants?.forEach((p, i) => {
            // Row highlight
            if (i % 2 === 1) {
                doc.rect(30, currentY, 535, 18).fill('#f8fafc');
            }

            doc.fillColor('#1e293b');
            doc.font('Helvetica-Bold').text(p.chestNumber?.toString() || '-', col1X, currentY + 5);
            doc.font('Helvetica').text(p.fullName || 'N/A', col2X, currentY + 5, { width: 240, height: 12, ellipsis: true });
            doc.text(p.prn || '-', col3X, currentY + 5);

            const status = p.currentStatus?.toUpperCase() || 'BUSY';
            doc.fontSize(7).font('Helvetica-Bold').text(status, col4X, currentY + 6);
            doc.fontSize(9); // Reset font size

            currentY += 18;
        });

        doc.y = currentY;

        // Instructions (Compact)
        if (group.panelId?.instructions) {
            doc.moveDown(0.5);
            doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('INSTRUCTIONS: ', 40, doc.y, { continued: true });
            doc.font('Helvetica').fillColor('#b45309').text(group.panelId.instructions);
        }

        doc.moveDown(2);
    });

    // Footer Branding (Auto on every page using doc.on or just simple loop)
    // For simplicity, just at the end here or we can use the doc.on('pageAdded')
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor('#94a3b8').text('Verbafest 2026 Management System | Generated Documents', 0, 800, { align: 'center' });
    }

    return doc;
}

/**
 * Generate HTML for group export
 * @param {Array} groups - Array of group objects
 * @returns {String} - HTML string
 */
function generateGroupHTML(groups) {
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
    <title>Group Assignment Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        
        body { 
            font-family: 'Inter', sans-serif; 
            padding: 40px; 
            background: #f1f5f9; 
            color: #1e293b; 
            margin: 0;
            min-height: 100vh;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            height: 600px;
            background-image: url('data:image/png;base64,${logoBase64}');
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            opacity: 0.12;
            z-index: 0;
            pointer-events: none;
        }

        .container { 
            max-width: 1000px; 
            margin: 0 auto; 
            background: rgba(255, 255, 255, 0.9); 
            padding: 40px; 
            border-radius: 8px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
            position: relative;
            z-index: 10;
            backdrop-filter: blur(4px);
        }
        
        .main-header { text-align: center; border-bottom: 2px solid #e2e8f0; margin-bottom: 30px; padding-bottom: 20px; }
        .main-header h1 { margin: 0; color: #1e1b4b; font-size: 1.5rem; text-transform: uppercase; }
        .main-header p { margin: 5px 0; color: #64748b; font-size: 0.9rem; }
        
        .group-section { margin-bottom: 40px; }
        .group-header { 
            background: #f8fafc; 
            padding: 10px 20px; 
            border-radius: 6px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            border: 1px solid #e2e8f0;
            margin-bottom: 15px;
        }
        .group-header h2 { margin: 0; font-size: 1.1rem; color: #1e1b4b; }
        .group-meta { font-size: 0.85rem; color: #64748b; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 0.9rem; }
        th { background: #1e1b4b; color: white; text-align: left; padding: 10px 15px; font-weight: 600; }
        td { padding: 8px 15px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) { background: #fcfdfe; }
        
        .chest-no { font-weight: 700; color: #4338ca; }
        .status-badge {
            font-size: 0.7rem;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            background: #dcfce7;
            color: #15803d;
            text-transform: uppercase;
        }
        
        .instruction-box {
            font-size: 0.85rem;
            padding: 12px;
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            color: #92400e;
            border-radius: 4px;
        }

        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; border: none; width: 100%; max-width: none; padding: 20px; }
            .group-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="watermark"></div>
    <div class="container">
        <div class="main-header">
            <h1>Verbafest 2026</h1>
            <p>Official Group Assignment Report</p>
            <p style="font-size: 0.75rem;">Generated: ${new Date().toLocaleString()}</p>
        </div>

        ${groups.map(group => `
            <div class="group-section">
                <div class="group-header">
                    <h2>${group.groupName} (#${group.groupNumber})</h2>
                    <div class="group-meta">
                        <strong>Panel:</strong> ${group.panelId?.panelName || 'TBA'} | 
                        <strong>Venue:</strong> <span style="color: #ef4444;">${group.panelId?.venue || 'TBA'}</span>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 100px;">Chest No</th>
                            <th>Student Name</th>
                            <th>Registration ID</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.participants?.map(p => `
                            <tr>
                                <td class="chest-no">${p.chestNumber || '-'}</td>
                                <td><strong>${p.fullName}</strong></td>
                                <td>${p.prn || '-'}</td>
                                <td><span class="status-badge">${p.currentStatus}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${group.panelId?.instructions ? `
                    <div class="instruction-box">
                        <strong>Instructions:</strong> ${group.panelId.instructions}
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
    return html;
}

module.exports = { generateGroupPDF, generateGroupHTML };

