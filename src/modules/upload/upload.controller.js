const { uploadToR2 } = require('../../utils/r2');

const uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const folder = req.query.folder || 'uploads';
    const urls = await Promise.all(req.files.map((f) => uploadToR2(f, folder)));

    res.json({ success: true, urls });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadImages };
