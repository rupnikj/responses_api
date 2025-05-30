import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST, before any other imports
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createResponse } from './openai';

// Debug: Check if the API key is loaded
console.log('Current working directory:', process.cwd());
console.log('OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? 'YES (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'NO');

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

app.use(cors());
app.use(express.json());

// POST /api/responses endpoint with optional file upload
function handleResponses(req: any, res: any) {
  console.log('Received request:', { 
    body: req.body,
    hasFile: !!req.file,
    fileInfo: req.file ? { originalname: req.file.originalname, size: req.file.size } : null
  });
  
  const { input, previousResponseId } = req.body;
  if (!input || input.trim() === '') {
    console.log('Missing or empty input in request');
    return res.status(400).json({ error: 'Missing input' });
  }
  
  console.log('Calling OpenAI with:', { input, previousResponseId, filePath: req.file?.path });
  createResponse(input, previousResponseId, req.file?.path, req.file?.originalname)
    .then(response => {
      console.log('OpenAI response received:', { id: response.id, outputLength: response.output?.length });
      res.json(response);
    })
    .catch(error => {
      console.error('OpenAI error:', error.message || error);
      res.status(500).json({ error: error.message || 'OpenAI API error' });
    });
}

// Route with file upload support (FormData)
app.post('/api/responses', upload.single('file'), handleResponses);

// Route for text-only requests (JSON)
app.post('/api/responses-text', handleResponses);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
