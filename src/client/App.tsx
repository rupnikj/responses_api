import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  fileName?: string;
  imageUrl?: string;
}

// Define a specific type for items in the output array
interface ApiOutputItem {
  type?: string;
  content?: Array<{
    text: string;
  }>;
  // Fields for image_generation_call based on your previous log
  id?: string; // The image generation call itself can have an id
  status?: string;
  background?: string;
  output_format?: string; // e.g., "png"
  result?: string;        // Base64 image data for image_generation_call
  
  // These were for other potential image structures, keep for flexibility or future use
  image_url?: string; 
  image_data?: string; 
}

interface ApiResponse {
  id: string;
  output: Array<ApiOutputItem>; // Use the detailed ApiOutputItem here
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
  const [codeInterpreterEnabled, setCodeInterpreterEnabled] = useState<boolean>(false);
  const [deepWikiMcpEnabled, setDeepWikiMcpEnabled] = useState<boolean>(false);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState<boolean>(false);

  // Ref for auto-scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  const removeFile = () => {
    setSelectedFile(null);
    // Reset the file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input || (selectedFile ? `[Uploaded file: ${selectedFile.name}]` : ''),
      isUser: true,
      timestamp: new Date(),
      fileName: selectedFile?.name
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentFile = selectedFile;
    setInput('');
    setSelectedFile(null);
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    setIsLoading(true);

