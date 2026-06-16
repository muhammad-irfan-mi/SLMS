const StudentFeeStructure = require("../models/StudentFeeStructure");
const ClassFeeStructure = require("../models/ClassFeeStructure");
const FeeComponent = require("../models/FeeComponent");

const {
  assignStudentFeeSchema,
  updateStudentFeeSchema,
} = require("../validators/studentFeeStructure.validation");


const assignFeeToStudent = async (req, res) => {
  try {
    const { error, value } =
      assignStudentFeeSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const schoolId = req.user.school;

    const {
      studentId,
      classId,
      fees,
    } = value;

    const feeComponentIds =
      fees.map(fee => fee.feeComponent);

    const components =
      await FeeComponent.find({
        _id: { $in: feeComponentIds },
        school: schoolId,
        status: "active",
      }).lean();

    if (
      components.length !==
      feeComponentIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more fee components not found or inactive",
      });
    }

    const componentMap = new Map(
      components.map(component => [
        component._id.toString(),
        component,
      ])
    );

    const operations = [];

    for (const fee of fees) {
      const component =
        componentMap.get(
          fee.feeComponent
        );

      let finalAmount;

      if (component.isCustomizable) {
        if (
          fee.amount !== undefined &&
          fee.amount !== null
        ) {
          finalAmount = fee.amount;
        } else if (
          component.defaultAmount !== undefined &&
          component.defaultAmount !== null
        ) {
          finalAmount =
            component.defaultAmount;
        } else {
          return res.status(400).json({
            success: false,
            message: `Amount required for ${component.name}`,
          });
        }
      } else {
        if (
          component.defaultAmount === undefined ||
          component.defaultAmount === null
        ) {
          return res.status(400).json({
            success: false,
            message: `Default amount missing for ${component.name}`,
          });
        }

        finalAmount =
          component.defaultAmount;
      }

      operations.push({
        updateOne: {
          filter: {
            school: schoolId,
            studentId,
            feeComponent:
              fee.feeComponent,
          },
          update: {
            school: schoolId,
            studentId,
            classId,
            feeComponent:
              fee.feeComponent,
            amount: finalAmount,
            type:
              fee.type ||
              "override",
            isActive: true,
          },
          upsert: true,
        },
      });
    }

    await StudentFeeStructure.bulkWrite(
      operations
    );

    const records =
      await StudentFeeStructure.find({
        school: schoolId,
        studentId,
        feeComponent: {
          $in: feeComponentIds,
        },
      })
        .populate("feeComponent")
        .lean();

    return res.status(201).json({
      success: true,
      message:
        "Student fees assigned successfully",
      data: records,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const getStudentFees = async (req, res) => {
  try {
    const schoolId = req.user.school;
    const { studentId } = req.params;

    const fees = await StudentFeeStructure.find({
      school: schoolId,
      studentId,
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


const updateStudentFee = async (req, res) => {
  try {
    const { error, value } = updateStudentFeeSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const record = await StudentFeeStructure.findOne({
      _id: req.params.id,
      school: req.user.school,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Student fee not found",
      });
    }

    Object.assign(record, value);
    await record.save();

    return res.status(200).json({
      success: true,
      message: "Student fee updated",
      data: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteStudentFee = async (req, res) => {
  try {
    const record = await StudentFeeStructure.findOne({
      _id: req.params.id,
      school: req.user.school,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Student fee not found",
      });
    }

    record.isActive = false;
    await record.save();

    return res.status(200).json({
      success: true,
      message: "Student fee removed",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  assignFeeToStudent,
  getStudentFees,
  updateStudentFee,
  deleteStudentFee,
};