/**
 * Generate CSV data for attendance export
 * @param {Array} participants - Array of participant objects
 * @param {Object} options - Export options (type, subEventId, etc.)
 * @returns {String} - CSV formatted string
 */
function generateAttendanceCSV(participants, options = {}) {
    const { type = 'overall', subEventName = '', subEventId = null } = options;

    // CSV Header
    const headers = [
        'Chest Number',
        'Name',
        'Email',
        'Mobile',
        'College',
        'Branch',
        'Year',
        'Sub-Events',
        'Status',
        'Marked At',
        'Marked By'
    ];

    let csvContent = headers.join(',') + '\n';

    // CSV Rows
    participants.forEach(participant => {
        // Determine attendance status
        let isPresent = false;
        let markedAt = '';
        let markedBy = '';

        if (type === 'subevent' && subEventId) {
            const subEventAttendance = participant.attendance?.subEvents?.find(
                se => se.subEventId.toString() === subEventId
            );
            isPresent = subEventAttendance?.isPresent || false;
            markedAt = subEventAttendance?.markedAt
                ? new Date(subEventAttendance.markedAt).toLocaleString()
                : '';
            markedBy = subEventAttendance?.markedBy?.name || '';
        } else {
            isPresent = participant.attendance?.overall?.isPresent || false;
            markedAt = participant.attendance?.overall?.markedAt
                ? new Date(participant.attendance.overall.markedAt).toLocaleString()
                : '';
            markedBy = participant.attendance?.overall?.markedBy?.name || '';
        }

        const status = isPresent ? 'Present' : 'Absent';

        // Get sub-events list
        const subEvents = participant.registeredSubEvents
            ? participant.registeredSubEvents.map(se => se.name || se).join('; ')
            : '';

        const row = [
            participant.chestNumber || '-',
            escapeCSV(participant.fullName || ''),
            escapeCSV(participant.email || ''),
            escapeCSV(participant.mobile || ''),
            escapeCSV(participant.college || ''),
            escapeCSV(participant.branch || ''),
            participant.year || '',
            escapeCSV(subEvents),
            status,
            escapeCSV(markedAt),
            escapeCSV(markedBy)
        ];

        csvContent += row.join(',') + '\n';
    });

    return csvContent;
}

/**
 * Escape CSV special characters
 */
function escapeCSV(text) {
    if (typeof text !== 'string') return text;

    // If text contains comma, quote, or newline, wrap in quotes and escape quotes
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

module.exports = { generateAttendanceCSV };
