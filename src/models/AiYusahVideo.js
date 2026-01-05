const mongoose = require("mongoose");

const AiYusahVideoSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 200
    },
    
    description: { 
      type: String,
      trim: true,
      maxlength: 1000
    },
    
    youtubeLink: { 
      type: String, 
      required: true,
      validate: {
        validator: function(v) {
          return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/.test(v);
        },
        message: props => `${props.value} is not a valid YouTube URL!`
      }
    },

    category: {
      type: String,
      enum: [
        "Behavioural Activities",
        "English Learning",
        "Health & Food",
        "Islamic Studies",
        "Capacity Building",
        "Sports",
        "Education",
        "AI Poems"
      ],
      required: true,
      index: true
    },

    // Track who created the video (always superadmin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Status for videos
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }

  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
AiYusahVideoSchema.index({ category: 1, createdAt: -1 });
AiYusahVideoSchema.index({ status: 1, createdAt: -1 });
AiYusahVideoSchema.index({ title: 'text', description: 'text' });

// Virtual for YouTube video ID
AiYusahVideoSchema.virtual('youtubeId').get(function() {
  if (!this.youtubeLink) return null;
  
  // Extract YouTube video ID from various URL formats
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = this.youtubeLink.match(regex);
  return match ? match[1] : null;
});

// Virtual for embed URL
AiYusahVideoSchema.virtual('embedUrl').get(function() {
  const videoId = this.youtubeId;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
});

module.exports = mongoose.model("AiYusahVideo", AiYusahVideoSchema);