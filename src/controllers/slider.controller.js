const SliderImage = require("../models/SliderImage");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");

async function uploadSingleImage(file) {
    if (!file) return null;
    return await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
    });
}

async function deleteImage(fileUrl) {
    await deleteFileFromS3(fileUrl);
}

// CREATE SLIDER
const createSlider = async (req, res) => {
    try {
        const user = req.user;
        const { title, caption, link, order, category } = req.body;

        if (!user.role) user.role = "school";
        if (!title || !req.file)
            return res.status(400).json({ message: "Title and image are required" });

        let allowedCategories = [];
        let selectedCategory = category;

        if (user.role === "superadmin") {
            allowedCategories = ["global"];
            selectedCategory = "global";
        }

        if (user.role === "admin_office" || user.role === "school") {
            allowedCategories = ["event", "notice", "general"];
            if (!allowedCategories.includes(category))
                return res.status(400).json({ message: "Invalid category for school admin" });
        }

        const imageUrl = await uploadSingleImage(req.file);

        // let school = null;
        // if (user.role === "admin_office") school = user.school;

        const slider = await SliderImage.create({
            title,
            caption,
            link,
            order: order ? Number(order) : 0,
            active: req.body.active !== undefined ? req.body.active === "true" : true,
            image: imageUrl,
            uploadedBy: user._id,
            uploadedByRole: user.role,
            school: user.role === "school" ? user.id : user.role === "admin_office" ? user.school : null,
            category: selectedCategory,
        });

        return res.status(201).json({ message: "Slider created", slider });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};


// Get visible sliders for any logged-in user (students/teachers/admins)
const getVisibleSliders = async (req, res) => {
    try {
        const user = req.user;
        let filter = { active: true };

        const { category } = req.query;

        if (user.school) {
            filter.$or = [
                { category: "global", uploadedByRole: "superadmin" },
                { school: user.school }
            ];

            // If category filter exists
            if (category) {
                filter.$and = [
                    { $or: filter.$or },
                    { category: category }
                ];
                delete filter.$or;
            }
        }
        else {
            filter = {
                active: true,
                category: "global",
                uploadedByRole: "superadmin"
            };

            if (category) {
                filter.category = category;
            }
        }

        const sliders = await SliderImage.find(filter)
            .sort({ order: -1, createdAt: -1 });

        return res.status(200).json({ sliders });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
};

//  Get sliders uploaded by superadmin (only superadmin)
const getSlidersForSuperadmin = async (req, res) => {
    try {
        const user = req.user;

        const sliders = await SliderImage.find({
            uploadedBy: user._id,
            uploadedByRole: "superadmin"
        }).sort({ createdAt: -1 });

        return res.status(200).json({ sliders });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

//  Get sliders uploaded by a school admin (their uploads)
const getSlidersForSchoolAdmin = async (req, res) => {
    try {
        const user = req.user;
        console.log('user', user)
        console.log('user', user._id)

        const sliders = await SliderImage.find({
            uploadedByRole: { $in: ["admin_office", "school"] },
            school: user.school || user._id
        }).sort({ createdAt: -1 });

        return res.status(200).json({ sliders });

    } catch (err) {
        return res.status(500).json({ message: err.message });
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

        if (String(slider.uploadedBy) !== String(user._id))
            return res.status(403).json({ message: "Not authorized" });

        // Update fields
        ["title", "caption", "link", "order", "active"].forEach(f => {
            if (req.body[f] !== undefined) slider[f] = req.body[f];
        });

        if (req.file) {
            await deleteImage(slider.image);
            slider.image = await uploadSingleImage(req.file);
        }

        await slider.save();
        res.json({ message: "Updated", slider });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const deleteSlider = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;

        const slider = await SliderImage.findById(id);
        if (!slider) return res.status(404).json({ message: "Slider not found" });

        if (String(slider.uploadedBy) !== String(user._id))
            return res.status(403).json({ message: "Not authorized" });

        await deleteImage(slider.image);
        await slider.deleteOne();

        return res.status(200).json({ message: "Slider deleted" });

    } catch (err) {
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
