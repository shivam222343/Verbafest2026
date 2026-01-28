const express = require('express');
const router = express.Router();
const Participant = require('../../models/Participant');
const SubEvent = require('../../models/SubEvent');
const { protect, authorize } = require('../../middleware/auth');
const PDFDocument = require('pdfkit');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

// Protect all routes and authorize only admins
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/attendance/overall
// @desc    Get overall attendance list
// @access  Private/Admin
router.get('/overall', async (req, res) => {
    try {
        const { search, present } = req.query;

        let query = {};

        // Search filter
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { college: { $regex: search, $options: 'i' } }
            ];
        }

        // Present filter
        if (present !== undefined) {
            query['attendance.overall.isPresent'] = present === 'true';
        }

        const participants = await Participant.find(query)
            .populate('registeredSubEvents', 'name')
            .populate('attendance.overall.markedBy', 'name')
            .select('fullName email mobile college branch year registeredSubEvents attendance')
            .sort({ fullName: 1 });

        const stats = {
            total: await Participant.countDocuments(),
            present: await Participant.countDocuments({ 'attendance.overall.isPresent': true }),
            absent: await Participant.countDocuments({ 'attendance.overall.isPresent': false })
        };

        res.json({
            success: true,
            count: participants.length,
            stats,
            data: participants
        });
    } catch (error) {
        console.error('Error fetching overall attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance data',
            error: error.message
        });
    }
});

// @route   POST /api/admin/attendance/overall/mark
// @desc    Mark overall attendance for participants
// @access  Private/Admin
router.post('/overall/mark', async (req, res) => {
    try {
        const { participantIds, isPresent } = req.body;

        if (!participantIds || !Array.isArray(participantIds)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of participant IDs'
            });
        }

        const updateData = {
            'attendance.overall.isPresent': isPresent,
            'attendance.overall.markedAt': new Date(),
            'attendance.overall.markedBy': req.user.id
        };

        await Participant.updateMany(
            { _id: { $in: participantIds } },
            { $set: updateData }
        );

        res.json({
            success: true,
            message: `Attendance marked for ${participantIds.length} participant(s)`,
            count: participantIds.length
        });
    } catch (error) {
        console.error('Error marking overall attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking attendance',
            error: error.message
        });
    }
});

// @route   GET /api/admin/attendance/subevent/:id
// @desc    Get attendance for a specific sub-event
// @access  Private/Admin
router.get('/subevent/:id', async (req, res) => {
    try {
        const { search, present } = req.query;
        const subEventId = req.params.id;

        // Verify sub-event exists
        const subEvent = await SubEvent.findById(subEventId);
        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        let query = { registeredSubEvents: subEventId };

        // Search filter
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { college: { $regex: search, $options: 'i' } }
            ];
        }

        const participants = await Participant.find(query)
            .populate('registeredSubEvents', 'name')
            .select('fullName email mobile college branch year registeredSubEvents attendance')
            .sort({ fullName: 1 });

        // Filter by present status if specified
        let filteredParticipants = participants;
        if (present !== undefined) {
            const isPresentFilter = present === 'true';
            filteredParticipants = participants.filter(p => {
                const subEventAttendance = p.attendance?.subEvents?.find(
                    se => se.subEventId.toString() === subEventId
                );
                return subEventAttendance?.isPresent === isPresentFilter;
            });
        }

        // Calculate stats
        const presentCount = participants.filter(p => {
            const subEventAttendance = p.attendance?.subEvents?.find(
                se => se.subEventId.toString() === subEventId
            );
            return subEventAttendance?.isPresent === true;
        }).length;

        const stats = {
            total: participants.length,
            present: presentCount,
            absent: participants.length - presentCount
        };

        res.json({
            success: true,
            subEvent: {
                id: subEvent._id,
                name: subEvent.name
            },
            count: filteredParticipants.length,
            stats,
            data: filteredParticipants
        });
    } catch (error) {
        console.error('Error fetching sub-event attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance data',
            error: error.message
        });
    }
});

