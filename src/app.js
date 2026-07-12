import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { router } from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/error.js';

const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Lightweight health probe (no auth) — handy for uptime checks.
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'transitops' }));

// All feature modules mount under /api.
app.use('/api', router);

app.use(notFound);
app.use(errorHandler);

export default app;
