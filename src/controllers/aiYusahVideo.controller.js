const AiYusahVideo = require("../models/AiYusahVideo");
const User = require("../models/User");
const { validateVideo, validateFilter } = require("../validators/aiYusahVideo.validation");

const detectUserRole = (user) => {
  if (user.role === 'superadmin') return 'superadmin';
  
  if (user.schoolId || (user.verified !== undefined && user.email && !user.role)) {
    return 'school';
  }
  
  if (user.role && ['teacher', 'admin_office', 'student'].includes(user.role)) {
    return user.role;
  }
  
  return 'unknown';
};

const createAiVideo = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    if (userRole !== 'superadmin') {
      return res.status(403).json({ 
        message: "Only superadmin can create videos" 
      });
    }

    const { title, description, youtubeLink, category, status = 'active' } = req.body;

    const video = new AiYusahVideo({
      title,
      description,
      youtubeLink,
      category,
      createdBy: req.user._id,
      status
    });

    await video.save();

    res.status(201).json({
      message: "Video uploaded successfully",
      video: {
        _id: video._id,
        title: video.title,
        description: video.description,
        youtubeLink: video.youtubeLink,
        youtubeId: video.youtubeId,
        embedUrl: video.embedUrl,
        category: video.category,
        createdBy: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email
        },
        status: video.status,
        createdAt: video.createdAt
      }
    });
  } catch (err) {
    console.error("Create AiYusah Video Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Superadmin Update Video
const updateAiVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, youtubeLink, category, status } = req.body;
    const userRole = detectUserRole(req.user);

    if (userRole !== 'superadmin') {
      return res.status(403).json({ 
        message: "Only superadmin can update videos" 
      });
    }

    const video = await AiYusahVideo.findById(id);
    if (!video) return res.status(404).json({ message: "Video not found" });

    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (category) video.category = category;
    if (status) video.status = status;

    if (youtubeLink) {
      if (!youtubeLink.includes("youtube.com") && !youtubeLink.includes("youtu.be")) {
        return res.status(400).json({ message: "Invalid YouTube link" });
      }
      video.youtubeLink = youtubeLink;
    }

    await video.save();

    res.status(200).json({
      message: "Video updated successfully",
      video: {
        _id: video._id,
        title: video.title,
        description: video.description,
        youtubeLink: video.youtubeLink,
        youtubeId: video.youtubeId,
        embedUrl: video.embedUrl,
        category: video.category,
        status: video.status,
        updatedAt: video.updatedAt
      }
    });

  } catch (err) {
    console.error("Update AiYusah Video Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get Videos for Superadmin
const getVideosForSuperadmin = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    if (userRole !== 'superadmin') {
      return res.status(403).json({ 
        message: "Only superadmin can access all videos" 
      });
    }

    let { page = 1, limit = 10, search, category, status } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }
    
    if (category) filter.category = category;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const videos = await AiYusahVideo.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AiYusahVideo.countDocuments(filter);

    // Format response
    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      youtubeLink: video.youtubeLink,
      youtubeId: video.youtubeId,
      embedUrl: video.embedUrl,
      category: video.category,
      createdBy: video.createdBy ? {
        _id: video.createdBy._id,
        name: video.createdBy.name,
        email: video.createdBy.email
      } : null,
      status: video.status,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt
    }));

    res.status(200).json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
      videos: formattedVideos,
    });

  } catch (err) {
    console.error("Get Superadmin Videos Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get Videos for School/Teachers/Admins/Students
const getVideosForAll = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    // Check if user is authorized (school, teacher, admin_office, student)
    const allowedRoles = ['school', 'teacher', 'admin_office', 'student'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: "Not authorized to access videos" 
      });
    }

    let { page = 1, limit = 10, search, category } = req.query;
    page = Number(page);
    limit = Number(limit);

    // Only show active videos to non-superadmin users
    const filter = { status: 'active' };

    if (search) {
      filter.$and = [
        filter,
        {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }
          ]
        }
      ];
    }
    
    if (category) filter.category = category;

    const skip = (page - 1) * limit;

    const videos = await AiYusahVideo.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AiYusahVideo.countDocuments(filter);

    // Format response
    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      youtubeLink: video.youtubeLink,
      youtubeId: video.youtubeId,
      embedUrl: video.embedUrl,
      category: video.category,
      createdBy: video.createdBy ? {
        _id: video.createdBy._id,
        name: video.createdBy.name
      } : null,
      createdAt: video.createdAt
    }));

    res.status(200).json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
      userRole,
      videos: formattedVideos,
    });

  } catch (err) {
    console.error("Get Videos for All Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get Single Video by ID
const getVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = detectUserRole(req.user);

    const video = await AiYusahVideo.findById(id)
      .populate('createdBy', 'name email');

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Authorization check
    if (userRole !== 'superadmin' && video.status !== 'active') {
      return res.status(403).json({ 
        message: "Not authorized to view this video" 
      });
    }

    const response = {
      _id: video._id,
      title: video.title,
      description: video.description,
      youtubeLink: video.youtubeLink,
      youtubeId: video.youtubeId,
      embedUrl: video.embedUrl,
      category: video.category,
      createdBy: video.createdBy ? {
        _id: video.createdBy._id,
        name: video.createdBy.name,
        email: video.createdBy.email
      } : null,
      status: video.status,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt
    };

    // Add permissions
    if (userRole === 'superadmin') {
      response.permissions = {
        canEdit: true,
        canDelete: true,
        canToggleStatus: true
      };
    } else {
      response.permissions = {
        canEdit: false,
        canDelete: false,
        canToggleStatus: false
      };
    }

    res.status(200).json({ video: response });

  } catch (err) {
    console.error("Get Video by ID Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete Video (Superadmin only)
const deleteAiVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = detectUserRole(req.user);

    // Only superadmin can delete videos
    if (userRole !== 'superadmin') {
      return res.status(403).json({ 
        message: "Only superadmin can delete videos" 
      });
    }

    const video = await AiYusahVideo.findById(id);

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    await video.deleteOne();

    res.status(200).json({ 
      message: "Video deleted successfully",
      deletedVideo: {
        _id: video._id,
        title: video.title,
        category: video.category
      }
    });

  } catch (err) {
    console.error("Delete AiYusah Video Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Toggle video status (Superadmin only)
const toggleVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userRole = detectUserRole(req.user);

    if (userRole !== 'superadmin') {
      return res.status(403).json({ 
        message: "Only superadmin can toggle video status" 
      });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        message: "Status must be 'active' or 'inactive'" 
      });
    }

    const video = await AiYusahVideo.findById(id);

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    video.status = status;
    await video.save();

    res.status(200).json({
      message: `Video ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      video: {
        _id: video._id,
        title: video.title,
        status: video.status,
        updatedAt: video.updatedAt
      }
    });

  } catch (err) {
    console.error("Toggle Video Status Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createAiVideo,
  updateAiVideo,
  getVideosForSuperadmin,
  getVideosForAll,
  getVideoById,
  deleteAiVideo,
  toggleVideoStatus
};