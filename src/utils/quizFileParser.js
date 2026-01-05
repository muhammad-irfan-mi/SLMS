const csv = require('csv-parser');
const { Readable } = require('stream');

// Parse CSV file
const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv())
      .on('data', (data) => {
        // Clean and validate CSV data
        const question = {
          type: data.type?.toLowerCase(),
          title: data.title?.trim(),
          marks: parseFloat(data.marks) || 1,
          order: parseInt(data.order) || 0
        };

        // Parse options for MCQ
        if (question.type === 'mcq' && data.options) {
          question.options = data.options
            .split(',')
            .map(opt => opt.trim())
            .filter(opt => opt.length > 0);
          
          if (data.correctOptionIndex) {
            question.correctOptionIndex = parseInt(data.correctOptionIndex);
          }
        }

        // Parse correct answer for fill type
        if (question.type === 'fill' && data.correctAnswer) {
          question.correctAnswer = data.correctAnswer.toString().trim();
        }

        results.push(question);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      });
  });
};

// Parse JSON file
const parseJSON = (buffer) => {
  try {
    const data = JSON.parse(buffer.toString());
    
    if (!Array.isArray(data)) {
      throw new Error('JSON must contain an array of questions');
    }

    return data.map((item, index) => ({
      type: item.type?.toLowerCase(),
      title: item.title?.trim(),
      options: item.options || [],
      correctOptionIndex: item.correctOptionIndex,
      correctAnswer: item.correctAnswer?.toString().trim(),
      marks: parseFloat(item.marks) || 1,
      order: parseInt(item.order) || index + 1
    }));
  } catch (error) {
    throw new Error(`JSON parsing error: ${error.message}`);
  }
};

// Parse uploaded file
const parseQuizFile = async (file) => {
  const { buffer, mimetype, originalname } = file;
  
  try {
    let questions = [];
    
    if (mimetype.includes('csv') || originalname.endsWith('.csv')) {
      questions = await parseCSV(buffer);
    } else if (mimetype.includes('json') || originalname.endsWith('.json')) {
      questions = parseJSON(buffer);
    } else {
      throw new Error('Unsupported file format');
    }

    // Validate parsed questions
    const validatedQuestions = questions
      .filter(q => q.type && q.title) // Basic validation
      .map((q, index) => ({
        ...q,
        order: q.order || index + 1
      }));

    if (validatedQuestions.length === 0) {
      throw new Error('No valid questions found in file');
    }

    return validatedQuestions;
  } catch (error) {
    throw new Error(`File parsing failed: ${error.message}`);
  }
};

module.exports = {
  parseQuizFile,
  parseCSV,
  parseJSON
};