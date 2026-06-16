// const ClassFeeStructure = require("../models/ClassFeeStructure");
// const StudentFeeAssignment = require("../models/StudentFeeStructure");
// const Student = require("../models/Student");

// class FeeCalculationService {
  
//   static async calculateStudentFee(studentId, schoolId, month, customAmount = null) {
//     try {
//       const student = await Student.findById(studentId)
//         .select("classInfo discount isFixed")
//         .lean();
      
//       if (!student) throw new Error("Student not found");
      
//       if (customAmount) {
//         return {
//           subtotal: customAmount,
//           discountAmount: 0,
//           finalAmount: customAmount,
//           feeBreakdown: [{ name: "Custom Fee", amount: customAmount, type: "custom" }],
//           discountApplied: null
//         };
//       }
      
//       // Parallel queries for better performance
//       const [classStructure, studentAssignments] = await Promise.all([
//         ClassFeeStructure.findOne({
//           classId: student.classInfo?.id,
//           school: schoolId,
//           isActive: true
//         }).lean(),
//         StudentFeeAssignment.findOne({ studentId, school: schoolId }).lean()
//       ]);
      
//       if (!classStructure) {
//         throw new Error("No fee structure found for this class");
//       }
      
//       // Build breakdown
//       const feeBreakdown = [];
//       let subtotal = 0;
      
//       // Add class fees
//       for (const comp of classStructure.components) {
//         feeBreakdown.push({
//           name: comp.componentId?.name || "Fee",
//           amount: comp.amount,
//           type: "class"
//         });
//         subtotal += comp.amount;
//       }
      
//       // Add student fees
//       if (studentAssignments?.assignments) {
//         for (const assignment of studentAssignments.assignments) {
//           if (assignment.status !== 'active') continue;
//           feeBreakdown.push({
//             name: assignment.componentId?.name || "Extra Fee",
//             amount: assignment.amount,
//             type: "student"
//           });
//           subtotal += assignment.amount;
//         }
//       }
      
//       // Calculate discount
//       let discountAmount = 0;
//       let discountApplied = null;
      
//       if (student.discount && student.discount > 0) {
//         if (student.isFixed) {
//           discountAmount = Math.min(student.discount, subtotal);
//           discountApplied = { type: "fixed", value: student.discount, amount: discountAmount };
//         } else {
//           discountAmount = (subtotal * student.discount) / 100;
//           discountApplied = { type: "percentage", value: student.discount, amount: discountAmount };
//         }
//       }
      
//       return {
//         subtotal,
//         discountAmount,
//         finalAmount: subtotal - discountAmount,
//         feeBreakdown,
//         discountApplied,
//         classFeeStructureId: classStructure._id,
//         studentFeeAssignmentId: studentAssignments?._id || null
//       };
      
//     } catch (error) {
//       throw error;
//     }
//   }
  
//   // Batch calculation for multiple students
//   static async batchCalculate(students, schoolId, month) {
//     const classIds = [...new Set(students.map(s => s.classInfo?.id).filter(Boolean))];
    
//     // Get all class structures in one query
//     const classStructures = await ClassFeeStructure.find({
//       classId: { $in: classIds },
//       school: schoolId,
//       isActive: true
//     }).lean();
    
//     const structureMap = new Map();
//     classStructures.forEach(s => structureMap.set(s.classId.toString(), s));
    
//     // Get all student assignments in one query
//     const studentIds = students.map(s => s._id);
//     const assignments = await StudentFeeAssignment.find({
//       studentId: { $in: studentIds },
//       school: schoolId
//     }).lean();
    
//     const assignmentMap = new Map();
//     assignments.forEach(a => assignmentMap.set(a.studentId.toString(), a));
    
//     // Calculate for each student
//     const results = new Map();
//     for (const student of students) {
//       const structure = structureMap.get(student.classInfo?.id?.toString());
//       if (!structure) continue;
      
//       const studentAssignment = assignmentMap.get(student._id.toString());
      
//       let subtotal = structure.components.reduce((sum, c) => sum + c.amount, 0);
      
//       if (studentAssignment?.assignments) {
//         subtotal += studentAssignment.assignments
//           .filter(a => a.status === 'active')
//           .reduce((sum, a) => sum + a.amount, 0);
//       }
      
//       let discountAmount = 0;
//       if (student.discount && student.discount > 0) {
//         discountAmount = student.isFixed 
//           ? Math.min(student.discount, subtotal)
//           : (subtotal * student.discount) / 100;
//       }
      
//       results.set(student._id.toString(), {
//         subtotal,
//         discountAmount,
//         finalAmount: subtotal - discountAmount,
//         classFeeStructureId: structure._id,
//         studentFeeAssignmentId: studentAssignment?._id || null
//       });
//     }
    
//     return results;
//   }
// }

// module.exports = FeeCalculationService;