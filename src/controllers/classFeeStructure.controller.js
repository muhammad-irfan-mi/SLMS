const ClassFeeStructure = require("../models/ClassFeeStructure");
const FeeComponent = require("../models/FeeComponent");
const ClassSection = require("../models/ClassSection");

const {
    assignClassFeeSchema,
    updateClassFeeSchema,
} = require("../validators/classFeeStructure.validation");



const assignFeeToClass = async (req, res) => {
    try {
        const { error, value } = assignClassFeeSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const schoolId = req.user.school;
        const { classId, fees } = value;

        const classExists = await ClassSection.findOne({
            _id: classId,
            school: schoolId,
        });

        if (!classExists) {
            return res.status(404).json({
                success: false,
                message: "Class not found",
            });
        }

        const feeComponentIds = fees.map(
            fee => fee.feeComponent
        );

        const components = await FeeComponent.find({
            _id: { $in: feeComponentIds },
            school: schoolId,
            status: "active",
        }).lean();

        if (components.length !== feeComponentIds.length) {
            return res.status(400).json({
                success: false,
                message: "One or more fee components not found or inactive",
            });
        }

        const componentMap = new Map(
            components.map(component => [
                component._id.toString(),
                component
            ])
        );

        const existingAssignments = await ClassFeeStructure.find({
            school: schoolId,
            classId,
            feeComponent: { $in: feeComponentIds },
            isActive: true,
        }).lean();

        if (existingAssignments.length > 0) {
            const duplicateNames = existingAssignments.map(item => {
                const component = componentMap.get(
                    item.feeComponent.toString()
                );
                return component?.name;
            });

            return res.status(400).json({
                success: false,
                message: `Already assigned: ${duplicateNames.join(", ")}`,
            });
        }

        const records = [];

        for (const fee of fees) {
            const component = componentMap.get(
                fee.feeComponent
            );

            let finalAmount;

            if (component.isCustomizable) {
                if (
                    fee.amount === undefined ||
                    fee.amount === null ||
                    fee.amount <= 0
                ) {
                    return res.status(400).json({
                        success: false,
                        message: `Amount required for customizable component: ${component.name}`,
                    });
                }

                finalAmount = fee.amount;
            } else {
                if (
                    component.defaultAmount === undefined ||
                    component.defaultAmount === null ||
                    component.defaultAmount <= 0
                ) {
                    return res.status(400).json({
                        success: false,
                        message: `Component ${component.name} has no default amount configured`,
                    });
                }

                finalAmount = component.defaultAmount;
            }

            records.push({
                school: schoolId,
                classId,
                feeComponent: component._id,
                amount: finalAmount,
                isActive: true,
            });
        }

        const createdRecords =
            await ClassFeeStructure.insertMany(records);

        return res.status(201).json({
            success: true,
            message: "Fees assigned to class successfully",
            data: createdRecords,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


const getClassFees = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { classId } = req.params;

        const fees = await ClassFeeStructure.find({
            school: schoolId,
            classId,
            isActive: true,
        })
            .populate("feeComponent")
            .lean();

        return res.status(200).json({
            success: true,
            data: fees,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const updateClassFee = async (req, res) => {
    try {
        const { error, value } = updateClassFeeSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const record = await ClassFeeStructure.findOne({
            _id: req.params.id,
            school: req.user.school,
        });

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Fee record not found",
            });
        }

        Object.assign(record, value);
        await record.save();

        return res.status(200).json({
            success: true,
            message: "Class fee updated",
            data: record,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const deleteClassFee = async (req, res) => {
    try {
        const record = await ClassFeeStructure.findOne({
            _id: req.params.id,
            school: req.user.school,
        });

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Fee record not found",
            });
        }

        record.isActive = false;
        await record.save();

        return res.status(200).json({
            success: true,
            message: "Fee removed from class",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    assignFeeToClass,
    getClassFees,
    updateClassFee,
    deleteClassFee,
};