import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createResponse(
  input: string, 
  previousResponseId?: string, 
  filePath?: string,
  originalFilename?: string,
  webSearchEnabled?: boolean,
  codeInterpreterEnabled?: boolean,
  deepWikiMcpEnabled?: boolean,
  imageGenerationEnabled?: boolean
) {
  const params: any = {
    model: 'gpt-4.1',
  };

  if (previousResponseId) {
    params.previous_response_id = previousResponseId;
  }

  // Add tools if enabled
  const tools = [];
  if (webSearchEnabled) {
    tools.push({ type: 'web_search' });
  }
  if (codeInterpreterEnabled) {
    tools.push({ 
      type: 'code_interpreter',
      container: { type: 'auto' }
    });
  }
  if (deepWikiMcpEnabled) {
    tools.push({
      type: 'mcp',
      server_label: 'deepwiki',
      server_url: 'https://mcp.deepwiki.com/mcp',
      allowed_tools: [
        'read_wiki_structure',
        'read_wiki_contents', 
        'ask_question'
      ],
      require_approval: 'never'
    });
  }
  if (imageGenerationEnabled) {
    tools.push({ type: 'image_generation', moderation: 'low' });
  }
  if (tools.length > 0) {
    params.tools = tools;
  }

  // Handle file upload if provided
  if (filePath) {
    try {
      // Upload file to OpenAI with proper filename
      let fileToUpload = filePath;
      
      // If we have an originalFilename, copy the file with the proper extension
      if (originalFilename) {
        const fileExtension = path.extname(originalFilename);
        const tempPath = filePath + fileExtension;
        fs.copyFileSync(filePath, tempPath);
        fileToUpload = tempPath;
      }
      
      const file = await openai.files.create({
        file: fs.createReadStream(fileToUpload),
        purpose: 'assistants'
      });

      // Use original filename for extension detection if available
      const fileToCheck = originalFilename || filePath;
      const fileExtension = path.extname(fileToCheck).toLowerCase();
      const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExtension);

      if (isImage) {
        // For images, use input_image type in message content
        params.input = [{
          "role": "user",
          "content": [
            { "type": "input_text", "text": input },
            { 
              "type": "input_image", 
              "file_id": file.id 
            }
          ]
        }];
      } else {
        // For PDFs and other documents, use input_file type in multimodal content
        params.input = [{
          "role": "user",
          "content": [
            { "type": "input_text", "text": input },
            { 
              "type": "input_file", 
              "file_id": file.id 
            }
          ]
        }];
        
        console.log('Document using multimodal input_file approach');
      }

      console.log('File uploaded:', { 
        file_id: file.id, 
        filename: file.filename,
        originalFilename,
        fileExtension,
        isImage,
        inputType: isImage ? 'multimodal_message' : 'document_text_reference'
      });
      
      console.log('Sending to OpenAI API:', JSON.stringify(params, null, 2));
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error('Failed to upload file to OpenAI');
    }
  } else {
    // Text-only input
    params.input = input;
  }

  const response = await openai.responses.create(params);
  return response;
}
