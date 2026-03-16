const { getFullUserDetails } = require("../services/pkiServices");

exports.getUserDetailsForEdit = (req, res) => {
    try {
        const { username } = req.params;

        if (!username) {
            return res.status(400).json({ success: false, message: "Username is required" });
        }

        const userData = getFullUserDetails(username);

        if (!userData) {
            return res.status(404).json({ 
                success: false, 
                message: `No existing certificate found for user: ${username}` 
            });
        }

        // Return the full object (Identity + Roles) to the frontend
        res.json({
            success: true,
            user: userData
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};