// @route   POST /api/admin/attendance/subevent/:id/mark
// @desc    Mark attendance for a specific sub-event
// @access  Private/Admin
router.post('/subevent/:id/mark', async (req, res) => {
    try {
        const { participantIds, isPresent } = req.body;
        const subEventId = req.params.id;

        if (!participantIds || !Array.isArray(participantIds)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of participant IDs'
            });
        }

        // Verify sub-event exists
        const subEvent = await SubEvent.findById(subEventId);
        if (!subEvent) {
            return res.status(404).json({
                success: false,
                message: 'Sub-event not found'
            });
        }

        const participants = await Participant.find({ _id: { $in: participantIds } });

        for (const participant of participants) {
            // Initialize attendance if not exists
            if (!participant.attendance) {
                participant.attendance = { overall: {}, subEvents: [] };
            }
            if (!participant.attendance.subEvents) {
                participant.attendance.subEvents = [];
            }

            // Find existing attendance record for this sub-event
            const existingIndex = participant.attendance.subEvents.findIndex(
                se => se.subEventId.toString() === subEventId
            );

            const attendanceRecord = {
                subEventId,
                isPresent,
                markedAt: new Date(),
                markedBy: req.user.id
            };

            if (existingIndex >= 0) {
                // Update existing record
                participant.attendance.subEvents[existingIndex] = attendanceRecord;
            } else {
                // Add new record
                participant.attendance.subEvents.push(attendanceRecord);
            }

            await participant.save();
        }

        res.json({
            success: true,
            message: `Attendance marked for ${participantIds.length} participant(s) in ${subEvent.name}`,
            count: participantIds.length
        });
    } catch (error) {
        console.error('Error marking sub-event attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking attendance',
            error: error.message
        });
    }
});

// @route   POST /api/admin/attendance/bulk
// @desc    Bulk mark attendance (all present or all absent)
// @access  Private/Admin
router.post('/bulk', async (req, res) => {
    try {
        const { type, subEventId, isPresent } = req.body;

        if (type === 'overall') {
            const updateData = {
                'attendance.overall.isPresent': isPresent,
                'attendance.overall.markedAt': new Date(),
                'attendance.overall.markedBy': req.user.id
            };

            const result = await Participant.updateMany({}, { $set: updateData });

            res.json({
                success: true,
                message: `Marked all participants as ${isPresent ? 'present' : 'absent'}`,
                count: result.modifiedCount
            });
        } else if (type === 'subevent' && subEventId) {
            const participants = await Participant.find({ registeredSubEvents: subEventId });

            for (const participant of participants) {
                if (!participant.attendance) {
                    participant.attendance = { overall: {}, subEvents: [] };
                }
                if (!participant.attendance.subEvents) {
                    participant.attendance.subEvents = [];
                }

                const existingIndex = participant.attendance.subEvents.findIndex(
                    se => se.subEventId.toString() === subEventId
                );

                const attendanceRecord = {
                    subEventId,
                    isPresent,
                    markedAt: new Date(),
                    markedBy: req.user.id
                };

                if (existingIndex >= 0) {
                    participant.attendance.subEvents[existingIndex] = attendanceRecord;
                } else {
                    participant.attendance.subEvents.push(attendanceRecord);
                }

                await participant.save();
            }

            res.json({
                success: true,
                message: `Marked all participants as ${isPresent ? 'present' : 'absent'}`,
                count: participants.length
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid bulk attendance request'
            });
        }
    } catch (error) {
        console.error('Error bulk marking attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking attendance',
            error: error.message
        });
    }
});

// Import export utilities
const { generateAttendancePDF } = require('../../utils/pdfExport');
const { generateAttendanceCSV } = require('../../utils/csvExport');
const { generateAttendanceHTML } = require('../../utils/htmlExport');

