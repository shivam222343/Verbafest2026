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

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Verbafest 2026', { align: 'center' });
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

module.exports = { generateAttendancePDF };
