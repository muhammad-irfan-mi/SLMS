const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./src/config/db');

const authRoutes = require('./src/routes/auth');
const schoolRoutes = require('./src/routes/schools.route');
const empStudentRoutes = require('./src/routes/employeeStudent.routes');
const classSectionRoutes = require('./src/routes/classSection.routes');
const subjectRoutes = require('./src/routes/subject.routes');
const scheduleRoutes = require('./src/routes/schedule.routes');
const attendanceRoutes = require('./src/routes/attendance.route');
const diaryRoutes = require('./src/routes/diary.routes');
const socialMediaRoutes = require('./src/routes/schoolMedia.routes');
const logger = require('./src/utils/logger');
const seedSuperAdmin = require('./src/seed/seedSuperAdmin');

const app = express();

app.use(cors({
    origin: (origin, callback) => {
        callback(null, true);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Accept, Authorization",
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
// app.use(cors());

app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/empStudent', empStudentRoutes);
app.use('/api/classSection', classSectionRoutes);
app.use('/api/subject', subjectRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/socialMedia', socialMediaRoutes);

app.get('/', (req, res) => res.send('School Auth Microservice API'));

const port = process.env.PORT || 4000;
const startServer = async () => {
    try {
        await connectDB(process.env.MONGO_URL || 'mongodb://localhost:27017/schoolauth');
        await seedSuperAdmin();
        app.listen(port, () => logger.info(`Server running on port ${port}`));
    } catch (err) {
        console.error("Server start error:", err);
        process.exit(1);
    }
};

startServer();

