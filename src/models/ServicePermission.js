// const mongoose = require("mongoose");

// const ServicePermissionSchema = new mongoose.Schema({
//   key: {
//     type: String,
//     required: true,
//     lowercase: true,
//     trim: true,
//     match: /^[a-z_][a-z0-9_]*$/ 
//   },
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     default: ""
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// ServicePermissionSchema.pre('save', function(next) {
//   this.updatedAt = Date.now();
//   next();
// });

// module.exports = mongoose.model("ServicePermission", ServicePermissionSchema);





















// models/ServicePermission.js

const mongoose = require("mongoose");

const ServicePermissionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  dependencies: [{
    type: String,
    lowercase: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ServicePermissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ServicePermission", ServicePermissionSchema);