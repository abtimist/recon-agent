"use client";

import { useCallback, useState } from "react";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

interface MultiFileUploaderProps {
  label: string;
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
}

export function MultiFileUploader({ label, onFilesSelect, selectedFiles }: MultiFileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => 
        f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".tsv")
      );
      onFilesSelect([...selectedFiles, ...newFiles]);
    }
  }, [onFilesSelect, selectedFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      onFilesSelect([...selectedFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    const updated = [...selectedFiles];
    updated.splice(index, 1);
    onFilesSelect(updated);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer overflow-hidden
          ${isDragOver ? "border-accent bg-accent/5 scale-[1.01]" : "border-border/60 hover:border-accent/50 hover:bg-muted/30"}
        `}
      >
        <input 
          type="file" 
          multiple
          accept=".csv,.xlsx,.xls,.tsv" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
          onChange={handleFileInput}
        />
        <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
          <div className={`p-3 rounded-full ${isDragOver ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Click or drag files to upload</p>
            <p className="text-xs text-muted-foreground mt-1">Supports CSV, XLSX, XLS, TSV</p>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {selectedFiles.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-border/50 bg-muted/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileIcon className="w-4 h-4 text-accent shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
              <button 
                onClick={() => removeFile(i)}
                className="p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
