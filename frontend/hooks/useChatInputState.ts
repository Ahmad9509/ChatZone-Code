// Custom hook for managing chat input and streaming state
import { useState } from 'react';

export function useChatInputState() {
  const [message, setMessage] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');

  return {
    message,
    setMessage,
    streaming,
    setStreaming,
    streamedContent,
    setStreamedContent,
  };
}

