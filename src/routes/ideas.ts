import { Router } from 'express';
import { IdeasController } from '../controllers/ideasController';
import { AuthMiddleware } from '../middleware/authMiddleware';

const router = Router();
const ideasController = new IdeasController();
const authMiddleware = new AuthMiddleware();

// Apply authentication middleware to all idea routes
router.use((req, res, next) => authMiddleware.requireAuth(req, res, next));

// POST /ideas - Create new idea and analyze it
router.post('/', async (req, res) => {
  try {
    // First create the idea
    await ideasController.createIdea(req, res);
    
    // If creation was successful, trigger analysis
    if (res.statusCode === 201) {
      const createdIdea = (res as any).locals?.idea || req.body?.ideaId;
      if (createdIdea) {
        (req.params as any).id = createdIdea._id || createdIdea.id;
        await ideasController.analyzeIdea(req, res);
      }
    }
  } catch (error) {
    console.error('Ideas route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ideas - Get user's ideas
router.get('/', ideasController.getUserIdeas);

// GET /ideas/:id - Get specific idea
router.get('/:id', ideasController.getIdeaById);

// POST /ideas/:id/analyze - Re-run analysis on idea
router.post('/:id/analyze', ideasController.analyzeIdea);

// PUT /ideas/:id/notes - Update idea notes
router.put('/:id/notes', ideasController.updateIdeaNotes);

// POST /ideas/:id/archive - Archive idea
router.post('/:id/archive', ideasController.archiveIdea);

export default router;
