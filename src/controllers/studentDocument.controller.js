const { DocumentRequest, StudentDocument } = require("../models/StudentDocument");
const User = require("../models/User");
const School = require("../models/School");
const ClassSection = require("../models/ClassSection");
const { uploadFileToS3, deleteFileFromS3 } = require("../services/s3.service");
const {
    validateFiles,
    validateBody,
    validateQuery
} = require("../validators/studentDocument.validation");

async function handleFilesUpload(files, maxFiles = 5) {
    if (!files || files.length === 0) return [];

    if (files.length > maxFiles) {
        throw new Error(`Maximum ${maxFiles} files allowed`);
    }

    const uploadedFiles = [];
    for (const file of files) {
        try {
            const uploaded = await uploadFileToS3({
                fileBuffer: file.buffer,
                fileName: file.originalname,
                mimeType: file.mimetype,
            });
            uploadedFiles.push(uploaded);
        } catch (error) {
            // Cleanup already uploaded files on failure
            for (const uploadedFile of uploadedFiles) {
                await deleteFileFromS3(uploadedFile).catch(console.error);
            }
            throw new Error(`Failed to upload file: ${file.originalname}`);
        }
    }
    return uploadedFiles;
}

const getSchoolId = (user) => {
    if (!user.role) {
        return user._id || user.id;
    } else {
        return user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);
    }
};

const getClassSectionInfo = async (classId, sectionId, schoolId) => {
    const classSection = await ClassSection.findOne({
        _id: classId,
        school: schoolId
    }).lean();

    if (!classSection) {
        return { class: null, section: null };
    }

    const classInfo = {
        _id: classSection._id,
        name: classSection.class
    };

    let sectionInfo = null;
    if (sectionId && classSection.sections) {
        const section = classSection.sections.find(
            sec => sec._id.toString() === sectionId.toString()
        );
        if (section) {
            sectionInfo = {
                _id: section._id,
                name: section.name
            };
        }
    }

    return { class: classInfo, section: sectionInfo };
};

const populateClassSectionInfo = async (documents) => {
    return Promise.all(documents.map(async (doc) => {
        const docObj = { ...doc };
        console.log(doc)

        if (doc.classId && typeof doc.classId === 'string') {
            const classInfo = await ClassSection.findById(doc.classId)
                .select('class sections school');
            if (classInfo) {
                docObj.classInfo = {
                    _id: classInfo._id,
                    class: classInfo.class,
                    school: classInfo.school
                };

                if (doc.sectionId && classInfo.sections) {
                    const section = classInfo.sections.find(
                        sec => sec._id.toString() === doc.sectionId.toString()
                    );
                    if (section) {
                        docObj.sectionInfo = {
                            _id: section._id,
                            name: section.name
                        };
                    }
                }
            }
        }

        // Populate student info if needed
        if (doc.studentId && typeof doc.studentId === 'string') {
            const student = await User.findById(doc.studentId)
                .select('name email rollNo');
            if (student) {
                docObj.studentId = {
                    _id: student._id,
                    name: student.name,
                    email: student.email,
                    rollNo: student.rollNo
                };
            }
        }

        return docObj;
    }));
};


