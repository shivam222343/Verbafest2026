const PDFDocument = require('pdfkit');

/**
 * Generate PDF for attendance export
 * @param {Array} participants - Array of participant objects
 * @param {Object} options - Export options (type, subEventName, etc.)
 * @returns {PDFDocument} - PDF document stream
 */
function generateAttendancePDF(participants, options = {}) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const { type = 'overall', subEventName = '', stats = {} } = options;

    // Helper to draw background logo
    const drawBackgroundLogo = () => {
        try {
            const logoPath = require('path').join(__dirname, '../../frontend/public/Mavericks_Logo.png');
            const originalOpacity = doc.opacity();
            doc.save();
            doc.opacity(0.15); // 15% opacity as requested (20-30 or subtle)

            // Draw large logo in center
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const logoWidth = 400;
            const logoHeight = 400;

            doc.image(logoPath, (pageWidth - logoWidth) / 2, (pageHeight - logoHeight) / 2, {
                width: logoWidth,
                height: logoHeight
            });

            doc.restore();
        } catch (err) {
            console.error('Logo background error:', err);
        }
    };

    // Draw on first page
    drawBackgroundLogo();

    // Listen for new pages
    doc.on('pageAdded', () => {
        drawBackgroundLogo();
    });

    // Header
    doc.fillColor('black').fontSize(20).font('Helvetica-Bold').text('Verbafest 2026', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).text('Attendance Report', { align: 'center' });
    doc.moveDown(0.3);

    if (type === 'subevent' && subEventName) {
        doc.fontSize(12).font('Helvetica').text(`Sub-Event: ${subEventName}`, { align: 'center' });
    } else {
        doc.fontSize(12).font('Helvetica').text('Overall Attendance', { align: 'center' });
    }

    doc.moveDown(0.3);
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Statistics
    doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Participants: ${stats.total || participants.length}`);
    doc.text(`Present: ${stats.present || 0}`);
    doc.text(`Absent: ${stats.absent || 0}`);
    doc.moveDown(1);

    // Table Header
    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 200;
    const col3X = 320;
    const col4X = 420;
    const col5X = 500;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Name', col1X, tableTop);
    doc.text('Email', col2X, tableTop);
    doc.text('College', col3X, tableTop);
    doc.text('Phone', col4X, tableTop);
    doc.text('Status', col5X, tableTop);

    // Draw line under header
    doc.moveTo(col1X, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

    let currentY = tableTop + 25;
    const rowHeight = 20;
    const pageHeight = 700;

    // Table Rows
    doc.font('Helvetica').fontSize(9);

    participants.forEach((participant, index) => {
        // Check if we need a new page
        if (currentY > pageHeight) {
            doc.addPage();
            currentY = 50;

            // Redraw header on new page
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Name', col1X, currentY);
            doc.text('Email', col2X, currentY);
            doc.text('College', col3X, currentY);
            doc.text('Phone', col4X, currentY);
            doc.text('Status', col5X, currentY);

            doc.moveTo(col1X, currentY + 15)
                .lineTo(550, currentY + 15)
                .stroke();

            currentY += 25;
            doc.font('Helvetica').fontSize(9);
        }

        // Determine attendance status
        let isPresent = false;
        if (type === 'subevent' && options.subEventId) {
            const subEventAttendance = participant.attendance?.subEvents?.find(
                se => se.subEventId.toString() === options.subEventId
            );
            isPresent = subEventAttendance?.isPresent || false;
        } else {
            isPresent = participant.attendance?.overall?.isPresent || false;
        }

        const status = isPresent ? 'Present' : 'Absent';
        const statusColor = isPresent ? '#22c55e' : '#ef4444';

        // Truncate long text
        const name = truncateText(participant.fullName || '', 20);
        const email = truncateText(participant.email || '', 15);
        const college = truncateText(participant.college || 'N/A', 12);
        const phone = participant.mobile || 'N/A';

        doc.text(name, col1X, currentY);
        doc.text(email, col2X, currentY);
        doc.text(college, col3X, currentY);
        doc.text(phone, col4X, currentY);
        doc.fillColor(statusColor).text(status, col5X, currentY);
        doc.fillColor('black');

        currentY += rowHeight;
    });

    // Footer
    doc.fontSize(8).fillColor('gray');
    doc.text(
        `Page ${doc.bufferedPageRange().count}`,
        50,
        750,
        { align: 'center' }
    );

    return doc;
}

/**
 * Truncate text to specified length
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate PDF for nominated participants (Winners)
 * @param {Array} participants - Array of participant objects
 * @param {Object} options - Export options (title)
 * @returns {PDFDocument} - PDF document stream
 */
function generateNominatedPDF(participants, options = {}) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const { title = 'Nominated Participants' } = options;

    const drawBackgroundLogo = () => {
        try {
            const logoPath = require('path').join(__dirname, '../../frontend/public/Mavericks_Logo.png');
            doc.save();
            doc.opacity(0.12);
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const logoSize = 400;
            doc.image(logoPath, (pageWidth - logoSize) / 2, (pageHeight - logoSize) / 2, { width: logoSize });
            doc.restore();
        } catch (err) {
            console.error('Nominated PDF Logo Error:', err);
        }
    };

    drawBackgroundLogo();
    doc.on('pageAdded', () => drawBackgroundLogo());

    // Header
    doc.fillColor('#1e1b4b').fontSize(22).font('Helvetica-Bold').text('Verbafest 2026', { align: 'center' });
    doc.moveDown(0.2);
    doc.fillColor('#475569').fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Table Setup
    const colX = [50, 150, 250, 480]; // Chest No, Name, Contact, Status
    const colLabels = ['CHEST NO', 'STUDENT NAME', 'CONTACT INFO', 'STATUS'];

    doc.rect(40, doc.y, 515, 20).fill('#1e1b4b');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');

    doc.text(colLabels[0], colX[0], doc.y + 5);
    doc.text(colLabels[1], colX[1], doc.y + 5);
    doc.text(colLabels[2], colX[2], doc.y + 5);
    doc.text(colLabels[3], colX[3], doc.y + 5);

    doc.moveDown(1);
    let currentY = doc.y + 5;

    participants.forEach((p, index) => {
        if (currentY > 750) {
            doc.addPage();
            currentY = 50;

            // Redraw header on new page
            doc.rect(40, currentY, 515, 20).fill('#1e1b4b');
            doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
            doc.text(colLabels[0], colX[0], currentY + 5);
            doc.text(colLabels[1], colX[1], currentY + 5);
            doc.text(colLabels[2], colX[2], currentY + 5);
            doc.text(colLabels[3], colX[3], currentY + 5);
            currentY += 25;
        }

        if (index % 2 === 1) {
            doc.rect(40, currentY - 2, 515, 18).fill('#f8fafc');
        }

        doc.fillColor('#1e293b').fontSize(9).font('Helvetica');
        doc.font('Helvetica-Bold').text(p.chestNumber || '-', colX[0], currentY);
        doc.font('Helvetica').text(p.fullName || 'N/A', colX[1], currentY, { width: 90, height: 12, ellipsis: true });

        const contact = `${p.mobile || ''}\n${p.email || ''}`;
        doc.fontSize(8).text(contact, colX[2], currentY, { width: 220 });

        doc.fillColor('#15803d').font('Helvetica-Bold').text('NOMINATED', colX[3], currentY);

        currentY += 22;
    });

    // Footer
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#94a3b8').text(`Page ${i + 1} of ${range.count} | Verbafest Official Export`, 50, 800, { align: 'center' });
    }

    return doc;
}

module.exports = { generateAttendancePDF, generateNominatedPDF };
