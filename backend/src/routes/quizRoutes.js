const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const requireAuth = require('../middleware/authMiddleware');

router.post('/create', quizController.createQuiz);
router.post('/generate', quizController.generateQuestions);
router.get('/leaderboard', quizController.getGlobalLeaderboard);
router.post('/bank/save', requireAuth, quizController.saveToBank);
router.get('/bank/load', requireAuth, quizController.loadFromBank);
router.get('/:roomCode/status', quizController.getQuizStatus);

module.exports = router;
