const AiYusahVideo = require("../models/AiYusahVideo");
const User = require("../models/User");


// Superadmin Create Video
const createAiVideo = async (req, res) => {
    try {
        // const schoolId = req.user.school;
        const { title, description, youtubeLink } = req.body;

        if (!title || !youtubeLink) {
            return res.status(400).json({ message: "Title, YouTube link & school are required" });
        }

        if (!youtubeLink.includes("youtube.com") && !youtubeLink.includes("youtu.be")) {
            return res.status(400).json({ message: "Invalid YouTube URL" });
        }

        const video = new AiYusahVideo({
            title,
            description,
            youtubeLink,
            // school: schoolId,
            // uploadedBy: req.user._id,
        });

        await video.save();

        res.status(201).json({
            message: "Video uploaded successfully",
            video,
        });
    } catch (err) {
        console.error("Create AiYusah Video Error:", err);
        res.status(500).json({ message: err.message });
    }
};

const updateAiVideo = async (req, res) => {
    try {
        // const schoolId = req.user.school;
        const { id } = req.params;
        const { title, description, youtubeLink } = req.body;

        const video = await AiYusahVideo.findById(id);

        if (!video) return res.status(404).json({ message: "Video not found" });

        if (title) video.title = title;
        if (description) video.description = description;
        // if (schoolId) video.school = schoolId;

        if (youtubeLink) {
            if (!youtubeLink.includes("youtube.com") && !youtubeLink.includes("youtu.be")) {
                return res.status(400).json({ message: "Invalid YouTube link" });
            }
            video.youtubeLink = youtubeLink;
        }

        await video.save();

        res.status(200).json({
            message: "Video updated successfully",
            video,
        });

    } catch (err) {
        console.error("Update AiYusah Video Error:", err);
        res.status(500).json({ message: err.message });
    }
};

const getVideosForSuperadmin = async (req, res) => {
    try {

        let { page = 1, limit = 10, search } = req.query;
        page = Number(page);
        limit = Number(limit);

        const filter = {};

        if (search) {
            filter.title = { $regex: search, $options: "i" };
        }

        const skip = (page - 1) * limit;

        const videos = await AiYusahVideo.find(filter)
            // .populate("uploadedBy", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await AiYusahVideo.countDocuments(filter);

        res.status(200).json({
            total,
            page,
            totalPages: Math.ceil(total / limit),
            videos,
        });

    } catch (err) {
        console.error("Get Superadmin Videos Error:", err);
        res.status(500).json({ message: err.message });
    }
};

// Get All Videos (All Students, Teachers, Admin)
const getVideosBySchool = async (req, res) => {
    try {
        let { page = 1, limit = 10, search } = req.query;
        page = Number(page);
        limit = Number(limit);

        const filter = {};

        if (search) {
            filter.title = { $regex: search, $options: "i" };
        }

        const skip = (page - 1) * limit;

        const videos = await AiYusahVideo.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await AiYusahVideo.countDocuments(filter);

        res.status(200).json({
            total,
            page,
            totalPages: Math.ceil(total / limit),
            videos,
        });

    } catch (err) {
        console.error("Get School Videos Error:", err);
        res.status(500).json({ message: err.message });
    }
};

const getVideoById = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await AiYusahVideo.findById(id)

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        res.status(200).json({ video });

    } catch (err) {
        console.error("Get Video by ID Error:", err);
        res.status(500).json({ message: err.message });
    }
};

// Delete Video (Superadmin only)
const deleteAiVideo = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await AiYusahVideo.findById(id);

        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }

        await video.deleteOne();

        res.status(200).json({ message: "Video deleted successfully" });

    } catch (err) {
        console.error("Delete AiYusah Video Error:", err);
        res.status(500).json({ message: err.message });
    }
};


module.exports = {
    createAiVideo,
    updateAiVideo,
    getVideosForSuperadmin,
    getVideosBySchool,
    getVideoById,
    deleteAiVideo,
};
