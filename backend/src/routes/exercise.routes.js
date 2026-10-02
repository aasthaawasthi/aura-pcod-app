const router = require("express").Router();
const { getSuggestedExercises, getExercise } = require("../controllers/exercise.controller");

router.get("/today", getSuggestedExercises);
router.get("/:id", getExercise);

module.exports = router;
