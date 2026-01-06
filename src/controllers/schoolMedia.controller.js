const SchoolMedia = require('../models/SchoolMedia');
const User = require('../models/User');
const School = require('../models/School');
const { uploadFileToS3, deleteFileFromS3 } = require('../services/s3.service');
const { validateCreateMedia, validateUpdateMedia, validateFilter, validateFile } = require('../validators/schoolMedia.validator');

// Helper to detect user role
const detectUserRole = (user) => {
  if (user.role === 'school') return 'school';
  if (user.role) return user.role;
  
  // Detect school from School model
  if (user.schoolId || (user.verified !== undefined && user.email)) {
    return 'school';
  }
  
  return 'unknown';
};

// Helper to format tags
const formatTags = (tags) => {
  if (!tags) return [];
  
  if (Array.isArray(tags)) {
    return tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
  }
  
  if (typeof tags === 'string') {
    return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }
  
  return [];
};

// Helper to format date
const formatDate = (dateString) => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

// School creates media (only school can create)
const createMedia = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    // Only school can create media
    if (userRole !== 'school') {
      return res.status(403).json({ 
        message: 'Only school can upload media' 
      });
    }

    const school = req.user._id || req.user.id; // School ID
    const userId = req.user._id;
    const userName = req.user.name || 'School';

    const { title, description, type, visibility, tags, eventDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        message: 'Video file is required',
        field: 'video'
      });
    }

    const file = req.file;
    
    // Upload to S3
    const uploaded = await uploadFileToS3({
      fileBuffer: file.buffer,
      fileName: `${Date.now()}-${file.originalname}`,
      mimeType: file.mimetype,
    });

    const newMedia = await SchoolMedia.create({
      school,
      createdBy: userId,
      createdByName: userName,
      title,
      description: description || '',
      type: type === 'reel' ? 'reel' : 'video',
      visibility: visibility === 'public' ? 'public' : 'school-only',
      fileUrl: uploaded,
      fileKey: uploaded,
      mimeType: file.mimetype,
      tags: formatTags(tags),
      eventDate: formatDate(eventDate),
    });

    return res.status(201).json({ 
      message: 'Media uploaded successfully', 
      media: newMedia 
    });
  } catch (err) {
    console.error('createMedia error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Admin office creates media
const createAdminMedia = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    // Only admin_office can create media
    if (userRole !== 'admin_office') {
      return res.status(403).json({ 
        message: 'Only admin office can upload media' 
      });
    }

    const school = req.user.school; // Admin's school
    const userId = req.user._id;
    const userName = req.user.name || 'Admin Office';

    const { title, description, type, visibility, tags, eventDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        message: 'Video file is required',
        field: 'video'
      });
    }

    const file = req.file;
    
    // Upload to S3
    const uploaded = await uploadFileToS3({
      fileBuffer: file.buffer,
      fileName: `${Date.now()}-${file.originalname}`,
      mimeType: file.mimetype,
    });

    const newMedia = await SchoolMedia.create({
      school,
      createdBy: userId,
      createdByName: userName,
      title,
      description: description || '',
      type: type === 'reel' ? 'reel' : 'video',
      visibility: visibility === 'public' ? 'public' : 'school-only',
      fileUrl: uploaded,
      fileKey: uploaded,
      mimeType: file.mimetype,
      tags: formatTags(tags),
      eventDate: formatDate(eventDate),
    });

    return res.status(201).json({ 
      message: 'Media uploaded successfully', 
      media: newMedia 
    });
  } catch (err) {
    console.error('createAdminMedia error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Update media with proper authorization
const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = detectUserRole(req.user);
    const userId = req.user._id;

    const media = await SchoolMedia.findById(id);
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Authorization check
    let isAuthorized = false;
    
    if (userRole === 'school') {
      // School can only update their own media
      const schoolId = req.user._id || req.user.id;
      isAuthorized = String(media.school) === String(schoolId) && 
                    String(media.createdBy) === String(userId);
    } 
    else if (userRole === 'admin_office') {
      // Admin office can update their own media and school media from same school
      const schoolId = req.user.school;
      isAuthorized = String(media.school) === String(schoolId);
    }
    else if (userRole === 'superadmin') {
      // Superadmin can update any media
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        message: 'Not authorized to update this media' 
      });
    }

    const { title, description, type, visibility, tags, eventDate } = req.body;

    // Update fields
    if (title !== undefined) media.title = title;
    if (description !== undefined) media.description = description;
    if (type !== undefined) media.type = type === 'reel' ? 'reel' : 'video';
    if (visibility !== undefined) media.visibility = visibility === 'public' ? 'public' : 'school-only';
    if (tags !== undefined) media.tags = formatTags(tags);
    if (eventDate !== undefined) media.eventDate = formatDate(eventDate);

    // Update file if new one uploaded
    if (req.file) {
      const file = req.file;
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: `${Date.now()}-${file.originalname}`,
        mimeType: file.mimetype,
      });

      // Delete old file from S3
      if (media.fileUrl) {
        try {
          await deleteFileFromS3(media.fileUrl);
        } catch (e) {
          console.warn('Failed deleting old file from S3:', e.message);
        }
      }

      media.fileUrl = uploaded;
      media.fileKey = uploaded;
      media.mimeType = file.mimetype;
    }

    media.updatedAt = new Date();
    await media.save();

    return res.status(200).json({
      message: 'Media updated successfully',
      media
    });
  } catch (err) {
    console.error('updateMedia error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Delete media with proper authorization
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = detectUserRole(req.user);
    const userId = req.user._id;

    const media = await SchoolMedia.findById(id);
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Authorization check
    let isAuthorized = false;
    
    if (userRole === 'school') {
      // School can only delete their own media
      const schoolId = req.user._id || req.user.id;
      isAuthorized = String(media.school) === String(schoolId) && 
                    String(media.createdBy) === String(userId);
    } 
    else if (userRole === 'admin_office') {
      // Admin office can delete their own media and school media from same school
      const schoolId = req.user.school;
      isAuthorized = String(media.school) === String(schoolId);
    }
    else if (userRole === 'superadmin') {
      // Superadmin can delete any media
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        message: 'Not authorized to delete this media' 
      });
    }

    // Delete file from S3
    if (media.fileUrl) {
      try {
        await deleteFileFromS3(media.fileUrl);
      } catch (e) {
        console.warn('Failed deleting file from S3:', e.message);
      }
    }

    await media.deleteOne();

    return res.status(200).json({ 
      message: 'Media deleted successfully',
      deletedMedia: {
        _id: media._id,
        title: media.title,
        type: media.type
      }
    });
  } catch (err) {
    console.error('deleteMedia error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Get media by school (for admin office and school)
const getBySchool = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    const { schoolId } = req.params;
    const { page = 1, limit = 20, type, q, createdBy } = req.query;
    const skip = (page - 1) * limit;

    // Authorization check
    let authorizedSchoolId = schoolId;
    
    if (userRole === 'school') {
      // School can only view their own media
      const currentSchoolId = req.user._id || req.user.id;
      if (schoolId && String(schoolId) !== String(currentSchoolId)) {
        return res.status(403).json({ 
          message: 'School can only view their own media' 
        });
      }
      authorizedSchoolId = currentSchoolId;
    } 
    else if (userRole === 'admin_office') {
      // Admin office can view media from their school
      const adminSchoolId = req.user.school;
      if (schoolId && String(schoolId) !== String(adminSchoolId)) {
        return res.status(403).json({ 
          message: 'Admin office can only view media from their school' 
        });
      }
      authorizedSchoolId = adminSchoolId;
    } else {
      return res.status(403).json({ 
        message: 'Not authorized' 
      });
    }

    // Build filter
    const filter = { school: authorizedSchoolId };

    if (type) filter.type = type;
    if (createdBy) filter.createdBy = createdBy;
    
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { tags: new RegExp(q, 'i') }
      ];
    }

    const total = await SchoolMedia.countDocuments(filter);
    const media = await SchoolMedia.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    // Format response
    const formattedMedia = media.map(item => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      type: item.type,
      visibility: item.visibility,
      fileUrl: item.fileUrl,
      tags: item.tags,
      eventDate: item.eventDate,
      createdBy: item.createdBy ? {
        _id: item.createdBy._id,
        name: item.createdBy.name,
        email: item.createdBy.email,
        role: item.createdBy.role
      } : {
        _id: item.createdBy,
        name: item.createdByName
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      limit: Number(limit),
      school: authorizedSchoolId,
      media: formattedMedia
    });
  } catch (err) {
    console.error('getBySchool error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Get feed for teachers and students (their school's media)
const getFeed = async (req, res) => {
  try {
    const userRole = detectUserRole(req.user);
    
    // Only teachers and students can access feed
    if (!['teacher', 'student'].includes(userRole)) {
      return res.status(403).json({ 
        message: 'Only teachers and students can access feed' 
      });
    }

    const school = req.user.school; // Teacher/student's school
    const { page = 1, limit = 20, q, type } = req.query;
    const skip = (page - 1) * limit;

    // Build filter: only media from their school
    const filter = { 
      school,
      visibility: { $in: ['school-only', 'public'] } // Both school-only and public
    };

    if (type) filter.type = type;
    
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
      ];
    }

    const total = await SchoolMedia.countDocuments(filter);
    const media = await SchoolMedia.find(filter)
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    // Format response
    const formattedMedia = media.map(item => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      type: item.type,
      visibility: item.visibility,
      fileUrl: item.fileUrl,
      tags: item.tags,
      eventDate: item.eventDate,
      createdBy: item.createdBy ? {
        _id: item.createdBy._id,
        name: item.createdBy.name,
        role: item.createdBy.role === 'school' ? 'School' : 'Admin Office'
      } : {
        name: item.createdByName,
        role: 'School'
      },
      createdAt: item.createdAt
    }));

    return res.status(200).json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      limit: Number(limit),
      userRole,
      media: formattedMedia
    });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

