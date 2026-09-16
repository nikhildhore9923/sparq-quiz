const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

router.post('/create', quizController.createQuiz);
router.post('/generate', quizController.generateQuestions);
router.get('/leaderboard', quizController.getGlobalLeaderboard);
router.post('/bank/save', quizController.saveToBank);
router.get('/bank/load', quizController.loadFromBank);
router.get('/:roomCode/status', quizController.getQuizStatus);

module.exports = router;
