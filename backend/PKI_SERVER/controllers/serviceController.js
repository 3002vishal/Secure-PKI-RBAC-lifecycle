const pool = require('../config/db');

// GET: Fetch all active apps & roles matrix rows
exports.getServices = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM services ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error("Failed to read services:", err);
        res.status(500).json({ error: "Internal Server Database Error" });
    }
};

// POST: Inject a new service row dynamically during live demos 
exports.createService = async (req, res) => {
    // 1. Destructure target_url from req.body
    const { name, description, target_url, roles } = req.body;
    
    // Quick validation to enforce Zero Trust microservice destination routing
    if (!target_url) {
        return res.status(400).json({ error: "target_url is required for routing requests." });
    }

    try {
        // 2. Add target_url to the INSERT columns
        const sql = `INSERT INTO services (name, description, target_url, roles) VALUES (?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [
            name,
            description || "",
            target_url,
            JSON.stringify(roles)
        ]);
        
        res.status(201).json({
            message: "Dynamic service injected successfully!",
            id: result.insertId
        });
    } catch (err) {
        console.error("Failed to insert service:", err);
        res.status(500).json({ error: err.message });
    }
};

// DELETE: Remove a service by ID
exports.deleteServices = async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `DELETE FROM services WHERE id = ?`;
        const [result] = await pool.query(sql, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "service not found" });
        }
        res.json({
            message: "Service deleted successfully!",
            deletedId: id
        });
    } catch (err) {
        console.error("Failed to delete service:", err);
        res.status(500).json({ error: err.message });
    }
};

// UPDATE: Modify properties of a service dynamically
exports.updateService = async (req, res) => {
    const { id } = req.params;
    // 3. Destructure target_url here to allow dynamic updates
    const { name, description, target_url, roles } = req.body;

    const fieldsToUpdate = [];
    const queryValues = [];

    if (name !== undefined) {
        fieldsToUpdate.push("name = ?");
        queryValues.push(name);
    }
    if (description !== undefined) {
        fieldsToUpdate.push("description = ?");
        queryValues.push(description);
    }
    // 4. Append target_url parameter dynamically if passed in payload
    if (target_url !== undefined) {
        fieldsToUpdate.push("target_url = ?");
        queryValues.push(target_url);
    }
    if (roles !== undefined) {
        fieldsToUpdate.push("roles = ?");
        queryValues.push(JSON.stringify(roles));
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: "No fields passed for updation" });
    }

    try {
        queryValues.push(id);

        const sql = `UPDATE services SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
        const [result] = await pool.query(sql, queryValues);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Service not found" });
        }

        res.json({
            message: "Service updated successfully!",
            updatedId: id
        });
    } catch (err) {
        console.error("Failed to patch service: ", err);
        res.status(500).json({ error: err.message });
    }
};