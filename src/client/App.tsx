import React, { useState } from 'react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  fileName?: string;
}

interface ApiResponse {
  id: string;
  output: Array<{
    content: Array<{
      text: string;
    }>;
  }>;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
            previousResponseId: lastResponseId
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, response.statusText, errorText);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data: ApiResponse = await response.json();
      
      const assistantMessage: Message = {
        id: data.id,
        text: data.output[0]?.content[0]?.text || 'No response received',
        isUser: false,
        timestamp: new Date()
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