// @route   GET /api/admin/attendance/export/pdf
// @desc    Export attendance as PDF
// @access  Private/Admin
router.get('/export/pdf', async (req, res) => {
    try {
        const { type, subEventId } = req.query;

        let participants, stats, subEventName = '';

        if (type === 'subevent' && subEventId) {
            const subEvent = await SubEvent.findById(subEventId);
            if (!subEvent) {
                return res.status(404).json({ success: false, message: 'Sub-event not found' });
            }
            subEventName = subEvent.name;

            participants = await Participant.find({ registeredSubEvents: subEventId })
                .populate('registeredSubEvents', 'name')
                .select('fullName email mobile college branch year attendance')
                .sort({ fullName: 1 });

            const presentCount = participants.filter(p => {
                const subEventAttendance = p.attendance?.subEvents?.find(
                    se => se.subEventId.toString() === subEventId
                );
                return subEventAttendance?.isPresent === true;
            }).length;

            stats = {
                total: participants.length,
                present: presentCount,
                absent: participants.length - presentCount
            };
        } else {
            participants = await Participant.find()
                .populate('registeredSubEvents', 'name')
                .populate('attendance.overall.markedBy', 'name')
                .select('fullName email mobile college branch year attendance')
                .sort({ fullName: 1 });

            stats = {
                total: participants.length,
                present: participants.filter(p => p.attendance?.overall?.isPresent).length,
                absent: participants.filter(p => !p.attendance?.overall?.isPresent).length
            };
        }

        const doc = generateAttendancePDF(participants, { type, subEventName, stats, subEventId });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=attendance-${type}-${Date.now()}.pdf`);

        doc.pipe(res);
        doc.end();
    } catch (error) {
        console.error('Error exporting PDF:', error);
        res.status(500).json({ success: false, message: 'Error exporting PDF', error: error.message });
    }
});

// @route   GET /api/admin/attendance/export/csv
// @desc    Export attendance as CSV
// @access  Private/Admin
router.get('/export/csv', async (req, res) => {
    try {
        const { type, subEventId } = req.query;

        let participants, subEventName = '';

        if (type === 'subevent' && subEventId) {
            const subEvent = await SubEvent.findById(subEventId);
            if (!subEvent) {
                return res.status(404).json({ success: false, message: 'Sub-event not found' });
            }
            subEventName = subEvent.name;

            participants = await Participant.find({ registeredSubEvents: subEventId })
                .populate('registeredSubEvents', 'name')
                .populate('attendance.subEvents.markedBy', 'name')
                .select('fullName email mobile college branch year registeredSubEvents attendance')
                .sort({ fullName: 1 });
        } else {
            participants = await Participant.find()
                .populate('registeredSubEvents', 'name')
                .populate('attendance.overall.markedBy', 'name')
                .select('fullName email mobile college branch year registeredSubEvents attendance')
                .sort({ fullName: 1 });
        }

        const csvData = generateAttendanceCSV(participants, { type, subEventName, subEventId });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attendance-${type}-${Date.now()}.csv`);
        res.send(csvData);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ success: false, message: 'Error exporting CSV', error: error.message });
    }
});

// @route   GET /api/admin/attendance/export/html
// @desc    Export attendance as HTML
// @access  Private/Admin
router.get('/export/html', async (req, res) => {
    try {
        const { type, subEventId } = req.query;

        let participants, stats, subEventName = '';

        if (type === 'subevent' && subEventId) {
            const subEvent = await SubEvent.findById(subEventId);
            if (!subEvent) {
                return res.status(404).json({ success: false, message: 'Sub-event not found' });
            }
            subEventName = subEvent.name;

            participants = await Participant.find({ registeredSubEvents: subEventId })
                .populate('registeredSubEvents', 'name')
                .select('fullName email mobile college branch year attendance')
                .sort({ fullName: 1 });

            const presentCount = participants.filter(p => {
                const subEventAttendance = p.attendance?.subEvents?.find(
                    se => se.subEventId.toString() === subEventId
                );
                return subEventAttendance?.isPresent === true;
            }).length;

            stats = {
                total: participants.length,
                present: presentCount,
                absent: participants.length - presentCount
            };
        } else {
            participants = await Participant.find()
                .populate('registeredSubEvents', 'name')
                .select('fullName email mobile college branch year attendance')
                .sort({ fullName: 1 });

            stats = {
                total: participants.length,
                present: participants.filter(p => p.attendance?.overall?.isPresent).length,
                absent: participants.filter(p => !p.attendance?.overall?.isPresent).length
            };
        }

        const htmlContent = generateAttendanceHTML(participants, { type, subEventName, stats, subEventId });

        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
    } catch (error) {
        console.error('Error exporting HTML:', error);
        res.status(500).json({ success: false, message: 'Error exporting HTML', error: error.message });
    }
});

module.exports = router;
