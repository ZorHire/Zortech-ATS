import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import pool from './db';
import env from './config/env';
import authRoutes from './modules/auth/auth.routes';
import clientRoutes from './modules/clients/clients.routes';
import jobRoutes from './modules/jobs/jobs.routes';
import candidateRoutes from './modules/candidates/candidates.routes';
import vendorRoutes from './modules/vendors/vendors.routes';
import adminRoutes from './modules/admin/admin.routes';

const app = express();
const port = env.PORT;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Test DB Connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to PostgreSQL database');
  release();
});

// Routes
const v1Router = express.Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/clients', clientRoutes);
v1Router.use('/jobs', jobRoutes);
v1Router.use('/candidates', candidateRoutes);
v1Router.use('/vendors', vendorRoutes);
v1Router.use('/admin', adminRoutes);

app.use('/api/v1', v1Router);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;