    try {
      let response;
      
      if (currentFile) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append('input', currentInput || 'Please analyze this file');
        if (lastResponseId) {
          formData.append('previousResponseId', lastResponseId);
        }
        formData.append('file', currentFile);
        formData.append('webSearchEnabled', webSearchEnabled.toString());
        formData.append('codeInterpreterEnabled', codeInterpreterEnabled.toString());
        formData.append('deepWikiMcpEnabled', deepWikiMcpEnabled.toString());
        formData.append('imageGenerationEnabled', imageGenerationEnabled.toString());

        response = await fetch('http://localhost:3001/api/responses', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Use JSON for text-only messages
        response = await fetch('http://localhost:3001/api/responses-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: currentInput,
            previousResponseId: lastResponseId,
            webSearchEnabled: webSearchEnabled,
            codeInterpreterEnabled: codeInterpreterEnabled,
            deepWikiMcpEnabled: deepWikiMcpEnabled,
            imageGenerationEnabled: imageGenerationEnabled
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, response.statusText, errorText);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data: ApiResponse = await response.json();
      console.log('Full API Response Output:', JSON.stringify(data.output, null, 2));
      
      let responseText = ''; // Initialize with empty string to build upon
      let imageUrl: string | undefined = undefined;
      
      if (data.output && Array.isArray(data.output)) {
        // Process all output items
        data.output.forEach(item => {
          if (item.type === 'message' && item.content && Array.isArray(item.content)) {
            const textContent = item.content.find(c => c.text);
            if (textContent && textContent.text) {
              responseText += (responseText ? '\n' : '') + textContent.text; // Append text if multiple message parts
            }
          } else if (item.type === 'image_generation_call' && item.result && item.output_format) {
            imageUrl = `data:image/${item.output_format};base64,${item.result}`;
            if (!responseText) { // If no specific text accompanied the image yet
              responseText = 'Image generated:'; // Default caption
            }
          }
        });

        if (!responseText && !imageUrl) {
          responseText = 'No recognizable content received from API.';
        }
      } else {
        responseText = 'No output array received from API.';
      }
      
      const assistantMessage: Message = {
        id: data.id || Date.now().toString(), // Use API id, fallback to timestamp
        text: responseText,
        isUser: false,
        timestamp: new Date(),
        imageUrl: imageUrl
      };

      setMessages(prev => [...prev, assistantMessage]);
      setLastResponseId(data.id);
    } catch (error) {
      console.error('Error details:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'Error: Failed to get response from API',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setLastResponseId(null);
    setSelectedFile(null);
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '2px solid #eee',
        paddingBottom: '10px'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>OpenAI Responses API Explorer</h1>
        <button 
          onClick={clearConversation}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Chat
        </button>
      </div>

      <div style={{ 
        height: '400px', 
        overflowY: 'auto', 
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        backgroundColor: '#fafafa'
      }}>
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
            Start a conversation with the OpenAI Responses API...
            <br />
            <small>You can upload images, documents, or just type text!</small>
          </p>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              style={{
                marginBottom: '16px',
                display: 'flex',
                justifyContent: message.isUser ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: message.isUser ? '#007bff' : '#e9ecef',
                color: message.isUser ? 'white' : '#333'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {message.isUser ? 'You' : 'Assistant'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
                {message.imageUrl && (
                  <img 
                    src={message.imageUrl} 
                    alt="Generated Image" 
                    style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }}
                  />
                )}
                {message.fileName && (
                  <div style={{ 
                    fontSize: '12px', 
                    opacity: 0.8, 
                    marginTop: '4px',
                    fontStyle: 'italic'
                  }}>
                    📎 {message.fileName}
                  </div>
                )}
                <div style={{ 
                  fontSize: '12px', 
                  opacity: 0.7, 
                  marginTop: '4px' 
                }}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
            Assistant is thinking...
          </div>
        )}
        {/* Auto-scroll target */}
        <div ref={messagesEndRef} />
      </div>

      {/* Web Search Toggle */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f0f8ff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            <div style={{ position: 'relative', marginRight: '8px' }}>
              <input
                type="checkbox"
                checked={webSearchEnabled}
                onChange={(e) => setWebSearchEnabled(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div style={{
                width: '50px',
                height: '26px',
                backgroundColor: webSearchEnabled ? '#007bff' : '#ccc',
                borderRadius: '13px',
                position: 'relative',
                transition: 'background-color 0.3s ease',
                cursor: 'pointer'
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: webSearchEnabled ? '26px' : '2px',
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>
            🌐 Enable Web Search
          </label>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {webSearchEnabled ? 'AI can search the web for current information' : 'AI will use only its training data'}
          </span>
        </div>
      </div>

      {/* Code Interpreter Toggle */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#fff5f5'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            <div style={{ position: 'relative', marginRight: '8px' }}>
              <input
                type="checkbox"
                checked={codeInterpreterEnabled}
                onChange={(e) => setCodeInterpreterEnabled(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div style={{
                width: '50px',
                height: '26px',
                backgroundColor: codeInterpreterEnabled ? '#28a745' : '#ccc',
                borderRadius: '13px',
                position: 'relative',
                transition: 'background-color 0.3s ease',
                cursor: 'pointer'
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: codeInterpreterEnabled ? '26px' : '2px',
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>
            🐍 Enable Code Interpreter
          </label>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {codeInterpreterEnabled ? 'AI can run Python code and create visualizations' : 'AI will only provide text responses'}
          </span>
        </div>
      </div>

      {/* DeepWiki MCP Toggle */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f0f0ff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            <div style={{ position: 'relative', marginRight: '8px' }}>
              <input
                type="checkbox"
                checked={deepWikiMcpEnabled}
                onChange={(e) => setDeepWikiMcpEnabled(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div style={{
                width: '50px',
                height: '26px',
                backgroundColor: deepWikiMcpEnabled ? '#6f42c1' : '#ccc',
                borderRadius: '13px',
                position: 'relative',
                transition: 'background-color 0.3s ease',
                cursor: 'pointer'
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: deepWikiMcpEnabled ? '26px' : '2px',
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>
            📚 Enable DeepWiki MCP
          </label>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {deepWikiMcpEnabled ? 'AI can search documentation and repositories via DeepWiki' : 'AI cannot access external documentation'}
          </span>
        </div>
      </div>

      {/* Image Generation Toggle */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#e6fff2' // A light green background
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            <div style={{ position: 'relative', marginRight: '8px' }}>
              <input
                type="checkbox"
                checked={imageGenerationEnabled}
                onChange={(e) => setImageGenerationEnabled(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div style={{
                width: '50px',
                height: '26px',
                backgroundColor: imageGenerationEnabled ? '#ff69b4' : '#ccc', // Hot pink when enabled
                borderRadius: '13px',
                position: 'relative',
                transition: 'background-color 0.3s ease',
                cursor: 'pointer'
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: imageGenerationEnabled ? '26px' : '2px',
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>
            🖼️ Enable Image Generation
          </label>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {imageGenerationEnabled ? 'AI can generate images based on your prompts' : 'AI will only provide text responses'}
          </span>
        </div>
      </div>

      {/* File Upload Section */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        border: '2px dashed #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <input
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
            style={{ flex: 1 }}
          />
          {selectedFile && (
            <button
              onClick={removeFile}
              style={{
                padding: '4px 8px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Remove
            </button>
          )}
        </div>
        {selectedFile && (
          <div style={{ 
            fontSize: '14px', 
            color: '#666',
            padding: '8px',
            backgroundColor: '#e9ecef',
            borderRadius: '4px'
          }}>
            Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          Supported: Images (PNG, JPG, GIF, WebP), Documents (PDF, DOC, DOCX, TXT)
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={selectedFile ? "Ask about your file..." : "Type your message here..."}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        />
        <button 
          onClick={sendMessage}
          disabled={isLoading || (!input.trim() && !selectedFile)}
          style={{
            padding: '12px 24px',
            backgroundColor: isLoading || (!input.trim() && !selectedFile) ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading || (!input.trim() && !selectedFile) ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          Send
        </button>
      </div>
      
      {lastResponseId && (
        <div style={{ 
          marginTop: '10px', 
          fontSize: '12px', 
          color: '#666' 
        }}>
          Response ID: {lastResponseId}
        </div>
      )}
    </div>
  );
};

export default App;
