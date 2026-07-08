import React from 'react';
import { InputMessage } from './InputMessage';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSend, disabled }) => {
  return (
    <div className="px-4 pb-4 pt-2">
      <InputMessage
        value={value}
        onValueChange={onChange}
        onSend={onSend}
        placeholder="Ask Prism to find something..."
        disabled={disabled}
        minRows={1}
        maxRows={6}
        clickToFocus
        sendLabel="Send"
      />
    </div>
  );
};