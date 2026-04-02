const mongoose = require('mongoose');
const AiYusahVideo = require("../models/AiYusahVideo");
const { validateVideo, validateFilter, validateMediaUrl, PLATFORMS } = require("../validators/aiYusahVideo.validation");

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

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const createAiVideo = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    if (userRole !== 'superadmin') {
      return res.status(403).json({ 
        message: "Only superadmin can create videos" 
      });
    }

    const { title, description, mediaUrl, platform, category, status = 'active' } = req.body;
    console.log("object", req.user._id)

    const video = new AiYusahVideo({
      title,
      description,
      mediaUrl,
      platform,
      category,
      createdBy: req.user._id,
      status
    });

    await video.save();
    await video.populate('createdBy', 'name email');

    res.status(201).json({
      message: "Video uploaded successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateAiVideo = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid video ID format" });
    }
    
    const { title, description, mediaUrl, platform, category, status } = req.body;
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
    if (mediaUrl) video.mediaUrl = mediaUrl;
    if (platform) video.platform = platform;
    if (category) video.category = category;
    if (status) video.status = status;

    await video.save();
    await video.populate('createdBy', 'name email');

    res.status(200).json({
      message: "Video updated successfully",
    });

  } catch (err) {
    console.error("Update AiYusah Video Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getVideosForSuperadmin = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    if (userRole !== 'superadmin') {
      return res.status(403).json({ 
        message: "Only superadmin can access all videos" 
      });
    }

    let { page = 1, limit = 10, search, category, platform, status } = req.query;

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
    if (platform) filter.platform = platform;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const videos = await AiYusahVideo.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AiYusahVideo.countDocuments(filter);

    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      mediaUrl: video.mediaUrl,
      platform: video.platform,
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
    res.status(500).json({ message: err.message });
  }
};

const getVideosForAll = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    const allowedRoles = ['school', 'teacher', 'admin_office', 'student'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: "Not authorized to access videos" 
      });
    }

    let { page = 1, limit = 10, search, category, platform } = req.query;
    page = Number(page);
    limit = Number(limit);

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
    if (platform) filter.platform = platform;

    const skip = (page - 1) * limit;

    const videos = await AiYusahVideo.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AiYusahVideo.countDocuments(filter);

    const formattedVideos = videos.map(video => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      mediaUrl: video.mediaUrl,
      platform: video.platform,
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
      videos: formattedVideos,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      if (id === 'school' || id === 'admin' || id === 'feed' || id === 'student') {
        return res.status(400).json({ 
          message: `Invalid endpoint. Did you mean to access a different URL?` 
        });
      }
      return res.status(400).json({ 
        message: `Invalid video ID format: ${id}` 
      });
    }
    
    const userRole = detectUserRole(req.user);

    const video = await AiYusahVideo.findById(id)
      .populate('createdBy', 'name email');

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    if (userRole !== 'superadmin' && video.status !== 'active') {
      return res.status(403).json({ 
        message: "Not authorized to view this video" 
      });
    }

    const response = {
      _id: video._id,
      title: video.title,
      description: video.description,
      mediaUrl: video.mediaUrl,
      platform: video.platform,
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

    res.status(200).json({ video: response });

  } catch (err) {    
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ 
        message: `Invalid video ID format: ${err.value}` 
      });
    }
    
    res.status(500).json({ message: err.message });
  }
};

const deleteAiVideo = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid video ID format" });
    }
    
    const userRole = detectUserRole(req.user);

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
        platform: video.platform,
        category: video.category
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid video ID format" });
    }
    
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
        platform: video.platform,
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