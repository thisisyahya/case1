const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Configure transporter (Use your email service credentials)
const transporter = nodemailer.createTransport({
    service: "gmail", // Change this to your email provider
    auth: {
        user: "themultiblogsmania@gmail.com",  // Replace with your email
        pass: "cmoz lgpa alkk mbef"   // Replace with your app password
    }
});

// Function to send email
const sendHtmlEmail = async (to) => {
    try {
        // Load the email template
        let templatePath = path.join(__dirname, "templates", "emailTemplate.html");
        let emailHtml = fs.readFileSync(templatePath, "utf8");

        // Send email
        await transporter.sendMail({
            from: 'Anonymous',
            to: to,
            subject: "thanks for suscrbing us",
            html: emailHtml
        });

        console.log("Email sent successfully!");
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

module.exports = sendHtmlEmail;