// Create document request
const createDocumentRequest = async (req, res) => {
    try {
        const user = req.user;
        const {
            studentId,
            classId,
            sectionId,
            title,
            description,
            requestType = 'document',
            documentType = 'other',
            dueDate
        } = req.body;

        let requestedByModel = 'User';
        let requestedById = user._id;
        let requesterSchoolId = getSchoolId(user);

        if (!user.role) {
            requestedByModel = 'School';
        }

        const student = await User.findById(studentId);
        if (!student || student.role !== "student") {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const studentSchoolId = getSchoolId(student);

        if (requesterSchoolId && studentSchoolId && requesterSchoolId.toString() !== studentSchoolId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only create document requests for students in your own school"
            });
        }

        if (
            !student.classInfo?.id ||
            student.classInfo.id.toString() !== classId ||
            !student.sectionInfo?.id ||
            student.sectionInfo.id.toString() !== sectionId
        ) {
            return res.status(400).json({
                success: false,
                message: "Student is not enrolled in the specified class/section"
            });
        }

        if (user.role === 'teacher') {
            if (user.classInfo?.id?.toString() !== classId || user.sectionInfo?.id?.toString() !== sectionId) {
                return res.status(403).json({
                    success: false,
                    message: "You can only request documents from your own class/section"
                });
            }
        }

        const documentRequest = await DocumentRequest.create({
            requestedBy: requestedById,
            requestedByModel,
            studentId,
            classId,
            sectionId,
            title,
            description,
            requestType,
            documentType,
            dueDate: dueDate ? new Date(dueDate) : null,
            status: 'pending'
        });

        const populatedRequest = await DocumentRequest.findById(documentRequest._id)
            .populate({
                path: 'studentId',
                select: 'name email rollNo',
                match: { role: 'student' }
            })
            .populate({
                path: 'requesterInfo',
                select: 'name email role schoolId',
                justOne: true
            })
            .lean();

        const formattedRequest = { ...populatedRequest };
        if (formattedRequest.requesterInfo) {
            formattedRequest.requestedBy = formattedRequest.requesterInfo;
            delete formattedRequest.requesterInfo;
        }

        res.status(201).json({
            success: true,
            message: "Document request created successfully",
            data: formattedRequest
        });
    } catch (err) {
        console.error("Create Document Request Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get document requests (Teacher/Admin/School)
const getDocumentRequests = async (req, res) => {
    try {
        const user = req.user;
        const {
            studentId,
            classId,
            sectionId,
            requestType,
            documentType,
            status,
            requestedBy,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filter = {};

        const requesterSchoolId = getSchoolId(user);

        if (user.role === 'teacher') {
            if (!user.classInfo?.id || !user.sectionInfo?.id) {
                return res.status(400).json({
                    success: false,
                    message: "Teacher must be assigned to a class and section"
                });
            }

            filter.classId = user.classInfo.id;
            filter.sectionId = user.sectionInfo.id;
            filter.requestedBy = user._id;
        }
        else if (user.role === 'admin_office' || user.role === 'superadmin') {
        }
        else if (!user.role) {
            filter.requestedBy = user._id;
            filter.requestedByModel = 'School';
        }

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (requestType) filter.requestType = requestType;
        if (documentType) filter.documentType = documentType;
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const sortDirection = sortOrder === "asc" ? 1 : -1;

        const query = DocumentRequest.find(filter)
            .populate({
                path: 'studentId',
                select: 'name email rollNo school classInfo sectionInfo',
                match: { role: 'student' }
            })
            .populate({
                path: 'requesterInfo',
                select: 'name email role schoolId',
                justOne: true
            })
            .populate({
                path: 'uploadedDocument',
                select: 'text files status createdAt'
            })
            .populate({
                path: 'reviewedBy',
                select: 'name email role'
            })
            .sort({ [sortBy]: sortDirection })
            .skip(skip)
            .limit(Number(limit));

        let requests = await query.lean();

        if ((user.role === 'admin_office' || user.role === 'superadmin') && requesterSchoolId) {
            requests = requests.filter(request => {
                if (request.studentId && request.studentId.school) {
                    return request.studentId.school.toString() === requesterSchoolId.toString();
                }
                return false;
            });
        }

        const formattedRequests = await Promise.all(requests.map(async (request) => {
            const reqObj = { ...request };

            let schoolId = null;
            if (reqObj.studentId && reqObj.studentId.school) {
                schoolId = reqObj.studentId.school;
            }

            if (reqObj.classId) {
                const classSectionInfo = await getClassSectionInfo(
                    reqObj.classId,
                    reqObj.sectionId,
                    schoolId
                );

                if (classSectionInfo.class) {
                    reqObj.classInfo = {
                        id: classSectionInfo.class._id,
                        name: classSectionInfo.class.name
                    };
                }

                if (classSectionInfo.section) {
                    reqObj.sectionInfo = {
                        id: classSectionInfo.section._id,
                        name: classSectionInfo.section.name
                    };
                }

                if (reqObj.classInfo) {
                    delete reqObj.classId;
                }
                if (reqObj.sectionInfo) {
                    delete reqObj.sectionId;
                }
            }

            if (reqObj.studentId) {
                reqObj.studentInfo = {
                    _id: reqObj.studentId._id,
                    name: reqObj.studentId.name,
                    email: reqObj.studentId.email,
                    rollNo: reqObj.studentId.rollNo,
                    school: reqObj.studentId.school
                };
                delete reqObj.studentId;
            }

            if (reqObj.requesterInfo) {
                reqObj.requestedBy = reqObj.requesterInfo;
                delete reqObj.requesterInfo;
            }

            return reqObj;
        }));

        const total = formattedRequests.length;

        res.status(200).json({
            success: true,
            data: formattedRequests,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (err) {
        console.error("Get Document Requests Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get student's document requests
const getStudentDocumentRequests = async (req, res) => {
    try {
        const studentId = req.user._id;
        const {
            status,
            requestType,
            documentType,
            page = 1,
            limit = 10
        } = req.query;

        const filter = { studentId };

        if (status) filter.status = status;
        if (requestType) filter.requestType = requestType;
        if (documentType) filter.documentType = documentType;

        const skip = (Number(page) - 1) * Number(limit);

        const student = await User.findById(studentId)
            .select('name email rollNo classInfo sectionInfo school')
            .lean();

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const query = DocumentRequest.find(filter)
            .populate({
                path: 'requesterInfo',
                select: 'name email role schoolId',
                justOne: true
            })
            .populate({
                path: 'uploadedDocument',
                select: 'text files status createdAt'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const [total, requests] = await Promise.all([
            DocumentRequest.countDocuments(filter),
            query.lean()
        ]);

        const formattedRequests = await Promise.all(requests.map(async (request) => {
            const reqObj = { ...request };

            delete reqObj.studentId;

            reqObj.studentInfo = {
                _id: student._id,
                name: student.name,
                email: student.email,
                rollNo: student.rollNo,
                school: student.school
            };

            if (student.classInfo && student.classInfo.id) {
                const classSectionInfo = await getClassSectionInfo(
                    student.classInfo.id,
                    student.sectionInfo ? student.sectionInfo.id : null,
                    student.school
                );

                if (classSectionInfo.class) {
                    reqObj.classInfo = {
                        id: classSectionInfo.class._id,
                        name: classSectionInfo.class.name
                    };
                }

                if (classSectionInfo.section) {
                    reqObj.sectionInfo = {
                        id: classSectionInfo.section._id,
                        name: classSectionInfo.section.name
                    };
                }

                delete reqObj.classId;
                delete reqObj.sectionId;
            }

            if (reqObj.requesterInfo) {
                reqObj.requestedBy = reqObj.requesterInfo;
                delete reqObj.requesterInfo;
            }

            return reqObj;
        }));

        res.status(200).json({
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
            data: formattedRequests,
        });
    } catch (err) {
        console.error("Get Student Document Requests Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Update document request
const updateDocumentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, dueDate, status, reviewComments } = req.body;
        const user = req.user;

        const documentRequest = await DocumentRequest.findById(id);
        if (!documentRequest) {
            return res.status(404).json({
                success: false,
                message: "Document request not found"
            });
        }

        let hasPermission = false;

        if (documentRequest.requestedBy.toString() === user._id.toString()) {
            hasPermission = true;
        }
        else if (['admin_office'].includes(user.role) || !user.role) {
            const requesterSchoolId = getSchoolId(user);
            const student = await User.findById(documentRequest.studentId);
            if (student) {
                const studentSchoolId = getSchoolId(student);
                if (requesterSchoolId && studentSchoolId &&
                    requesterSchoolId.toString() === studentSchoolId.toString()) {
                    hasPermission = true;
                }
            }
        }
        else if (user.role === 'teacher') {
            if (documentRequest.classId.toString() === user.classId?.toString() &&
                documentRequest.sectionId.toString() === user.sectionId?.toString()) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this document request"
            });
        }

        const isStatusChanging = status && status !== documentRequest.status;

        if (title) documentRequest.title = title;
        if (description) documentRequest.description = description;
        if (dueDate) {
            const newDueDate = new Date(dueDate);
            documentRequest.dueDate = newDueDate;

            const now = new Date();
            const isFutureDate = newDueDate > now;

            if (documentRequest.status === 'expired' && isFutureDate && !isStatusChanging) {
                documentRequest.status = 'pending';
                documentRequest.reviewedBy = user._id;
                documentRequest.reviewedAt = new Date();

                documentRequest.reviewComments = reviewComments

            }
        }

        if (isStatusChanging) {
            if (documentRequest.requestedBy.toString() !== user._id.toString()) {
                documentRequest.status = status;
                documentRequest.reviewedBy = user._id;
                documentRequest.reviewedAt = new Date();
                if (reviewComments) {
                    documentRequest.reviewComments = reviewComments;
                }
            } else {
                if (status === 'cancelled' && ['pending', 'approved'].includes(documentRequest.status)) {
                    documentRequest.status = status;
                    documentRequest.reviewComments = reviewComments || "Cancelled by requester";
                } else {
                    return res.status(403).json({
                        success: false,
                        message: "You cannot change the status of your own document request"
                    });
                }
            }
        }

        const now = new Date();
        if (documentRequest.dueDate < now && documentRequest.status === 'pending') {
            documentRequest.status = 'expired';
            documentRequest.reviewedBy = user._id;
            documentRequest.reviewedAt = now;

            documentRequest.reviewComments = documentRequest.reviewComments

        }

        await documentRequest.save();

        const updatedRequest = await DocumentRequest.findById(id)
            .populate('requestedBy', 'name email role')
            .populate('reviewedBy', 'name email role')
            .populate('studentId', 'name email rollNumber')
            .populate('classId', 'class')
            .lean();

        res.status(200).json({
            success: true,
            message: "Document request updated successfully",
            data: updatedRequest || documentRequest
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Delete document request
const deleteDocumentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const documentRequest = await DocumentRequest.findById(id);
        if (!documentRequest) {
            return res.status(404).json({
                success: false,
                message: "Document request not found"
            });
        }

        // Check permissions - only requester can delete
        if (documentRequest.requestedBy.toString() !== user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own document requests"
            });
        }

        // Check if document has been uploaded
        if (documentRequest.uploadedDocument) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete document request that already has uploaded document"
            });
        }

        await documentRequest.deleteOne();

        res.status(200).json({
            success: true,
            message: "Document request deleted successfully"
        });
    } catch (err) {
        console.error("Delete Document Request Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// STUDENT DOCUMENTS
const uploadDocumentForRequest = async (req, res) => {
    try {
        validateFiles(req.files, 5, 10);

        const { requestId } = req.params;
        const { text } = req.body;
        const studentId = req.user._id;

        const documentRequest = await DocumentRequest.findById(requestId);
        if (!documentRequest) {
            return res.status(404).json({
                success: false,
                message: "Document request not found"
            });
        }

        if (documentRequest.studentId.toString() !== studentId.toString()) {
            return res.status(403).json({
                success: false,
                message: "This document request is not for you"
            });
        }

        if (documentRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Document request is already ${documentRequest.status}`
            });
        }

        if (documentRequest.dueDate && documentRequest.dueDate < new Date()) {
            documentRequest.status = 'expired';
            await documentRequest.save();
            return res.status(400).json({
                success: false,
                message: "Document request has expired"
            });
        }

        let files = [];
        if (req.files && req.files.length > 0) {
            files = await handleFilesUpload(req.files);
        }

        let uploadedFor = 'admin_office';

        if (documentRequest.requestedByModel === 'School') {
            uploadedFor = 'school';
        } else if (documentRequest.requestedByModel === 'User') {
            const requester = await User.findById(documentRequest.requestedBy);
            if (requester && requester.role === 'teacher') {
                uploadedFor = 'teacher';
            } else if (requester && (requester.role === 'admin_office' || requester.role === 'superadmin')) {
                uploadedFor = 'admin_office';
            }
        }

        const studentDocument = await StudentDocument.create({
            studentId,
            classId: documentRequest.classId,
            sectionId: documentRequest.sectionId,
            text,
            files,
            uploadedFor,
            requestedBy: documentRequest.requestedBy,
            requestedByModel: documentRequest.requestedByModel,
            requestType: documentRequest.requestType,
            requestDetails: documentRequest.description,
            status: 'submitted'
        });

        documentRequest.uploadedDocument = studentDocument._id;
        documentRequest.uploadedAt = new Date();
        documentRequest.status = 'uploaded';
        await documentRequest.save();

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully for the request",
            data: {
                document: studentDocument,
                request: documentRequest
            }
        });
    } catch (err) {
        console.error("Upload Document For Request Error:", err);

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await deleteFileFromS3(file.key || file.location).catch(console.error);
            }
        }

        res.status(500).json({
            success: false,
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Student upload general document (not for a request)
const uploadGeneralDocument = async (req, res) => {
    try {
        // Validate files
        validateFiles(req.files, 5, 10);

        const {
            classId,
            sectionId,
            text,
            uploadedFor = 'admin_office',
            requestType,
            requestDetails
        } = req.body;

        const studentId = req.user._id;
        const student = await User.findById(studentId);

        // Verify student is in the specified class and section
        if (
            !student.classInfo?.id ||
            student.classInfo.id.toString() !== classId ||
            !student.sectionInfo?.id ||
            student.sectionInfo.id.toString() !== sectionId
        ) {
            return res.status(400).json({
                success: false,
                message: "You are not enrolled in the specified class/section"
            });
        }

        // Upload files
        let files = [];
        if (req.files && req.files.length > 0) {
            files = await handleFilesUpload(req.files);
        }

        // Create document
        const document = await StudentDocument.create({
            studentId,
            classId,
            sectionId,
            text,
            files,
            uploadedFor,
            status: 'submitted',
            requestType: requestType || null,
            requestDetails: requestDetails || null
        });

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: document
        });
    } catch (err) {
        console.error("Upload General Document Error:", err);

        // Cleanup uploaded files on error
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await deleteFileFromS3(file.key || file.location).catch(console.error);
            }
        }

        res.status(500).json({
            success: false,
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Student update document
const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, uploadedFor } = req.body;

        // Validate files if present
        if (req.files && req.files.length > 0) {
            validateFiles(req.files, 5, 10);
        }

        // Find document
        const document = await StudentDocument.findById(id);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Check if student owns this document
        if (document.studentId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own documents"
            });
        }

        // Check if document is still editable
        if (document.status !== 'submitted' && document.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: "Document cannot be updated after review"
            });
        }

        // Handle file updates
        if (req.files && req.files.length > 0) {
            // Delete old files
            if (document.files && document.files.length > 0) {
                for (const file of document.files) {
                    await deleteFileFromS3(file).catch(console.error);
                }
            }

            // Upload new files
            document.files = await handleFilesUpload(req.files);
        }

        // Update fields
        if (text !== undefined) document.text = text;
        if (uploadedFor) document.uploadedFor = uploadedFor;

        // Update status based on if it's for a request
        const documentRequest = await DocumentRequest.findOne({ uploadedDocument: id });
        if (documentRequest) {
            document.status = 'pending';
        } else {
            document.status = 'submitted';
        }

        await document.save();

        res.status(200).json({
            success: true,
            message: "Document updated successfully",
            data: document
        });
    } catch (err) {
        console.error("Update Document Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Student delete document
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await StudentDocument.findById(id);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Check if student owns this document
        if (document.studentId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own documents"
            });
        }

        // Delete files from S3
        if (document.files && document.files.length > 0) {
            for (const file of document.files) {
                await deleteFileFromS3(file).catch(console.error);
            }
        }

        // If document is linked to a request, update the request
        const documentRequest = await DocumentRequest.findOne({ uploadedDocument: id });
        if (documentRequest) {
            documentRequest.uploadedDocument = null;
            documentRequest.uploadedAt = null;
            documentRequest.status = 'pending';
            await documentRequest.save();
        }

        await document.deleteOne();

        res.status(200).json({
            success: true,
            message: "Document deleted successfully"
        });
    } catch (err) {
        console.error("Delete Document Error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get student's own documents
const getStudentDocuments = async (req, res) => {
    try {
        const studentId = req.user._id;
        const {
            uploadedFor,
            requestedBy,
            requestType,
            status,
            page = 1,
            limit = 10
        } = req.query;

        const filter = { studentId };

        // Optional filters
        if (uploadedFor) filter.uploadedFor = uploadedFor;
        if (requestedBy) filter.requestedBy = requestedBy;
        if (requestType) filter.requestType = requestType;
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);

        const query = StudentDocument.find(filter)
            .populate({
                path: 'requestedByInfo',
                select: 'name email role schoolId',
                justOne: true
            })
            .populate({
                path: 'reviewedBy',
                select: 'name email role'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const [total, documents] = await Promise.all([
            StudentDocument.countDocuments(filter),
            query.lean()
        ]);

        // Format the response and populate class/section info
        const formattedDocuments = await populateClassSectionInfo(documents.map(doc => {
            const docObj = { ...doc };

            // Format requestedBy info
            if (doc.requestedByInfo) {
                docObj.requestedBy = doc.requestedByInfo;
                delete docObj.requestedByInfo;
            }

            return docObj;
        }));

        res.status(200).json({
            success: true,
            data: formattedDocuments,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
                hasNextPage: Number(page) < Math.ceil(total / limit),
                hasPrevPage: Number(page) > 1
            }
        });
    } catch (err) {
        console.error("Get Student Documents Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get documents (Teacher/Admin/School) with proper filtering
const getDocuments = async (req, res) => {
    try {
        const user = req.user;
        const {
            classId,
            sectionId,
            studentId,
            teacher,
            admin,
            school,
            requestedBy,
            requestType,
            status,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filter = {};

        // Get requester's school ID
        const requesterSchoolId = getSchoolId(user);

        // **IMPORTANT: Role-based filtering rules:**

        if (user.role === "teacher") {
            // Teachers can only see documents:
            // 1. Uploaded for 'teacher' (uploadedFor = 'teacher')
            // 2. Requested by them specifically (requestedBy = user._id)
            // 3. From their own class/section only
            if (!user.classId || !user.sectionId) {
                return res.status(400).json({
                    success: false,
                    message: "Teacher must be assigned to a class and section"
                });
            }

            filter.classId = user.classId;
            filter.sectionId = user.sectionId;
            filter.$or = [
                { uploadedFor: 'teacher' },
                { requestedBy: user._id }
            ];
        }
        else if (user.role === "admin_office" || user.role === "superadmin") {
            // Admins can see:
            // 1. All documents uploaded for 'admin_office' in their school
            // 2. Documents they personally requested
            // 3. Documents requested by any admin in their school
            filter.$or = [
                { uploadedFor: 'admin_office' },
                { requestedBy: user._id },
                { requestedByModel: 'User', uploadedFor: 'admin_office' }
            ];

            // Filter by teacher if specified
            if (teacher === "true") {
                filter.uploadedFor = "teacher";
            } else if (admin === "true") {
                filter.uploadedFor = "admin_office";
            }
        }
        else if (!user.role) { // School user
            // Schools can see:
            // 1. All documents uploaded for 'school' in their school
            // 2. Documents they personally requested
            // 3. Documents requested by any admin in their school (since school owns everything)
            filter.$or = [
                { uploadedFor: 'school' },
                { requestedBy: user._id },
                { requestedByModel: 'School', requestedBy: user._id }
            ];

            // Filter by school if specified
            if (school === "true") {
                filter.uploadedFor = "school";
            }
        }
        else {
            return res.status(403).json({
                success: false,
                message: "Access denied. Teacher, Admin, or School role required."
            });
        }

        // Additional filters with school check
        if (studentId) {
            // Verify student belongs to same school
            const student = await User.findById(studentId);
            if (student && requesterSchoolId) {
                const studentSchoolId = getSchoolId(student);
                if (studentSchoolId && studentSchoolId.toString() === requesterSchoolId.toString()) {
                    filter.studentId = studentId;
                }
            }
        }

        if (classId) filter.classId = classId;
        if (sectionId) filter.sectionId = sectionId;
        if (requestedBy) filter.requestedBy = requestedBy;
        if (requestType) filter.requestType = requestType;
        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);
        const sortDirection = sortOrder === "asc" ? 1 : -1;

        // Build query with proper population
        const query = StudentDocument.find(filter)
            .populate({
                path: 'studentId',
                select: 'name email rollNo school',
                match: { role: 'student' }
            })
            .populate({
                path: 'requestedByInfo',
                select: 'name email role schoolId',
                justOne: true
            })
            .populate({
                path: 'reviewedBy',
                select: 'name email role',
                match: { role: { $in: ['teacher', 'admin_office', 'superadmin'] } }
            })
            .sort({ [sortBy]: sortDirection })
            .skip(skip)
            .limit(Number(limit));

        let documents = await query.lean();

        // Filter by school after population
        if (requesterSchoolId) {
            documents = documents.filter(doc => {
                // Check if student belongs to same school
                if (doc.studentId && doc.studentId.school) {
                    return doc.studentId.school.toString() === requesterSchoolId.toString();
                }
                return false;
            });
        }

        // Format the response and populate class/section info
        const formattedDocuments = await populateClassSectionInfo(documents.map(doc => {
            const docObj = { ...doc };

            // Format requestedBy info
            if (doc.requestedByInfo) {
                docObj.requestedBy = doc.requestedByInfo;
                delete docObj.requestedByInfo;
            }

            return docObj;
        }));

        // Get total count with school filter
        const total = formattedDocuments.length;

        res.status(200).json({
            success: true,
            data: formattedDocuments,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
                hasNextPage: Number(page) < Math.ceil(total / limit),
                hasPrevPage: Number(page) > 1
            }
        });

    } catch (err) {
        console.error("Get Documents Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Get documents for a specific request
const getDocumentsForRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const user = req.user;

        const documentRequest = await DocumentRequest.findById(requestId)
            .populate({
                path: 'uploadedDocument',
                populate: [
                    {
                        path: 'studentId',
                        select: 'name email rollNo'
                    },
                    {
                        path: 'requestedByInfo',
                        select: 'name email role schoolId'
                    }
                ]
            })
            .populate({
                path: 'studentId',
                select: 'name email rollNo school'
            })
            .populate({
                path: 'requesterInfo',
                select: 'name email role schoolId',
                justOne: true
            });

        if (!documentRequest) {
            return res.status(404).json({
                success: false,
                message: "Document request not found"
            });
        }
        let hasPermission = false;
        const requesterSchoolId = req.user.school || getSchoolId(user);
        const studentSchoolId = documentRequest.studentId?.school || getSchoolId(documentRequest.studentId?.school);

        if (requesterSchoolId && studentSchoolId &&
            requesterSchoolId.toString() !== studentSchoolId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this document request"
            });
        }

        if (documentRequest.requestedByModel === 'School') {
            if (!user.role || ['admin_office', 'superadmin'].includes(user.role)) {
                hasPermission = true;
            }
        }
        else if (documentRequest.requestedByModel === 'User') {
            const requesterUser = await User.findById(documentRequest.requestedBy);
            if (requesterUser) {
                if (requesterUser.role === 'teacher') {
                    if (user._id.toString() === documentRequest.requestedBy.toString()) {
                        hasPermission = true;
                    }
                } else if (['admin_office', 'superadmin'].includes(requesterUser.role)) {
                    if (!user.role || ['admin_office', 'superadmin'].includes(user.role)) {
                        hasPermission = true;
                    }
                }
            }
        }

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this document request"
            });
        }

        // Format the response
        const formattedRequest = { ...documentRequest.toObject() };

        if (formattedRequest.requesterInfo) {
            formattedRequest.requestedBy = formattedRequest.requesterInfo;
            delete formattedRequest.requesterInfo;
        }

        // Populate class and section info
        if (formattedRequest.classId && typeof formattedRequest.classId === 'string') {
            const classInfo = await ClassSection.findById(formattedRequest.classId)
                .select('class sections');
            if (classInfo) {
                formattedRequest.classInfo = {
                    _id: classInfo._id,
                    class: classInfo.class
                };

                // Find section name
                if (formattedRequest.sectionId && classInfo.sections) {
                    const section = classInfo.sections.find(
                        sec => sec._id.toString() === formattedRequest.sectionId.toString()
                    );
                    if (section) {
                        formattedRequest.sectionInfo = {
                            _id: section._id,
                            name: section.name
                        };
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            data: formattedRequest
        });
    } catch (err) {
        console.error("Get Documents For Request Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Update document status (Teacher/Admin/School)
const updateDocumentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewComments } = req.body;
        const user = req.user;

        const document = await StudentDocument.findById(id);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Check permissions based on who can update what
        let hasPermission = false;
        const requesterSchoolId = getSchoolId(user);

        // Get student to check school
        const student = await User.findById(document.studentId);
        if (student) {
            const studentSchoolId = getSchoolId(student);

            // First check if same school
            if (requesterSchoolId && studentSchoolId &&
                requesterSchoolId.toString() === studentSchoolId.toString()) {

                // Now check specific permissions
                if (document.uploadedFor === 'teacher' && user.role === 'teacher') {
                    // Teacher can only update documents uploaded for teachers
                    // and only from their class/section
                    if (document.classId.toString() === user.classId?.toString() &&
                        document.sectionId.toString() === user.sectionId?.toString()) {
                        hasPermission = true;
                    }
                }
                else if (document.uploadedFor === 'admin_office' &&
                    (user.role === 'admin_office' || user.role === 'superadmin' || !user.role)) {
                    // Admins and school can update admin documents
                    hasPermission = true;
                }
                else if (document.uploadedFor === 'school' &&
                    (!user.role || user.role === 'admin_office' || user.role === 'superadmin')) {
                    // School and admins can update school documents
                    hasPermission = true;
                }
            }
        }

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this document's status"
            });
        }

        // Update document status
        document.status = status;
        document.reviewedBy = user._id;
        document.reviewedAt = new Date();
        if (reviewComments) {
            document.reviewComments = reviewComments;
        }

        await document.save();

        // Also update the linked document request if it exists
        const documentRequest = await DocumentRequest.findOne({ uploadedDocument: id });
        if (documentRequest) {
            documentRequest.status = status;
            documentRequest.reviewedBy = user._id;
            documentRequest.reviewedAt = new Date();
            if (reviewComments) {
                documentRequest.reviewComments = reviewComments;
            }
            await documentRequest.save();
        }

        res.status(200).json({
            success: true,
            message: `Document status updated to ${status}`,
            data: {
                document,
                request: documentRequest
            }
        });
    } catch (err) {
        console.error("Update Document Status Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

module.exports = {
    createDocumentRequest,
    getDocumentRequests,
    getStudentDocumentRequests,
    updateDocumentRequest,
    deleteDocumentRequest,

    // Student Document functions
    uploadDocumentForRequest,
    uploadGeneralDocument,
    updateDocument,
    deleteDocument,
    getStudentDocuments,
    getDocuments,
    getDocumentsForRequest,
    updateDocumentStatus,

    // Validation functions
    validateBody,
    validateQuery,
    validateFiles
};