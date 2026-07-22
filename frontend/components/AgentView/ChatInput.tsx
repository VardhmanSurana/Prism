import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { InputMessage } from './InputMessage';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text?: string, files?: File[]) => void;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSend, disabled }) => {
  const [files, setFiles] = useState<File[]>([]);

  const handleSend = (text: string, attachedFiles: File[]) => {
    onSend(text, attachedFiles);
    setFiles([]);
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <InputMessage
        value={value}
        onValueChange={onChange}
        onSend={handleSend}
        placeholder="Ask Prism to find photos, upload an image to analyze or search..."
        disabled={disabled}
        files={files}
        onFilesChange={setFiles}
        accept="image/*"
        maxFiles={1}
        minRows={1}
        maxRows={6}
        clickToFocus
        sendLabel="Send"
        leftSlot={({ openFilePicker }) => (
          <button
            type="button"
            onClick={() => openFilePicker("image/*")}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1 text-xs cursor-pointer"
            title="Upload image to analyze or find similar photos"
          >
            <ImageIcon size={16} className="text-purple-400" />
            <span className="hidden sm:inline font-medium text-[11px]">Upload Image</span>
          </button>
        )}
      />
    </div>
  );
};