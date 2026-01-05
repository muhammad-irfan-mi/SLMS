const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_SENDER,  
    pass: process.env.SENDER_PASS   
  } 
});

const sendMail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: process.env.EMAIL_SENDER,
    to,
    subject,
    text,
    html
  };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendMail };