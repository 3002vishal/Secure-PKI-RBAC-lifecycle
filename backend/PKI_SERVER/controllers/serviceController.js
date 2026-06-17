const pool = require('../config/db');

// get: fetch all active apps & roles matrix rows
exports.getServices = async(req,res) => {
    try{
        const[rows] = await pool.query('select * from services order by id asc');
        res.json(rows);
        
    }
    catch(err){
        console.error("Failed to read services:", err);
        res.status(500).json({error: "Internal Server Database Error"});
    }
};

// post : Inject a new service row dynamically during  live demos 

exports.createService = async(req, res) => {
    const {name , description , roles} = req.body ;
    try{
        const sql = `insert into services (name , description, roles) values(? , ? , ?)`;
        const [result] = await pool.query(sql,[
            name, 
            description || "",
            JSON.stringify(roles)
        ]);
        res.status(201).json({
            message: "Dynamic service injected successfully!",
            id: result.insertId
        });

    }
    catch(err){
        console.error("Failed to insert service:", err);
        res.status(500).json({error: err.message});
    }

}

exports.deleteServices = async(req, res) => 
{
    const {id} = req.params;
    try {
        const sql  = `delete from services where id = ?`;
        const [result] = await pool.query(sql, [id]);

        // check if a row was actually delted 
        if(result.affectedRows === 0 )
        {
            return res.status(404).json({error: "service not found"});
        }
        res.json({
            message: "Service deleted successfully!",
            deletedId: id
        });
        
    }

    catch(err)
    {
        console.error("failed to delte service:", err);
        res.status(500).json({error: err.message});
    }
};

exports.updateService = async(req, res) => {
    const {id} = req.params;
    const {name, description , roles} = req.body;

    // Build the sql qury dynamically based on what was sent 

    const fieldsToUpdate = [];
    const queryValues = [];

    if(name !== undefined)
    {
        fieldsToUpdate.push("name = ?");
        queryValues.push(name);
    }
    if(description !== undefined)
    {
        fieldsToUpdate.push("description = ?");
        queryValues.push(description);
    }
    if(roles !== undefined) {
        fieldsToUpdate.push("roles = ?");
        queryValues.push(JSON.stringify(roles));
    }

    // if the user sent an empty body throw , an error 

    if(fieldsToUpdate.length === 0 )
    {
        return res.status(400).json({error: "No feilds passed for updation"});
    }

    try
    {
        queryValues.push(id);

        const sql = `UPDATE services SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;

        const [result] = await pool.query(sql, queryValues);

        if(result.affectedRows === 0){
            return res.status(404).json({error: "Service not found"});
        }

        res.json({
            message: "Service updated successfully!",
            updatedId: id

        });

    }
    catch(err){
        console.error("Failed to path service: ", err);
        res.status(500).json({error: err.message});
    }


};
