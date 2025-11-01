const SchoolMedia = require('../models/SchoolMedia');
const { uploadFileToS3, deleteFileFromS3 } = require('../services/s3.service');

const formatDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const createMedia = async (req, res) => {
  try {
    const school = req.user.school;
    const userId = req.user._id;
    const userName = req.user.name || 'Unknown';

    const { title, description, type, visibility, tags, eventDate } = req.body;

    if (!title) return res.status(400).json({ message: 'title is required' });

    if (!req.file) return res.status(400).json({ message: 'video file required (field name: video)' });

    const file = req.file;
    const uploaded = await uploadFileToS3({
      fileBuffer: file.buffer,
      fileName: file.originalname,
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
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()) : []),
      eventDate: eventDate ? formatDate(eventDate) : null,
    });

    return res.status(201).json({ message: 'Media uploaded', media: newMedia });
  } catch (err) {
    console.error('createMedia error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const school = req.user.school;
    const userId = req.user._id;

    const media = await SchoolMedia.findById(id);
    if (!media) return res.status(404).json({ message: "Media not found" });

    if (String(media.school) !== String(school))
      return res.status(403).json({ message: "Access denied" });

    if (String(media.createdBy) !== String(userId) && req.user.role !== "superadmin")
      return res.status(403).json({ message: "Only creator or superadmin can edit" });

    const { title, description, type, visibility, tags, eventDate } = req.body;

    if (title !== undefined) media.title = title;
    if (description !== undefined) media.description = description;
    if (type !== undefined) media.type = type === "reel" ? "reel" : "video";
    if (visibility !== undefined)
      media.visibility = visibility === "public" ? "public" : "school-only";

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        media.tags = tags;
      } else {
        media.tags = String(tags)
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      }
    }

    if (eventDate !== undefined) {
      media.eventDate = eventDate ? formatDate(eventDate) : null;
    }

    if (req.file) {
      const file = req.file;
      const uploaded = await uploadFileToS3({
        fileBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });

      if (media.fileUrl) {
        try {
          await deleteFileFromS3(media.fileUrl);
        } catch (e) {
          console.warn("Failed deleting old file from S3:", e.message);
        }
      }

      media.fileUrl = uploaded;
      media.fileKey = uploaded;
      media.mimeType = file.mimetype;
    }

    media.updatedAt = new Date();
    await media.save();

    return res.status(200).json({
      message: "Media updated successfully",
      media,
    });
  } catch (err) {
    console.error("updateMedia error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const school = req.user.school;
    const userId = req.user._id;

    const media = await SchoolMedia.findById(id);
    if (!media) return res.status(404).json({ message: 'Media not found' });
    if (String(media.school) !== String(school)) return res.status(403).json({ message: 'Access denied' });
    if (String(media.createdBy) !== String(userId) && req.user.role !== 'superadmin')
      return res.status(403).json({ message: 'Only creator or superadmin can delete' });

    if (media.fileUrl) {
      try { await deleteFileFromS3(media.fileUrl); } catch (e) { console.warn('Failed deleting file from S3', e.message); }
    }
    await media.deleteOne();

    return res.status(200).json({ message: 'Media deleted' });
  } catch (err) {
    console.error('deleteMedia error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

const getBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 20, type, q } = req.query;
    const skip = (Math.max(1, page) - 1) * limit;

    const filter = {};
    if (schoolId) filter.school = schoolId;
    if (type) filter.type = type;
    if (q) filter.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }, { tags: new RegExp(q, 'i') }];

    const total = await SchoolMedia.countDocuments(filter);
    const docs = await SchoolMedia.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    return res.status(200).json({ total, page: Number(page), limit: Number(limit), media: docs });
  } catch (err) {
    console.error('getBySchool error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

const getFeed = async (req, res) => {
  try {
    const school = req.user.school;
    const { page = 1, limit = 20, q } = req.query;
    const skip = (Math.max(1, page) - 1) * limit;

    const filter = { school };
    filter.$or = [{ visibility: 'school-only' }, { visibility: 'public' }];

    if (q) filter.$or.push({ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') });

    const total = await SchoolMedia.countDocuments(filter);
    const docs = await SchoolMedia.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean();

    return res.status(200).json({ total, page: Number(page), limit: Number(limit), media: docs });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const media = await SchoolMedia.findById(id).lean();
    if (!media) return res.status(404).json({ message: 'Media not found' });
    return res.status(200).json({ media });
  } catch (err) {
    console.error('getById error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

module.exports = {
  createMedia,
  updateMedia,
  deleteMedia,
  getBySchool,
  getFeed,
  getById,
};
