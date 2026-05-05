const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const controller = require('./upload.controller');

const router = Router();

router.post('/images', authenticate, upload.array('images', 10), controller.uploadImages);

module.exports = router;
