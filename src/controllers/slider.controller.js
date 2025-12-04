const SliderImage = require("../models/SliderImage");
const User = require("../models/User");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");


async function uploadSingleImage(file) {
    if (!file) return null;

    const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
    });

    return uploaded;
}

async function deleteImage(url) {
    if (!url) return;
    await deleteFileFromS3(url);
}


// Create slider
const createSlider = async (req, res) => {
    try {
        const user = req.user;
        console.log(user)
        const { title, caption, link, order } = req.body;

        const active = req.body.active !== undefined ? req.body.active === "true" : true;

        if (!title || !req.file) {
            return res.status(400).json({ message: "Title and image are required" });
        }

        const imageUrl = await uploadSingleImage(req.file);

        let school = null;
        if (user.role === "admin_office") {
            if (!user.school) return res.status(400).json({ message: "School admin not linked to any school" });
            school = user.school;
        } else if (user.role === "superadmin") {
            school = req.body.school || null;
        } else if (user.schoolId) {
            school = user._id || null;
        }

        const slider = await SliderImage.create({
            title,
            caption,
            link,
            order: order ? Number(order) : 0,
            active,
            image: imageUrl,
            uploadedBy: user._id,
            uploadedByRole: user.role || "admin_office",
            school,
        });

        return res.status(201).json({ message: "Slider created", slider });
    } catch (err) {
        console.error("createSlider error:", err);
        return res.status(500).json({ message: err.message });
    }
};

// Get visible sliders for any logged-in user (students/teachers/admins)
// GET /api/slider
const getVisibleSliders = async (req, res) => {
    try {
        const user = req.user;
        let { page = 1, limit = 10, search } = req.query;
        page = Number(page);
        limit = Number(limit);

        const filter = {};

        if (search) filter.title = { $regex: search, $options: "i" };

        if (user.role === "superadmin") {
            // superadmin sees all sliders
        } else if (user.school) {
            filter.$or = [{ school: null }, { school: user.school }];
        } else {
            filter.school = null; // users without school only see superadmin global sliders
        }

        const skip = (page - 1) * limit;

        const [total, sliders] = await Promise.all([
            SliderImage.countDocuments(filter),
            SliderImage.find(filter).sort({ order: -1, createdAt: -1 }).skip(skip).limit(limit),
        ]);

        return res.status(200).json({ total, page, totalPages: Math.ceil(total / limit), sliders });
    } catch (err) {
        console.error("getVisibleSliders error:", err);
        return res.status(500).json({ message: err.message });
    }
};

//  Get sliders uploaded by superadmin (only superadmin)
const getSlidersForSuperadmin = async (req, res) => {
    try {
        const user = req.user;
        if (!user || user.role !== "superadmin") return res.status(403).json({ message: "SuperAdmin only" });

        let { page = 1, limit = 10, search } = req.query;
        page = Number(page);
        limit = Number(limit);

        const filter = {};
        if (search) filter.title = { $regex: search, $options: "i" };

        // superadmin uploads specifically
        filter.uploadedByRole = "superadmin";

        const skip = (page - 1) * limit;

        const [total, sliders] = await Promise.all([
            SliderImage.countDocuments(filter),
            SliderImage.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean()
        ]);

        return res.status(200).json({ total, page, totalPages: Math.ceil(total / limit), sliders });
    } catch (err) {
        console.error("getSlidersForSuperadmin error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

//  Get sliders uploaded by a school admin (their uploads)
const getSlidersForSchoolAdmin = async (req, res) => {
    try {
        const user = req.user;

        let { page = 1, limit = 10, search } = req.query;
        page = Number(page);
        limit = Number(limit);

        if (!user.school) return res.status(400).json({ message: "School admin not linked to a school" });

        const filter = { uploadedByRole: "admin_office", school: user.school };
        if (search) filter.title = { $regex: search, $options: "i" };

        const skip = (page - 1) * limit;

        const [total, sliders] = await Promise.all([
            SliderImage.countDocuments(filter),
            SliderImage.find(filter)
                .sort({ order: -1, createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean()
        ]);

        return res.status(200).json({ total, page, totalPages: Math.ceil(total / limit), sliders });
    } catch (err) {
        console.error("getSlidersForSchoolAdmin error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

// Get slider by ID 
const getSliderById = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;

        const slider = await SliderImage.findById(id).lean();
        if (!slider) return res.status(404).json({ message: "Slider not found" });

        // superadmin sees all
        if (user.role === "superadmin") return res.status(200).json({ slider });

        // school admin can see their own uploads
        if (user.role === "admin_office" || user.schoolId) {
            if (String(slider.uploadedBy) === String(user._id) || String(slider.school) === String(user.school) || slider.school == null) {
                return res.status(200).json({ slider });
            } else {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        // teacher/student: visible if slider.school == null (superadmin) OR slider.school == user's school
        if (user.role === "teacher" || user.role === "student" || user.role === "school") {
            if (slider.school == null) return res.status(200).json({ slider });
            if (user.school && String(slider.school) === String(user.school)) return res.status(200).json({ slider });
            return res.status(403).json({ message: "Access denied" });
        }

        // default deny
        return res.status(403).json({ message: "Access denied" });
    } catch (err) {
        console.error("getSliderById error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
};

// --- UPDATE SLIDER ---
const updateSlider = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;

        const slider = await SliderImage.findById(id);
        if (!slider) return res.status(404).json({ message: "Slider not found" });

        // Permission check
        if (String(slider.uploadedBy) !== String(user._id)) {
            return res.status(403).json({ message: "Not authorized to update this slider" });
        }

        // Update allowed fields
        ["title", "caption", "link", "order", "active"].forEach(field => {
            if (req.body[field] !== undefined) slider[field] = req.body[field];
        });

        // Update image
        if (req.file) {
            if (slider.image) await deleteImage(slider.image);
            slider.image = await uploadSingleImage(req.file);
        }

        // Superadmin can change school
        if (user.role === "superadmin" && req.body.school !== undefined) {
            slider.school = req.body.school || null;
        }

        await slider.save();
        return res.status(200).json({ message: "Slider updated", slider });
    } catch (err) {
        console.error("updateSlider error:", err);
        return res.status(500).json({ message: err.message });
    }
};


const deleteSlider = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;

        const slider = await SliderImage.findById(id);
        if (!slider) return res.status(404).json({ message: "Slider not found" });

        if (String(slider.uploadedBy) !== String(user._id) && user.role !== "superadmin") {
            return res.status(403).json({ message: "Not authorized to delete this slider" });
        }

        if (slider.image) {
            try {
                await deleteImage(slider.image);
            } catch (s3Err) {
                console.error("S3 delete error:", s3Err.message);
            }
        }

        await slider.deleteOne();
        return res.status(200).json({ message: "Slider deleted" });

    } catch (err) {
        console.error("deleteSlider error:", err);
        return res.status(500).json({ message: err.message });
    }
};



module.exports = {
    createSlider,
    getVisibleSliders,
    getSlidersForSuperadmin,
    getSlidersForSchoolAdmin,
    getSliderById,
    updateSlider,
    deleteSlider,
};