// Get single media by ID with proper authorization
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = detectUserRole(req.user);
    const userId = req.user?._id;
    const userSchool = req.user?.school || (req.user._id);

    const media = await SchoolMedia.findById(id)
      .populate('createdBy', 'name email role')
      .lean();

    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Authorization check based on role
    let isAuthorized = false;
    
    if (userRole === 'school') {
      // School can view their own media
      const schoolId = req.user._id || req.user.id;
      isAuthorized = String(media.school) === String(schoolId);
    } 
    else if (userRole === 'admin_office') {
      // Admin office can view media from their school
      const adminSchoolId = req.user.school;
      isAuthorized = String(media.school) === String(adminSchoolId);
    }
    else if (['teacher', 'student'].includes(userRole)) {
      // Teachers and students can view media from their school
      isAuthorized = String(media.school) === String(userSchool) && 
                     media.visibility !== 'private';
    }
    else if (userRole === 'superadmin') {
      // Superadmin can view any media
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        message: 'Not authorized to view this media' 
      });
    }

    // Format response
    const response = {
      _id: media._id,
      title: media.title,
      description: media.description,
      type: media.type,
      visibility: media.visibility,
      fileUrl: media.fileUrl,
      tags: media.tags,
      eventDate: media.eventDate,
      createdBy: media.createdBy ? {
        _id: media.createdBy._id,
        name: media.createdBy.name,
        email: media.createdBy.email,
        role: media.createdBy.role
      } : {
        _id: media.createdBy,
        name: media.createdByName
      },
      school: media.school,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt
    };

    return res.status(200).json({ media: response });
  } catch (err) {
    console.error('getById error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
};

module.exports = {
  createMedia,
  createAdminMedia,
  updateMedia,
  deleteMedia,
  getBySchool,
  getFeed,
  getById
};