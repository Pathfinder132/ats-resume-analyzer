const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { authMiddleware } = require('../middleware/auth');
const {
  uploadResume,
  analyzeResume,
  optimizeResumeHandler,
  downloadResume,
  getResumeStatus
} = require('../controllers/resumeController');

router.use(authMiddleware);

router.post('/upload', upload.single('resume'), uploadResume);
router.post('/analyze', analyzeResume);
router.post('/optimize', optimizeResumeHandler);
router.get('/download/:resumeId', downloadResume);
router.get('/status/:resumeId', getResumeStatus);

module.exports = router;
