import express, { Application } from 'express';
import apiRoutes from '@/routes/apiRoutes';

const app: Application = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

export default app;