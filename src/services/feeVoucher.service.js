const Student = require("../models/Student");
const ClassFeeStructure = require("../models/ClassFeeStructure");
const StudentFeeStructure = require("../models/StudentFeeStructure");
const ClassSection = require("../models/ClassSection");

const calculateStudentVoucher = async (
    studentId,
    schoolId
) => {

    const student = await Student.findOne({
        _id: studentId,
        school: schoolId,
        isActive: true,
    }).lean();

    if (!student) {
        throw new Error("Student not found");
    }

    if (!student.classInfo?.id) {
        throw new Error("Student class not assigned");
    }

    const classFees =
        await ClassFeeStructure.find({
            school: schoolId,
            classId: student.classInfo.id,
            isActive: true,
        })
            .populate(
                "feeComponent",
                "name status"
            )
            .lean();

    const studentFees =
        await StudentFeeStructure.find({
            school: schoolId,
            studentId,
            isActive: true,
        })
            .populate(
                "feeComponent",
                "name status"
            )
            .lean();

    const feeMap = new Map();

    const classInfo = await ClassSection.findOne({
        _id: student.classInfo.id,
        school: schoolId,
    }).lean();

    if (!classInfo) {
        throw new Error("Class not found");
    }

    if (classInfo.fee > 0) {
        feeMap.set("CLASS_FEE", {
            feeComponent: null,
            name: "Class Fee",
            amount: classInfo.fee,
        });
    }
    // Class fees
    for (const fee of classFees) {
        if (
            !fee.feeComponent ||
            fee.feeComponent.status !==
            "active"
        ) {
            continue;
        }

        feeMap.set(
            fee.feeComponent._id.toString(),
            {
                feeComponent:
                    fee.feeComponent._id,
                name:
                    fee.feeComponent.name,
                amount: fee.amount,
            }
        );
    }

    // Student override/custom fees
    for (const fee of studentFees) {
        if (
            !fee.feeComponent ||
            fee.feeComponent.status !==
            "active"
        ) {
            continue;
        }

        feeMap.set(
            fee.feeComponent._id.toString(),
            {
                feeComponent:
                    fee.feeComponent._id,
                name:
                    fee.feeComponent.name,
                amount: fee.amount,
            }
        );
    }

    const feeItems =
        Array.from(feeMap.values());

    const originalAmount =
        feeItems.reduce(
            (sum, item) =>
                sum + item.amount,
            0
        );

    let discountAmount = 0;
    let discountType = "none";

    if (
        student.discount &&
        student.discount > 0
    ) {

        if (student.isFixed) {

            discountType = "fixed";

            discountAmount =
                student.discount;

        } else {

            discountType =
                "percentage";

            discountAmount =
                (originalAmount *
                    student.discount) /
                100;
        }
    }

    const finalAmount =
        Math.max(
            0,
            originalAmount -
            discountAmount
        );

    return {
        feeItems,
        originalAmount,
        discountType,
        discountValue:
            student.discount || 0,
        discountAmount,
        finalAmount,
    };
};

module.exports = {
    calculateStudentVoucher,
};