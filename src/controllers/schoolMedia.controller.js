const SchoolMedia = require('../models/SchoolMedia');
const User = require('../models/User');
const School = require('../models/School');
const { uploadFileToS3, deleteFileFromS3 } = require('../services/s3.service');

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

const getUserName = (user, userType) => {
  if (userType === 'school') {
    return user.name || 'School';
  }
  return user.name || (user.role === 'admin_office' ? 'Admin Office' : 'User');
};

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

const formatDate = (dateString) => {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  return date.toISOString().split('T')[0];
};

const createMedia = async (req, res) => {

  try {
    const user = req.user;
    const userType = detectUserType(user);


    if (!['school', 'admin_office'].includes(userType)) {
      return res.status(403).json({
        success: false,
        message: 'Only school and admin office can upload media'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required',
        field: 'video'
      });
    }

    const { title, description, type, visibility, tags, eventDate } = req.body;

    const schoolId = getSchoolId(user, userType);
    if (!schoolId) {
      console.log('School ID not found for user:', user);
      return res.status(400).json({
        success: false,
        message: 'School ID not found'
      });
    }

    console.log('School ID:', schoolId);

    const file = req.file;

    const uploaded = await uploadFileToS3({
      fileBuffer: file.buffer,
      fileName: `${Date.now()}-${file.originalname}`,
      mimeType: file.mimetype,
    });

    const newMedia = await SchoolMedia.create({
      school: schoolId,
      createdBy: user._id,
      createdByName: getUserName(user, userType),
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
      success: true,
      message: 'Media uploaded successfully',
      data: newMedia
    });
  } catch (err) {
    console.error('createMedia error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// UPDATE MEDIA 
const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const userType = detectUserType(user);
    const userId = user._id;

    const media = await SchoolMedia.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    if (String(media.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update media you uploaded'
      });
    }

    if (userType === 'school') {
      const schoolId = getSchoolId(user, userType);
      if (String(media.school) !== String(schoolId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this media'
        });
      }
    }

    if (userType === 'admin_office') {
      const adminSchoolId = user.school;
      if (String(media.school) !== String(adminSchoolId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this media'
        });
      }
    }

    const { title, description, type, visibility, tags, eventDate } = req.body;

    if (title !== undefined) media.title = title;
    if (description !== undefined) media.description = description;
    if (type !== undefined) media.type = type === 'reel' ? 'reel' : 'video';
    if (visibility !== undefined) media.visibility = visibility === 'public' ? 'public' : 'school-only';
    if (tags !== undefined) media.tags = formatTags(tags);
    if (eventDate !== undefined) media.eventDate = formatDate(eventDate);

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
      success: true,
      message: 'Media updated successfully',
      data: media
    });
  } catch (err) {
    console.error('updateMedia error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// DELETE MEDIA 
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const userType = detectUserType(user);
    const userId = user._id;

    const media = await SchoolMedia.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    if (String(media.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete media you uploaded'
      });
    }

    if (userType === 'school') {
      const schoolId = getSchoolId(user, userType);
      if (String(media.school) !== String(schoolId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this media'
        });
      }
    }

    if (userType === 'admin_office') {
      const adminSchoolId = user.school;
      if (String(media.school) !== String(adminSchoolId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this media'
        });
      }
    }

    if (media.fileUrl) {
      try {
        await deleteFileFromS3(media.fileUrl);
      } catch (e) {
        console.warn('Failed deleting file from S3:', e.message);
      }
    }

    await media.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
      data: {
        _id: media._id,
        title: media.title,
        type: media.type
      }
    });
  } catch (err) {
    console.error('deleteMedia error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET OWN UPLOADS
const getOwnUploads = async (req, res) => {
  console.log("object", req.user)
  try {
    const user = req.user;
    const userType = detectUserType(user);
    const userId = user._id;

    const { page = 1, limit = 20, type, q, visibility } = req.query;
    const skip = (page - 1) * limit;

    const filter = { createdBy: userId };

    let schoolId = getSchoolId(user, userType);
    filter.school = schoolId;

    if (type) filter.type = type;
    if (visibility) filter.visibility = visibility;

    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { tags: new RegExp(q, 'i') }
      ];
    }

    const total = await SchoolMedia.countDocuments(filter);
    const media = await SchoolMedia.find(filter)
      .populate('school', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    const formattedMedia = media.map(item => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      type: item.type,
      visibility: item.visibility,
      fileUrl: item.fileUrl,
      tags: item.tags,
      eventDate: item.eventDate,
      school: item.school ? {
        _id: item.school._id,
        name: item.school.name
      } : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
        limit: Number(limit),
        media: formattedMedia
      }
    });
  } catch (err) {
    console.error('getOwnUploads error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// const getBySchool = async (req, res) => {
//   try {
//     const user = req.user;
//     const userType = detectUserType(user);

//     if (!['school', 'admin_office'].includes(userType)) {
//       return res.status(403).json({ 
//         success: false,
//         message: 'Not authorized' 
//       });
//     }

//     const { schoolId: paramSchoolId } = req.params;
//     const { page = 1, limit = 20, type, q, createdBy } = req.query;
//     const skip = (page - 1) * limit;

//     let authorizedSchoolId = getSchoolId(user, userType);

//     if (paramSchoolId && String(paramSchoolId) !== String(authorizedSchoolId)) {
//       return res.status(403).json({ 
//         success: false,
//         message: 'You can only view media from your school' 
//       });
//     }

//     const filter = { school: authorizedSchoolId };

//     if (type) filter.type = type;
//     if (createdBy) filter.createdBy = createdBy;

//     if (q) {
//       filter.$or = [
//         { title: new RegExp(q, 'i') },
//         { description: new RegExp(q, 'i') },
//         { tags: new RegExp(q, 'i') }
//       ];
//     }

//     const total = await SchoolMedia.countDocuments(filter);
//     const media = await SchoolMedia.find(filter)
//       .populate('createdBy', 'name email role')
//       .populate('school', 'name')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit, 10))
//       .lean();

//     const formattedMedia = media.map(item => ({
//       _id: item._id,
//       title: item.title,
//       description: item.description,
//       type: item.type,
//       visibility: item.visibility,
//       fileUrl: item.fileUrl,
//       tags: item.tags,
//       eventDate: item.eventDate,
//       school: item.school ? {
//         _id: item.school._id,
//         name: item.school.name
//       } : null,
//       createdAt: item.createdAt,
//       updatedAt: item.updatedAt
//     }));

//     return res.status(200).json({
//       success: true,
//       data: {
//         total,
//         page: Number(page),
//         totalPages: Math.ceil(total / limit),
//         limit: Number(limit),
//         school: authorizedSchoolId,
//         media: formattedMedia
//       }
//     });
//   } catch (err) {
//     console.error('getBySchool error:', err);
//     return res.status(500).json({ 
//       success: false,
//       message: 'Server error', 
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
//   }
// };

// GET FEED for teachers and students

const getFeed = async (req, res) => {
  try {
    const user = req.user;
    const userType = detectUserType(user);

    if (!['teacher', 'student'].includes(userType)) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and students can access feed'
      });
    }

    const schoolId = user.school;
    const { page = 1, limit = 20, q, type } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      school: schoolId,
      visibility: { $in: ['school-only', 'public'] }
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
      .populate('school', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    const formattedMedia = media.map(item => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      type: item.type,
      fileUrl: item.fileUrl,
      tags: item.tags,
      eventDate: item.eventDate,
      school: item.school ? {
        _id: item.school._id,
        name: item.school.name
      } : null,
      createdAt: item.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
        limit: Number(limit),
        userRole: userType,
        media: formattedMedia
      }
    });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const userType = detectUserType(user);
    const schoolId = getSchoolId(user, userType);

    const media = await SchoolMedia.findById(id)
      .populate('createdBy', 'name email role')
      .populate('school', 'name')
      .lean();

    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    let isAuthorized = false;

    if (userType === 'school') {
      isAuthorized = String(media.school) === String(schoolId);
    }
    else if (userType === 'admin_office') {
      isAuthorized = String(media.school) === String(schoolId);
    }
    else if (['teacher', 'student'].includes(userType)) {
      isAuthorized = String(media.school) === String(schoolId) &&
        media.visibility !== 'private';
    }
    else if (userType === 'superadmin') {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this media'
      });
    }

    const response = {
      _id: media._id,
      title: media.title,
      description: media.description,
      type: media.type,
      visibility: media.visibility,
      fileUrl: media.fileUrl,
      tags: media.tags,
      eventDate: media.eventDate,
      school: media.school ? {
        _id: media.school._id,
        name: media.school.name
      } : null,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt
    };

    return res.status(200).json({
      success: true,
      data: response
    });
  } catch (err) {
    console.error('getById error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


module.exports = {
  createMedia,
  updateMedia,
  deleteMedia,
  getOwnUploads,
  getFeed,
  getById
};