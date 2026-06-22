const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/', serviceController.getServices);
router.post('/', serviceController.createService);
router.delete('/:id', serviceController.deleteServices);
router.patch('/:id', serviceController.updateService);
 
module.exports = router;