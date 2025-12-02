const Event = require("../models/Event");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");

// HELPERS 
async function uploadMultipleImages(files) {
    const uploadedImages = [];

    for (let file of files) {
        const uploaded = await uploadFileToS3({
            fileBuffer: file.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
        });

        uploadedImages.push(uploaded);
    }

    return uploadedImages;
}

async function deleteMultipleImages(images = []) {
    for (let img of images) {
        await deleteFileFromS3(img);
    }
}

// CREATE EVENT
const createEvent = async (req, res) => {
    try {

        const { title, description, eventDate, status } = req.body;

        if (!title || !eventDate) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const schoolId = req.user.school;

        // Upload images to S3
        let images = [];
        if (req.files?.length > 0) {
            images = await uploadMultipleImages(req.files);
        }

        const newEvent = await Event.create({
            school: schoolId,
            title,
            description,
            eventDate,
            status,
            images,
            createdBy: req.user._id
        });

        res.status(201).json({
            message: "Event created successfully",
            event: newEvent
        });

    } catch (err) {
        console.error("Create Event Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// UPDATE EVENT
const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const updatedData = req.body;

        if (req.files?.length > 0) {
            const newImages = await uploadMultipleImages(req.files);
            updatedData.images = [...event.images, ...newImages];
        }

        const updatedEvent = await Event.findByIdAndUpdate(
            id,
            { $set: updatedData },
            { new: true }
        );

        res.status(200).json({
            message: "Event updated successfully",
            event: updatedEvent
        });

    } catch (err) {
        console.error("Update Event Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET EVENTS 
const getEvents = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const schoolId = req.user.school;

        const filter = { school: schoolId };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const events = await Event.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Event.countDocuments(filter);

        res.status(200).json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            events
        });

    } catch (err) {
        console.error("Get Events Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET SINGLE EVENT BY ID
const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) return res.status(404).json({ message: "Event not found" });

        res.status(200).json(event);

    } catch (err) {
        console.error("Get Event Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// DELETE EVENT
const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        
        const event = await Event.findById(id);
        if (!event) return res.status(404).json({ message: "Event not found" });

        // Delete all images from S3
        await deleteMultipleImages(event.images);

        await event.deleteOne();

        res.status(200).json({ message: "Event deleted successfully" });

    } catch (err) {
        console.error("Delete Event Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

module.exports = {
    createEvent,
    updateEvent,
    getEvents,
    getEventById,
    deleteEvent
};
