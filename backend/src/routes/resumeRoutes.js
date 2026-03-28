const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload');
const { authMiddleware } = require('../middleware/auth');
const {
  uploadResume,
  analyzeResume,
  matchJD,
  downloadJdResume,
  getResumeStatus,
} = require('../controllers/resumeController');

router.use(authMiddleware);

router.post('/upload', upload.single('resume'), uploadResume);
router.post('/analyze', analyzeResume);
router.post('/match-jd', matchJD);
router.get('/download-jd/:resumeId', downloadJdResume);
router.get('/status/:resumeId', getResumeStatus);

module.exports = router;