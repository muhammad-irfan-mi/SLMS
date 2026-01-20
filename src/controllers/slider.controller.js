const SliderImage = require("../models/SliderImage");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");


const detectUserType = (user) => {
    if (user.schoolId && user.verified !== undefined) {
        return 'school';
    }
    if (user.role) {
        return user.role;
    }
    return 'unknown';
};

const getSchoolId = (user, userType) => {
    if (userType === 'school') {
        return user._id;
    }
    return user.school;
};

// Upload image helper
async function uploadSingleImage(file) {
    if (!file) return null;
    return await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: `${Date.now()}-${file.originalname}`,
        mimeType: file.mimetype,
    });
}

// Delete image helper
async function deleteImage(fileUrl) {
    if (fileUrl) {
        try {
            await deleteFileFromS3(fileUrl);
        } catch (error) {
            console.warn('Failed to delete image from S3:', error.message);
        }
    }
}

// CREATE SLIDER - Superadmin
const createSuperadminSlider = async (req, res) => {
    try {
        const user = req.user;
        const { title, caption, link, order, category = 'global' } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Image file is required'
            });
        }

        const imageUrl = await uploadSingleImage(req.file);

        const slider = await SliderImage.create({
            title,
            caption: caption || '',
            link: link || '',
            order: order ? Number(order) : 0,
            active: true,
            image: imageUrl,
            uploadedBy: user._id,
            uploadedByRole: 'superadmin',
            school: null, 
            category: 'global' 
        });

        return res.status(201).json({
            success: true,
            message: 'Slider created successfully',
            data: slider
        });

    } catch (err) {
        console.error('createSuperadminSlider error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// CREATE SLIDER - School or Admin Office
const createSchoolSlider = async (req, res) => {
    try {
        const user = req.user;
        const userType = detectUserType(user);
        const { title, caption, link, order, category, active = true } = req.body;

        if (!['school', 'admin_office'].includes(userType)) {
            return res.status(403).json({
                success: false,
                message: 'Only school and admin office can create sliders'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Image file is required'
            });
        }

        if (!['event', 'notice', 'general'].includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category. Must be event, notice, or general'
            });
        }

        const schoolId = getSchoolId(user, userType);
        if (!schoolId) {
            return res.status(400).json({
                success: false,
                message: 'School ID not found'
            });
        }

        const imageUrl = await uploadSingleImage(req.file);

        const slider = await SliderImage.create({
            title,
            caption: caption || '',
            link: link || '',
            order: order ? Number(order) : 0,
            active: active === 'true' || active === true,
            image: imageUrl,
            uploadedBy: user._id,
            uploadedByRole: userType,
            school: schoolId,
            category
        });

        return res.status(201).json({
            success: true,
            message: 'Slider created successfully',
            data: slider
        });

    } catch (err) {
        console.error('createSchoolSlider error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET VISIBLE SLIDERS (For Teachers, Students, and School Admins)
const getVisibleSliders = async (req, res) => {
    try {
        const user = req.user;
        const userType = detectUserType(user);
        const { category, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let filter = { active: true };
        let schoolId = null;

        if (['admin_office', 'teacher', 'student', 'school'].includes(userType)) {
            schoolId = getSchoolId(user, userType);
        }

        if (schoolId) {
            filter.$or = [
                { category: 'global', uploadedByRole: 'superadmin' },
                { school: schoolId, category: { $ne: 'global' } }
            ];
        } else if (userType === 'superadmin') {
            filter = { active: true };
        } else {
            filter = {
                active: true,
                category: 'global',
                uploadedByRole: 'superadmin'
            };
        }

        if (category) {
            if (filter.$or) {
                filter.$and = [
                    { $or: filter.$or },
                    { category }
                ];
                delete filter.$or;
            } else {
                filter.category = category;
            }
        }

        const [total, sliders] = await Promise.all([
            SliderImage.countDocuments(filter),
            SliderImage.find(filter)
                .sort({ order: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit, 10))
                .lean()
        ]);

        return res.status(200).json({
            success: true,
            data: {
                total,
                page: Number(page),
                totalPages: Math.ceil(total / limit),
                limit: Number(limit),
                sliders
            }
        });

    } catch (err) {
        console.error('getVisibleSliders error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET OWN UPLOADS - Superadmin
const getSuperadminSliders = async (req, res) => {
    try {
        const user = req.user;
        const userType = detectUserType(user);
        const { page = 1, limit = 20, active, category } = req.query;
        const skip = (page - 1) * limit;

        if (userType !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only superadmin can access this endpoint'
            });
        }

        const filter = {
            uploadedBy: user._id,
            uploadedByRole: 'superadmin'
        };

        if (active !== undefined) filter.active = active === 'true';
        if (category) filter.category = category;

        const [total, sliders] = await Promise.all([
            SliderImage.countDocuments(filter),
            SliderImage.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit, 10))
                .lean()
        ]);

        return res.status(200).json({
            success: true,
            data: {
                total,
                page: Number(page),
                totalPages: Math.ceil(total / limit),
                limit: Number(limit),
                sliders
            }
        });

    } catch (err) {
        console.error('getSuperadminSliders error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET OWN UPLOADS - School or Admin Office
const getSchoolAdminSliders = async (req, res) => {
    try {
        const user = req.user;
        const userType = detectUserType(user);
        const { page = 1, limit = 20, active, category } = req.query;
        const skip = (page - 1) * limit;

        if (!['school', 'admin_office'].includes(userType)) {
            return res.status(403).json({
                success: false,
                message: 'Only school and admin office can upload media'
            });
        }

        const schoolId = getSchoolId(user, userType);
        if (!schoolId) {
            return res.status(400).json({
                success: false,
                message: 'School ID not found'
            });
        }

        const filter = {
            school: schoolId,
            uploadedByRole: { $in: ['school', 'admin_office'] }
        };

        if (active !== undefined) filter.active = active === 'true';
        if (category) filter.category = category;

        const [total, sliders] = await Promise.all([
            SliderImage.countDocuments(filter),
            SliderImage.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit, 10))
                .lean()
        ]);

        return res.status(200).json({
            success: true,
            data: {
                total,
                page: Number(page),
                totalPages: Math.ceil(total / limit),
                limit: Number(limit),
                sliders
            }
        });

    } catch (err) {
        console.error('getSchoolAdminSliders error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET SLIDER BY ID
const getSliderById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const userType = detectUserType(user);

        const slider = await SliderImage.findById(id).lean();
        if (!slider) {
            return res.status(404).json({
                success: false,
                message: 'Slider not found'
            });
        }

        let isAuthorized = false;

        if (userType === 'superadmin') {
            isAuthorized = true;
        } else if (userType === 'school' || userType === 'admin_office') {
            const schoolId = getSchoolId(user, userType);
            isAuthorized =
                String(slider.uploadedBy) === String(user._id) || 
                slider.category === 'global' || 
                (slider.school && String(slider.school) === String(schoolId)); 
        } else if (['teacher', 'student'].includes(userType)) {
            const schoolId = getSchoolId(user, userType);
            isAuthorized =
                slider.category === 'global' || 
                (slider.school && String(slider.school) === String(schoolId)); 
        }

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this slider'
            });
        }

        return res.status(200).json({
            success: true,
            data: slider
        });

    } catch (err) {
        console.error('getSliderById error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// UPDATE SLIDER
const updateSlider = async (req, res) => {
    console.log(req.user)
    try {
        const { id } = req.params;
        const user = req.user;
        const userType = detectUserType(user);
        const { title, caption, link, order, active, category } = req.body;

        if (!['school', 'admin_office', "superadmin"].includes(userType)) {
            return res.status(403).json({
                success: false,
                message: 'Only school and admin office can create sliders'
            });
        }

        const slider = await SliderImage.findById(id);
        if (!slider) {
            return res.status(404).json({
                success: false,
                message: 'Slider not found'
            });
        }

        if (String(slider.uploadedBy) !== String(user._id)) {
            return res.status(403).json({
                success: false,
                message: 'You can only update sliders you uploaded'
            });
        }

        if (slider.uploadedByRole !== userType) {
            return res.status(403).json({
                success: false,
                message: 'User role mismatch'
            });
        }

        if (category) {
            if (userType === 'superadmin' && category !== 'global') {
                return res.status(400).json({
                    success: false,
                    message: 'Superadmin can only have global category'
                });
            }
            if (['school', 'admin_office'].includes(userType) &&
                !['event', 'notice', 'general'].includes(category)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid category for school/admin'
                });
            }
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (caption !== undefined) updates.caption = caption;
        if (link !== undefined) updates.link = link;
        if (order !== undefined) updates.order = Number(order);
        if (active !== undefined) updates.active = active === 'true' || active === true;
        if (category !== undefined) updates.category = category;

        if (req.file) {
            await deleteImage(slider.image);
            updates.image = await uploadSingleImage(req.file);
        }

        Object.keys(updates).forEach(key => {
            slider[key] = updates[key];
        });

        await slider.save();

        return res.status(200).json({
            success: true,
            message: 'Slider updated successfully',
            data: slider
        });

    } catch (err) {
        console.error('updateSlider error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// DELETE SLIDER
const deleteSlider = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const userType = detectUserType(user);

        const slider = await SliderImage.findById(id);
        if (!slider) {
            return res.status(404).json({
                success: false,
                message: 'Slider not found'
            });
        }

        if (String(slider.uploadedBy) !== String(user._id)) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete sliders you uploaded'
            });
        }

        if (slider.uploadedByRole !== userType) {
            return res.status(403).json({
                success: false,
                message: 'User role mismatch'
            });
        }

        await deleteImage(slider.image);

        await slider.deleteOne();

        return res.status(200).json({
            success: true,
            message: 'Slider deleted successfully',
            data: {
                _id: slider._id,
                title: slider.title
            }
        });

    } catch (err) {
        console.error('deleteSlider error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

module.exports = {
    createSuperadminSlider,
    createSchoolSlider,
    getVisibleSliders,
    getSuperadminSliders,
    getSchoolAdminSliders,
    getSliderById,
    updateSlider,
    deleteSlider
};