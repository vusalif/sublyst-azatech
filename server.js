require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Email configuration
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Send test email
app.post('/api/send-test-email', async (req, res) => {
    try {
        const { emailAddress } = req.body;
        
        if (!emailAddress) {
            return res.status(400).json({ error: 'Email address is required' });
        }

        const transporter = createTransporter();
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: emailAddress,
            subject: 'Subscription Calendar - Test Email',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">🔔 Subscription Calendar Test Email</h2>
                    <p>This is a test email from your Subscription Calendar app!</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #1976d2;">Email notifications are working correctly!</h3>
                        <p>You'll now receive notifications for upcoming subscription billing dates.</p>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        If you received this email, your notification system is properly configured.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Test email sent successfully!' });
        
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

// Send billing notification
app.post('/api/send-billing-notification', async (req, res) => {
    try {
        const { emailAddress, subscriptions, daysUntilBilling } = req.body;
        
        if (!emailAddress || !subscriptions || !subscriptions.length) {
            return res.status(400).json({ error: 'Email address and subscriptions are required' });
        }

        const transporter = createTransporter();
        
        const totalAmount = subscriptions.reduce((sum, sub) => sum + sub.price, 0);
        const subscriptionList = subscriptions.map(sub => 
            `<li style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                <strong>${sub.name}</strong> - $${sub.price} (${sub.billingCycle})
            </li>`
        ).join('');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: emailAddress,
            subject: `🔔 Subscription Billing Reminder - ${subscriptions.length} subscription(s) due in ${daysUntilBilling} days`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d32f2f;">⚠️ Upcoming Subscription Billing</h2>
                    <p>You have <strong>${subscriptions.length} subscription(s)</strong> due in <strong>${daysUntilBilling} days</strong>.</p>
                    
                    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <h3 style="color: #856404; margin-top: 0;">Total Amount Due: $${totalAmount.toFixed(2)}</h3>
                    </div>
                    
                    <h3 style="color: #333;">Upcoming Subscriptions:</h3>
                    <ul style="list-style: none; padding: 0;">
                        ${subscriptionList}
                    </ul>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #1976d2;">
                            <strong>💡 Tip:</strong> Make sure you have sufficient funds in your payment method to avoid any service interruptions.
                        </p>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        This notification was sent from your Subscription Calendar app.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Billing notification sent successfully!' });
        
    } catch (error) {
        console.error('Error sending billing notification:', error);
        res.status(500).json({ error: 'Failed to send billing notification' });
    }
});

// Check for upcoming billing dates
app.post('/api/check-upcoming-billing', async (req, res) => {
    try {
        const { subscriptions, notificationDays, emailAddress } = req.body;
        
        if (!subscriptions || !Array.isArray(subscriptions)) {
            return res.status(400).json({ error: 'Subscriptions array is required' });
        }

        const today = new Date();
        const upcomingDate = new Date(today);
        upcomingDate.setDate(today.getDate() + parseInt(notificationDays));

        const upcomingSubscriptions = subscriptions.filter(subscription => {
            const billingDate = new Date(subscription.nextBillingDate);
            return isSameDate(billingDate, upcomingDate);
        });

        if (upcomingSubscriptions.length > 0 && emailAddress) {
            // Send notification
            const notificationResponse = await fetch(`http://localhost:${PORT}/api/send-billing-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailAddress,
                    subscriptions: upcomingSubscriptions,
                    daysUntilBilling: notificationDays
                })
            });
            
            const notificationResult = await notificationResponse.json();
            return res.json({ 
                success: true, 
                upcomingSubscriptions,
                notificationSent: notificationResult.success 
            });
        }

        res.json({ 
            success: true, 
            upcomingSubscriptions: [],
            notificationSent: false 
        });
        
    } catch (error) {
        console.error('Error checking upcoming billing:', error);
        res.status(500).json({ error: 'Failed to check upcoming billing' });
    }
});

// Helper function to compare dates
function isSameDate(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Email notifications ready!`);
    console.log(`📧 Using email: ${process.env.EMAIL_USER}`);
});

module.exports = app;
