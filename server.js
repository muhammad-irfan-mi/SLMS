const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./src/config/db');

const authRoutes = require('./src/routes/auth');
const schoolRoutes = require('./src/routes/schools.route');
const empStudentRoutes = require('./src/routes/employeeStudent.routes');
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

