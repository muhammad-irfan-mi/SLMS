const FeeComponent = require("../models/FeeComponent");
const {
    createFeeComponentSchema,
    updateFeeComponentSchema,
} = require("../validators/feeComponent.validation");

const createFeeComponent = async (req, res) => {
    try {
        const { error, value } = createFeeComponentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message, });
        }

        const schoolId = req.user.school;

        const {
            name,
            code,
            category,
            billingType,
            // effectiveFrom,
            isCustomizable,
            defaultAmount,
            isRequired,
            description,
        } = value;

        if (!isCustomizable && (defaultAmount === undefined || defaultAmount === null || defaultAmount <= 0)) {
            return res.status(400).json({
                success: false,
                message: "Default amount is required for non-customizable fee component",
            });
        }

        const existing =
            await FeeComponent.findOne({
                school: schoolId,
                code,
            }).lean();

        if (existing) {
            return res.status(400).json({
                success: false,
                message:
                    "Fee component code already exists",
            });
        }

        const component =
            await FeeComponent.create({
                school: schoolId,
                name,
                code,
                category,
                billingType,
                // effectiveFrom,
                isCustomizable,
                defaultAmount: isCustomizable ? null : defaultAmount,
                isRequired,
                description,
            });

        return res.status(201).json({
            success: true,
            message: "Fee component created successfully",
            data: component,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getFeeComponents = async (req, res) => {
    try {
        const schoolId = req.user.school;

        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            parseInt(req.query.limit) || 20,
            100
        );

        const skip = (page - 1) * limit;

        const filter = {
            school: schoolId,
        };

        if (req.query.status) {
            filter.status =
                req.query.status;
        }

        if (req.query.category) {
            filter.category =
                req.query.category;
        }

        const [components, total] =
            await Promise.all([
                FeeComponent.find(filter)
                    .sort({
                        createdAt: -1,
                    })
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                FeeComponent.countDocuments(
                    filter
                ),
            ]);

        return res.status(200).json({
            success: true,
            data: {
                total,
                page,
                pages: Math.ceil(
                    total / limit
                ),
                components,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const updateFeeComponent = async (req, res) => {
    try {
        const { error, value } = updateFeeComponentSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const component = await FeeComponent.findOne({ _id: req.params.id, school: req.user.school });

        if (!component) {
            return res.status(404).json({
                success: false,
                message: "Fee component not found",
            });
        }

        Object.assign(
            component,
            value
        );

        await component.save();

        return res.status(200).json({
            success: true,
            message: "Fee component updated successfully",
            data: component,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const deleteFeeComponent = async (
    req,
    res
) => {
    try {
        const component =
            await FeeComponent.findOne({
                _id: req.params.id,
                school: req.user.school,
            });

        if (!component) {
            return res.status(404).json({
                success: false,
                message:
                    "Fee component not found",
            });
        }

        component.status =
            "inactive";

        await component.save();

        return res.status(200).json({
            success: true,
            message:
                "Fee component deactivated successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getFeeComponentById = async (req, res) => {
    try {
        const component = await FeeComponent.findOne({
            _id: req.params.id,
            school: req.user.school,
        }).lean();

        if (!component) {
            return res.status(404).json({
                success: false,
                message: "Fee component not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: component,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    createFeeComponent,
    getFeeComponents,
    updateFeeComponent,
    deleteFeeComponent,
    getFeeComponentById,
};