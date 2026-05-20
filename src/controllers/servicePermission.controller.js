// const ServicePermission = require("../models/ServicePermission");


// const createService = async (req, res) => {
//     try {
//         const { key, name, description } = req.body;
//         const normalizedKey = key.toLowerCase().trim();

//         const existingService = await ServicePermission.findOne({
//             key: normalizedKey
//         });

//         if (existingService && existingService.isActive === true) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Service with key '${key}' already exists`
//             });
//         }

//         if (existingService && existingService.isActive === false) {
//             const reactivatedService = await ServicePermission.findByIdAndUpdate(
//                 existingService._id,
//                 {
//                     name: name.trim(),
//                     description: description || '',
//                     isActive: true,
//                     updatedAt: Date.now()
//                 },
//                 { new: true, runValidators: true }
//             );

//             return res.status(200).json({
//                 success: true,
//                 message: 'Service reactivated successfully',
//                 data: {
//                     _id: reactivatedService._id,
//                     key: reactivatedService.key,
//                     name: reactivatedService.name,
//                     description: reactivatedService.description,
//                     isActive: reactivatedService.isActive
//                 }
//             });
//         }

//         const service = await ServicePermission.create({
//             key: normalizedKey,
//             name: name.trim(),
//             description: description || '',
//             isActive: true
//         });

//         res.status(201).json({
//             success: true,
//             message: 'Service created successfully',
//             data: {
//                 _id: service._id,
//                 key: service.key,
//                 name: service.name,
//                 description: service.description,
//                 isActive: service.isActive,
//                 createdAt: service.createdAt
//             }
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to create service',
//             error: error.message
//         });
//     }
// };

// const getAllServices = async (req, res) => {
//     try {
//         const { page = 1, limit = 10, search = '' } = req.query;

//         const currentPage = Math.max(parseInt(page, 10) || 1, 1);
//         const perPage = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
//         const skip = (currentPage - 1) * perPage;

//         const filter = {
//             isActive: true
//         };

//         if (search.trim()) {
//             filter.$or = [
//                 { key: { $regex: search.trim(), $options: 'i' } },
//                 { name: { $regex: search.trim(), $options: 'i' } }
//             ];
//         }

//         const [services, total] = await Promise.all([
//             ServicePermission.find(filter)
//                 .select('_id key name description isActive createdAt')
//                 .sort({ name: 1 })
//                 .skip(skip)
//                 .limit(perPage)
//                 .lean(),

//             ServicePermission.countDocuments(filter)
//         ]);

//         return res.status(200).json({
//             total,
//             page: currentPage,
//             limit: perPage,
//             totalPages: Math.ceil(total / perPage),
//             data: services,
//         });

//     } catch (error) {
//         console.error('Get All Services Error:', error);

//         return res.status(500).json({
//             success: false,
//             message: 'Failed to fetch services',
//             error: error.message
//         });
//     }
// };

// const getServiceById = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const service = await ServicePermission.findOne({
//             _id: id,
//             isActive: true
//         })
//             .select('_id key name description isActive createdAt updatedAt')
//             .lean();

//         if (!service) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Service not found'
//             });
//         }

//         return res.status(200).json({
//             message: 'Service fetched successfully',
//             data: service
//         });

//     } catch (error) {
//         console.error('Get Service By ID Error:', error);

//         return res.status(500).json({
//             success: false,
//             message: 'Failed to fetch service',
//             error: error.message
//         });
//     }
// };

// const updateService = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { key, name, description, isActive } = req.body;

//         const currentService = await ServicePermission.findById(id);

//         if (!currentService) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Service not found'
//             });
//         }

//         if (key && key !== currentService.key) {
//             const normalizedKey = key.toLowerCase().trim();

//             const conflictingService = await ServicePermission.findOne({
//                 key: normalizedKey,
//                 isActive: true,
//             });

//             if (conflictingService) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Service with key '${key}' already exists`,
//                 });
//             }

//             currentService.key = normalizedKey;
//         }

//         if (name) currentService.name = name.trim();
//         if (description !== undefined) currentService.description = description || '';
//         if (isActive !== undefined) currentService.isActive = isActive;
//         currentService.updatedAt = Date.now();

//         await currentService.save();

//         res.status(200).json({
//             success: true,
//             message: 'Service updated successfully',
//             data: {
//                 _id: currentService._id,
//                 key: currentService.key,
//                 name: currentService.name,
//                 description: currentService.description,
//                 isActive: currentService.isActive,
//                 updatedAt: currentService.updatedAt
//             }
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update service',
//             error: error.message
//         });
//     }
// };

// const deleteService = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const service = await ServicePermission.findByIdAndUpdate(
//             id,
//             { isActive: false, updatedAt: Date.now() },
//             { new: true }
//         );

//         if (!service) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Service not found'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: 'Service deleted successfully'
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Failed to delete service',
//             error: error.message
//         });
//     }
// };

// module.exports = {
//     createService,
//     getAllServices,
//     getServiceById,
//     updateService,
//     deleteService
// };
















const ServicePermission = require("../models/ServicePermission");

const getAllServices = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const currentPage = parseInt(page);
    const perPage = parseInt(limit);
    const skip = (currentPage - 1) * perPage;

    const services = await ServicePermission.find({ isActive: true })
      .select('key name description dependencies')
      .sort({ name: 1 })
      .skip(skip)
      .limit(perPage);

    const total = await ServicePermission.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      total,
      page: currentPage,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
      data: services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch services",
      error: error.message
    });
  }
};

const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    let service = await ServicePermission.findOne({
     _id: id,
      isActive: true
    }).select('key name description dependencies');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch service",
      error: error.message
    });
  }
};


module.exports = {
  getAllServices,
  getServiceById,
};