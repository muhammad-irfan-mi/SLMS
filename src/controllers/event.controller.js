const Event = require("../models/Event");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");

// HELPERS 
// HELPERS 
async function uploadMultipleImages(files) {
    if (!files || files.length === 0) return [];

    const uploadedImages = [];
    for (let file of files) {
        const uploaded = await uploadFileToS3({
            fileBuffer: file.buffer,
            fileName: `${Date.now()}-${file.originalname}`,
            mimeType: file.mimetype,
        });
        uploadedImages.push(uploaded);
    }
    return uploadedImages;
}

async function uploadSingleImage(file) {
    if (!file) return null;

    const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: `${Date.now()}-${file.originalname}`,
        mimeType: file.mimetype,
    });

    return uploaded;
}

async function deleteMultipleImages(images = []) {
    for (let img of images) {
        if (img) await deleteFileFromS3(img);
    }
}

async function deleteSingleImage(imageUrl) {
    if (imageUrl) {
        await deleteFileFromS3(imageUrl);
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

        let bannerImage = null;
        if (req.files && req.files.bannerImage && req.files.bannerImage[0]) {
            bannerImage = await uploadSingleImage(req.files.bannerImage[0]);
        }

        // Upload gallery images (from req.files.images)
        let images = [];
        if (req.files && req.files.images && req.files.images.length > 0) {
            images = await uploadMultipleImages(req.files.images);
        }

        const newEvent = await Event.create({
            school: schoolId,
            title,
            description,
            eventDate,
            status,
            bannerImage,
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

        const updatedData = { ...req.body };

        if (updatedData.eventDate) {
            updatedData.eventDate = new Date(updatedData.eventDate);
        }

        if (req.files && req.files.bannerImage && req.files.bannerImage[0]) {
            if (event.bannerImage) {
                await deleteSingleImage(event.bannerImage);
            }
            updatedData.bannerImage = await uploadSingleImage(req.files.bannerImage[0]);
        }

        if (req.files && req.files.images && req.files.images.length > 0) {
            const newImages = await uploadMultipleImages(req.files.images);
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
// const deleteEvent = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const event = await Event.findById(id);
//         if (!event) return res.status(404).json({ message: "Event not found" });

//         // Delete all images from S3
//         await deleteMultipleImages(event.images);

//         await event.deleteOne();

//         res.status(200).json({ message: "Event deleted successfully" });

//     } catch (err) {
//         console.error("Delete Event Error:", err);
//         res.status(500).json({ message: "Server error", error: err.message });
//     }
// };

// DELETE EVENT
const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userSchool = req.user.school;

        const event = await Event.findById(id);
        if (!event) return res.status(404).json({ message: "Event not found" });

        if (String(event.school) !== String(userSchool)) {
            return res.status(403).json({
                message: "You can only delete events from your school"
            });
        }

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
